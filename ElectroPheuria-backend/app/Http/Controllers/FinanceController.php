<?php

namespace App\Http\Controllers;

use App\Models\CashMovement;
use App\Models\Deal;
use App\Models\Expense;
use App\Models\FinanceSetting;
use App\Models\Order;
use App\Models\Product;
use App\Support\FinanceLedger;
use App\Support\OfferPricing;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Dashboard finance tracker. Every route is behind auth:sanctum: this exposes the bank
 * balance and supplier costs.
 *
 * cash_movements is the single ledger: money in, spending (by category), and transfers
 * between the cash and bank accounts. All totals are computed here by FinanceLedger from
 * the saved rows; the browser only displays them. The older `expenses` list is kept as
 * a planning list of recurring costs and is never added to the spending totals.
 */
class FinanceController extends Controller
{
    /** Kept for reference: an order marked delivered on the Orders page. */
    public const DELIVERED = 'done';

    // GET /api/finance
    public function index()
    {
        $settings = FinanceSetting::current();
        $movements = CashMovement::orderBy('occurred_on')->orderBy('id')->get();
        $totals = FinanceLedger::totals($movements);
        $orders = FinanceLedger::orders();

        return response()->json([
            'settings' => $this->settingsPayload($settings),
            'movements' => $movements->map(fn ($m) => $this->movementPayload($m))->values(),
            'expenses' => Expense::orderBy('position')->orderBy('id')->get()
                ->map(fn ($e) => $this->expensePayload($e))->values(),
            'items' => $this->items(),
            'summary' => [
                'balances' => FinanceLedger::balances($settings),
                'opening' => ['cash' => (float) $settings->opening_cash, 'bank' => (float) $settings->opening_balance],
            ] + $totals,
            'monthly' => FinanceLedger::report($movements, 'month'),
            'yearly' => FinanceLedger::report($movements, 'year'),
            'orders' => $orders,
            'categories' => CashMovement::CATEGORIES,
            // Back-compat: "taken in" is now the money actually received (income movements).
            'revenue' => [
                'total' => $totals['income'],
                'orders' => $totals['counts'][CashMovement::INCOME] ?? 0,
            ],
        ]);
    }

    // GET /api/finance/spending?from=YYYY-MM-DD&to=YYYY-MM-DD — spending for a date range.
    public function spending(Request $request)
    {
        $data = $request->validate([
            'from' => 'nullable|date_format:Y-m-d',
            'to' => 'nullable|date_format:Y-m-d|after_or_equal:from',
        ]);
        $movements = FinanceLedger::between($data['from'] ?? null, $data['to'] ?? null);
        $expenses = $movements->where('type', CashMovement::EXPENSE)->values();

        return response()->json([
            'from' => $data['from'] ?? null,
            'to' => $data['to'] ?? null,
            'totals' => FinanceLedger::totals($movements),
            'expenses' => $expenses->sortByDesc(fn ($m) => $m->occurred_on->format('Y-m-d') . sprintf('%010d', $m->id))
                ->map(fn ($m) => $this->movementPayload($m))->values(),
            'delivery_by_city' => $expenses->where('category', 'delivery')
                ->groupBy(fn ($m) => $m->city ?: '—')
                ->map(fn ($g, $city) => ['city' => $city, 'count' => $g->count(), 'total' => round($g->sum('amount'), 2), 'last' => (float) $g->sortBy('occurred_on')->last()->amount])
                ->sortByDesc('total')->values(),
            'stock_by_item' => $expenses->where('category', 'stock')
                ->groupBy(fn ($m) => $m->item_name ?: $m->label)
                ->map(fn ($g, $name) => ['item' => $name, 'quantity' => (int) $g->sum('quantity'), 'total' => round($g->sum('amount'), 2)])
                ->sortByDesc('total')->values(),
        ]);
    }

    // PUT /api/finance/settings
    public function updateSettings(Request $request)
    {
        $data = $request->validate([
            'opening_balance' => 'required|numeric|between:-99999999,99999999',
            'opening_cash' => 'nullable|numeric|between:-99999999,99999999',
            'opening_date' => 'nullable|date',
            'reconciled_on' => 'nullable|date',
            'delivery_per_order' => 'required|numeric|min:0|max:100000',
        ]);
        if (!array_key_exists('opening_cash', $data) || $data['opening_cash'] === null) {
            unset($data['opening_cash']); // older dashboards don't send it: keep the saved value
        }

        $settings = FinanceSetting::current();
        $settings->update($data);

        return response()->json($this->settingsPayload($settings->fresh()));
    }

    // POST /api/finance/movements
    public function storeMovement(Request $request)
    {
        $data = $this->validatedMovement($request);

        $addToStock = $this->pullAddToStock($data);

        $movement = DB::transaction(function () use ($data, $addToStock) {
            $this->assertTransferCovered($data);
            $movement = CashMovement::create($data);
            $this->applyStock($movement, $addToStock);
            return $movement;
        });

        return response()->json($this->movementPayload($movement->fresh()), 201);
    }

    // PUT /api/finance/movements/{id} — correct a movement; totals follow automatically.
    public function updateMovement(Request $request, $id)
    {
        $movement = CashMovement::findOrFail($id);
        $data = $this->validatedMovement($request, $movement);
        $addToStock = $this->pullAddToStock($data);

        DB::transaction(function () use ($movement, $data, $addToStock) {
            $this->assertTransferCovered($data, $movement->id);
            $this->revertStock($movement);
            $movement->update($data + ['stock_added' => 0]);
            $this->applyStock($movement->fresh(), $addToStock);
        });

        return response()->json($this->movementPayload($movement->fresh()));
    }

    // DELETE /api/finance/movements/{id}
    public function destroyMovement($id)
    {
        $movement = CashMovement::findOrFail($id);
        DB::transaction(function () use ($movement) {
            $this->revertStock($movement);
            $movement->delete();
        });

        return response()->json(['success' => true]);
    }

    // POST /api/finance/expenses
    public function storeExpense(Request $request)
    {
        $data = $this->validatedExpense($request);
        $data['position'] = (int) Expense::max('position') + 1;

        return response()->json($this->expensePayload(Expense::create($data)), 201);
    }

    // PUT /api/finance/expenses/{id}
    public function updateExpense(Request $request, $id)
    {
        $expense = Expense::findOrFail($id);
        $expense->update($this->validatedExpense($request));

        return response()->json($this->expensePayload($expense->fresh()));
    }

    // DELETE /api/finance/expenses/{id}
    public function destroyExpense($id)
    {
        Expense::findOrFail($id)->delete();

        return response()->json(['success' => true]);
    }

    // PUT /api/finance/items/{type}/{id} — supplier cost, packaging and (products only) the two-unit price.
    public function updateItem(Request $request, string $type, $id)
    {
        abort_unless(in_array($type, ['product', 'deal'], true), 404);

        $rules = [
            'cost_price' => 'nullable|numeric|min:0|max:9999999',
            'packaging_cost' => 'nullable|numeric|min:0|max:9999999',
        ];
        if ($type === 'product') {
            $rules['deal_price_2'] = 'nullable|numeric|gt:0|max:9999999';
        }
        $data = $request->validate($rules);

        $model = $type === 'product' ? Product::findOrFail($id) : Deal::findOrFail($id);
        // forceFill: these columns are deliberately outside $fillable so the catalogue forms never touch them.
        $model->forceFill(array_intersect_key($data, $rules))->save();

        return response()->json($this->itemPayload($type, $model->fresh()));
    }

    // =================== MOVEMENTS ===================

    /**
     * Validate a movement for its type and build the row to save. The amount of a stock
     * purchase is always quantity × unit cost; labels are generated when left empty.
     */
    private function validatedMovement(Request $request, ?CashMovement $existing = null): array
    {
        $type = $request->input('type');
        $category = $request->input('category');
        $isExpense = $type === CashMovement::EXPENSE;
        $isStock = $isExpense && $category === 'stock';
        $isDelivery = $isExpense && $category === 'delivery';

        $rules = [
            'type' => ['required', Rule::in(CashMovement::TYPES)],
            'occurred_on' => 'required|date_format:Y-m-d',
            'amount' => [$isStock ? 'nullable' : 'required', 'numeric', 'gt:0', 'max:99999999'],
            'label' => 'nullable|string|max:255',
            'notes' => 'nullable|string|max:2000',
            'account' => [in_array($type, CashMovement::TRANSFERS, true) ? 'nullable' : 'required', Rule::in(CashMovement::ACCOUNTS)],
            'category' => [$isExpense ? 'required' : 'nullable', Rule::in(CashMovement::CATEGORIES)],
            'source' => 'nullable|string|max:255',
            'order_id' => ['nullable', 'integer', Rule::exists('orders', 'id'),
                Rule::unique('cash_movements', 'order_id')->where('type', CashMovement::INCOME)->ignore($existing?->id)],
            'item_type' => [$isStock ? 'required' : 'nullable', Rule::in(['product', 'deal'])],
            'item_id' => [$isStock ? 'required' : 'nullable', 'integer'],
            'quantity' => [$isStock ? 'required' : 'nullable', 'integer', 'min:1', 'max:100000'],
            'unit_cost' => [$isStock ? 'required' : 'nullable', 'numeric', 'min:0', 'max:9999999'],
            'add_to_stock' => 'nullable|boolean',
            'city' => [$isDelivery ? 'required' : 'nullable', 'string', 'max:100'],
            'carrier' => 'nullable|string|max:100',
            'order_ref' => 'nullable|string|max:50',
        ];
        $messages = [
            'amount.required' => 'Enter an amount.',
            'amount.gt' => 'The amount must be greater than 0.',
            'account.required' => 'Choose Cash or Bank.',
            'category.required' => 'Choose a spending category.',
            'item_id.required' => 'Choose the product that was purchased.',
            'item_type.required' => 'Choose the product that was purchased.',
            'quantity.required' => 'Enter the quantity purchased.',
            'unit_cost.required' => 'Enter the unit purchase cost.',
            'city.required' => 'Enter the destination city.',
            'order_id.unique' => 'Money for this order has already been recorded.',
        ];
        $v = $request->validate($rules, $messages);

        $row = [
            'type' => $type,
            'occurred_on' => $v['occurred_on'],
            'direction' => $type === CashMovement::INCOME ? 'in' : 'out',
            'notes' => $this->clean($v['notes'] ?? null),
            // Reset every type-specific field, so changing the type never leaves stale data behind.
            'account' => null, 'category' => null, 'source' => null, 'order_id' => null,
            'item_type' => null, 'item_id' => null, 'item_name' => null, 'quantity' => null, 'unit_cost' => null,
            'city' => null, 'carrier' => null, 'order_ref' => null,
        ];
        $label = $this->clean($v['label'] ?? null);
        $amount = isset($v['amount']) ? round((float) $v['amount'], 2) : null;

        switch ($type) {
            case CashMovement::INCOME:
                $row['account'] = $v['account'];
                $row['source'] = $this->clean($v['source'] ?? null) ?? $label;
                $row['order_id'] = $v['order_id'] ?? null;
                $label ??= $row['source'] ?? ($row['order_id'] ? "Order #{$row['order_id']}" : 'Money in');
                break;

            case CashMovement::EXPENSE:
                $row['account'] = $v['account'];
                $row['category'] = $v['category'];
                if ($isStock) {
                    $item = $v['item_type'] === 'deal' ? Deal::find($v['item_id']) : Product::find($v['item_id']);
                    if (!$item) {
                        // Keep the original link when editing a purchase whose product was since deleted.
                        if ($existing && $existing->item_type === $v['item_type'] && (int) $existing->item_id === (int) $v['item_id']) {
                            $itemName = $existing->item_name;
                        } else {
                            throw ValidationException::withMessages(['item_id' => 'This product no longer exists.']);
                        }
                    }
                    $row['item_type'] = $v['item_type'];
                    $row['item_id'] = (int) $v['item_id'];
                    $row['item_name'] = $item->name ?? $itemName;
                    $row['quantity'] = (int) $v['quantity'];
                    $row['unit_cost'] = round((float) $v['unit_cost'], 2);
                    $amount = round($row['quantity'] * $row['unit_cost'], 2);
                    if ($amount <= 0) {
                        throw ValidationException::withMessages(['unit_cost' => 'The purchase total must be greater than 0.']);
                    }
                    $label ??= "{$row['item_name']} × {$row['quantity']}";
                } elseif ($isDelivery) {
                    $row['city'] = $this->clean($v['city']);
                    $row['carrier'] = $this->clean($v['carrier'] ?? null);
                    $row['order_ref'] = $this->clean($v['order_ref'] ?? null);
                    $label ??= 'Delivery — ' . $row['city'];
                } else {
                    $label ??= ['packaging' => 'Packaging', 'tiktok_ads' => 'TikTok Ads', 'meta_ads' => 'Meta Ads', 'other' => 'Other expense'][$v['category']];
                }
                break;

            case CashMovement::WITHDRAWAL:
                $label ??= 'Withdrawal: bank → cash';
                break;

            case CashMovement::DEPOSIT:
                $label ??= 'Deposit: cash → bank';
                break;
        }

        $row['label'] = mb_substr($label, 0, 255);
        $row['amount'] = $amount;
        $row['_add_to_stock'] = $isStock && (bool) ($v['add_to_stock'] ?? false);

        return $row;
    }

    /** A transfer cannot take more than the source account holds (cash for a deposit, bank for a withdrawal). */
    private function pullAddToStock(array &$data): bool
    {
        $add = (bool) ($data['_add_to_stock'] ?? false);
        unset($data['_add_to_stock']);
        return $add;
    }

    private function assertTransferCovered(array $row, ?int $exceptId = null): void
    {
        if (!in_array($row['type'], CashMovement::TRANSFERS, true)) {
            return;
        }
        $balances = FinanceLedger::balances(null, $exceptId);
        $source = $row['type'] === CashMovement::WITHDRAWAL ? 'bank' : 'cash';
        if ($row['amount'] > $balances[$source] + 0.004) {
            throw ValidationException::withMessages([
                'amount' => sprintf('Not enough money in %s: %s DH available.', $source, number_format(max($balances[$source], 0), 2, '.', ' ')),
            ]);
        }
    }

    /** Stock purchase with "add to shop stock": raise the item's stock and remember by how much. */
    private function applyStock(CashMovement $m, bool $add): void
    {
        if (!$add || $m->category !== 'stock' || !$m->quantity) {
            return;
        }
        $item = $this->stockItem($m);
        if (!$item) {
            return;
        }
        $item->increment('stock', $m->quantity);
        $m->forceFill(['stock_added' => $m->quantity])->saveQuietly();
    }

    /** Undo exactly what applyStock added (never below 0). */
    private function revertStock(CashMovement $m): void
    {
        if ($m->stock_added > 0 && ($item = $this->stockItem($m))) {
            $item->update(['stock' => max(0, (int) $item->stock - $m->stock_added)]);
        }
    }

    private function stockItem(CashMovement $m)
    {
        return match ($m->item_type) {
            'product' => Product::find($m->item_id),
            'deal' => Deal::find($m->item_id),
            default => null,
        };
    }

    private function clean(?string $v): ?string
    {
        $v = $v === null ? null : trim($v);
        return $v === '' ? null : $v;
    }

    // =================== HELPERS ===================

    private function validatedExpense(Request $request): array
    {
        $data = $request->validate([
            'category' => ['required', Rule::in(Expense::CATEGORIES)],
            'label' => 'required|string|max:255',
            'amount' => 'present|nullable|numeric|min:0|max:99999999',
            'period' => 'nullable|string|max:255',
            'note' => 'nullable|string|max:255',
            'verified' => 'boolean',
        ]);
        // An empty field is "not known yet" (null), never 0.
        $data['amount'] = $request->input('amount') === null || $request->input('amount') === '' ? null : round((float) $data['amount'], 2);
        $data['verified'] = $request->boolean('verified');

        return $data;
    }

    private function items(): array
    {
        $products = Product::orderBy('name')->get()->map(fn ($p) => $this->itemPayload('product', $p));
        $deals = Deal::orderBy('name')->get()->map(fn ($d) => $this->itemPayload('deal', $d));

        return $deals->concat($products)->values()->all();
    }

    private function itemPayload(string $type, $model): array
    {
        $price = (float) $model->price;
        $offer = $type === 'deal' ? ($model->offer_type ?: OfferPricing::STANDARD) : null;

        if ($type === 'deal') {
            // Two-unit price = what checkout actually charges for 2 (OfferPricing::line), so the
            // tracker can never drift from the shop. Standard deals have no two-unit offer.
            $deal2 = $offer === OfferPricing::STANDARD
                ? null
                : OfferPricing::line($price, 2, $offer, $model->second_item_price)['line_total'];
        } else {
            $deal2 = $model->deal_price_2;
        }

        return [
            'type' => $type,
            'id' => $model->id,
            'name' => $model->name,
            'price' => $price,
            'stock' => (int) $model->stock,
            'cost_price' => $model->cost_price,
            'packaging_cost' => $model->packaging_cost,
            'deal_price_2' => $deal2 !== null ? (float) $deal2 : null,
            'deal_price_2_derived' => $type === 'deal',
            'offer_type' => $offer,
            'active' => (bool) $model->active,
            'bundle' => $type === 'deal' && $model->deal_type === Deal::TYPE_BUNDLE,
        ];
    }

    private function settingsPayload(FinanceSetting $s): array
    {
        return [
            'opening_balance' => (float) $s->opening_balance,
            'opening_cash' => (float) $s->opening_cash,
            'opening_date' => $s->opening_date?->format('Y-m-d'),
            'reconciled_on' => $s->reconciled_on?->format('Y-m-d'),
            'delivery_per_order' => (float) $s->delivery_per_order,
        ];
    }

    private function movementPayload(CashMovement $m): array
    {
        return [
            'id' => $m->id,
            'occurred_on' => $m->occurred_on->format('Y-m-d'),
            'label' => $m->label,
            'direction' => $m->direction,
            'amount' => (float) $m->amount,
            'type' => $m->type,
            'account' => $m->account,
            'category' => $m->category,
            'source' => $m->source,
            'order_id' => $m->order_id,
            'item_type' => $m->item_type,
            'item_id' => $m->item_id,
            'item_name' => $m->item_name,
            'quantity' => $m->quantity,
            'unit_cost' => $m->unit_cost,
            'stock_added' => (int) $m->stock_added,
            'city' => $m->city,
            'carrier' => $m->carrier,
            'order_ref' => $m->order_ref,
            'notes' => $m->notes,
        ];
    }

    private function expensePayload(Expense $e): array
    {
        return [
            'id' => $e->id,
            'category' => $e->category,
            'label' => $e->label,
            'amount' => $e->amount, // null stays null
            'period' => $e->period,
            'note' => $e->note,
            'verified' => $e->verified,
        ];
    }
}
