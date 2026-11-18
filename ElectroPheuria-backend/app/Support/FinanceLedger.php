<?php

namespace App\Support;

use App\Models\CashMovement;
use App\Models\FinanceSetting;
use App\Models\Order;
use Illuminate\Support\Collection;

/**
 * The only place money is added up. Every figure the tracker shows (balances, money in,
 * spending per category, monthly / yearly reports, money still expected from orders)
 * comes from the saved cash_movements rows through these functions.
 * Internal transfers (withdrawal / deposit) move money between cash and bank and are
 * never counted as income or spending.
 */
class FinanceLedger
{
    /** Orders whose money is due: shipped (or marked delivered) and not yet recorded as received. */
    public const EXPECTED_STATUSES = ['shipped', 'done'];
    public const PIPELINE_STATUSES = ['pending', 'ongoing'];

    /** Balances after every movement (optionally ignoring one, e.g. the one being edited). */
    public static function balances(?FinanceSetting $settings = null, ?int $exceptId = null): array
    {
        $settings ??= FinanceSetting::current();
        $cash = (float) $settings->opening_cash;
        $bank = (float) $settings->opening_balance;

        $query = CashMovement::query();
        if ($exceptId) {
            $query->where('id', '!=', $exceptId);
        }
        foreach ($query->get() as $m) {
            $e = $m->effect();
            $cash += $e['cash'];
            $bank += $e['bank'];
        }

        return ['cash' => round($cash, 2), 'bank' => round($bank, 2), 'total' => round($cash + $bank, 2)];
    }

    /** Money in, spending (per category) and transfers for a set of movements. */
    public static function totals(Collection $movements): array
    {
        $byCategory = array_fill_keys(CashMovement::CATEGORIES, 0.0);
        $income = ['cash' => 0.0, 'bank' => 0.0];
        $spending = ['cash' => 0.0, 'bank' => 0.0];
        $withdrawals = 0.0;
        $deposits = 0.0;
        $counts = array_fill_keys(CashMovement::TYPES, 0);

        foreach ($movements as $m) {
            $a = (float) $m->amount;
            $counts[$m->type] = ($counts[$m->type] ?? 0) + 1;
            switch ($m->type) {
                case CashMovement::INCOME:
                    $income[$m->account === CashMovement::CASH ? 'cash' : 'bank'] += $a;
                    break;
                case CashMovement::EXPENSE:
                    $spending[$m->account === CashMovement::CASH ? 'cash' : 'bank'] += $a;
                    $cat = in_array($m->category, CashMovement::CATEGORIES, true) ? $m->category : 'other';
                    $byCategory[$cat] += $a;
                    break;
                case CashMovement::WITHDRAWAL:
                    $withdrawals += $a;
                    break;
                case CashMovement::DEPOSIT:
                    $deposits += $a;
                    break;
            }
        }

        $r = fn ($v) => round($v, 2);
        $byCategory = array_map($r, $byCategory);

        return [
            'income' => $r($income['cash'] + $income['bank']),
            'income_by_account' => array_map($r, $income),
            'spending' => $r($spending['cash'] + $spending['bank']),
            'spending_by_account' => array_map($r, $spending),
            'spending_by_category' => $byCategory,
            'advertising' => $r($byCategory['tiktok_ads'] + $byCategory['meta_ads']),
            'net' => $r($income['cash'] + $income['bank'] - $spending['cash'] - $spending['bank']),
            'withdrawals' => $r($withdrawals),
            'deposits' => $r($deposits),
            'counts' => $counts,
        ];
    }

    /** Movements dated between $from and $to (inclusive, YYYY-MM-DD; either may be null). */
    public static function between(?string $from, ?string $to): Collection
    {
        return CashMovement::query()
            ->when($from, fn ($q) => $q->whereDate('occurred_on', '>=', $from))
            ->when($to, fn ($q) => $q->whereDate('occurred_on', '<=', $to))
            ->orderBy('occurred_on')->orderBy('id')
            ->get();
    }

    /** Per period ('month' = YYYY-MM, 'year' = YYYY) money in, spending and categories, oldest first. */
    public static function report(Collection $movements, string $period): array
    {
        $len = $period === 'year' ? 4 : 7;
        return $movements
            ->groupBy(fn ($m) => substr($m->occurred_on->format('Y-m-d'), 0, $len))
            ->sortKeys()
            ->map(fn ($group, $key) => ['period' => $key] + self::totals($group))
            ->values()
            ->all();
    }

    /** Money expected from orders vs. money actually recorded as received for them. */
    public static function orders(): array
    {
        $received = CashMovement::where('type', CashMovement::INCOME)->whereNotNull('order_id')->pluck('order_id')->all();

        $due = Order::whereIn('status', self::EXPECTED_STATUSES)->orderByDesc('id')->get(['id', 'status', 'total_price', 'created_at', 'client_data']);
        $expected = $due->reject(fn ($o) => in_array($o->id, $received, true));
        $pipeline = Order::whereIn('status', self::PIPELINE_STATUSES)->get(['id', 'total_price']);

        $row = fn ($o) => [
            'id' => $o->id,
            'status' => $o->status,
            'total' => (float) $o->total_price,
            'date' => $o->created_at?->format('Y-m-d'),
            'customer' => $o->client_data['name'] ?? null,
            'city' => $o->client_data['city'] ?? null,
        ];

        return [
            // Shipped / delivered, cash not recorded as received yet.
            'expected' => ['total' => round((float) $expected->sum('total_price'), 2), 'count' => $expected->count(), 'orders' => $expected->map($row)->values()->all()],
            // Confirmed or new orders that are not shipped yet.
            'pipeline' => ['total' => round((float) $pipeline->sum('total_price'), 2), 'count' => $pipeline->count()],
            // Orders an income movement can still be linked to (incl. already-linked ones for editing).
            'linkable' => $due->map($row)->values()->all(),
            'received_order_ids' => array_values($received),
        ];
    }
}
