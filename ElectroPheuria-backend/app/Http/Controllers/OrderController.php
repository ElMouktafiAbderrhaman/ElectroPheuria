<?php

namespace App\Http\Controllers;

use App\Models\Client;
use App\Models\Order;
use App\Models\Product;
use App\Models\Deal;
use App\Models\DealBundleItem;
use App\Models\ProductVariant;
use App\Models\User;
use App\Jobs\SendOrderConfirmationEmail;
use App\Mail\NewOrderNotification;
use App\Mail\OrderConfirmation;
use App\Exceptions\OrderRejected;
use App\Support\OfferPricing;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

class OrderController extends Controller
{
    /** Product revenue of an order: the stored subtotal (orders before it existed: total minus fee). */
    private const PRODUCT_REVENUE_SQL = 'COALESCE(subtotal, total_price - delivery_fee)';

    public function store(Request $request)
    {
        $request->validate([
            'client' => 'required|array',
            'client.name' => 'required|string|max:255',
            // Optional and never blocks checkout: an invalid address is simply dropped below.
            'client.email' => 'nullable|string|max:255',
            'client.phone' => 'required|string|max:50',
            'client.city' => 'required|string|max:100',
            // Full delivery address typed by the customer (street, building, floor, neighbourhood).
            'client.delivery_address' => 'required|string|min:5|max:500',
            'client.address' => 'nullable|string|max:500',
            'products' => 'required|array|min:1',
            'products.*.id' => 'required',
            // Any positive whole number: stock never limits what a customer can order.
            'products.*.quantity' => 'nullable|integer|min:1',
            // Selected cable variant (Lightning / USB Type-C) for products that have variants.
            'products.*.variant_id' => 'nullable|integer',
            // Packs: cable type chosen for each pack product that has variants, {productId: variantId}.
            'products.*.bundle_variants' => 'nullable|array',
            // Ignored: subtotal, delivery fee and total are recomputed on the server below.
            'total_price' => 'nullable|numeric',
            'delivery_fee' => 'nullable|numeric',
            // Total shown to the customer when they confirmed; the order is refused (409) if it differs.
            'expected_total' => 'nullable|numeric',
            // Website language the customer was browsing in (en/fr/ar); defaults to fr.
            'locale' => 'nullable|string|max:10',
        ], [
            'client.city.required' => 'Please select your city.',
            'client.delivery_address.required' => 'Please enter your full delivery address.',
            'client.delivery_address.min' => 'Please enter your full delivery address.',
            'client.delivery_address.max' => 'The delivery address is too long (500 characters max).',
        ]);

        $clientInput = $request->input('client');
        $clientInput['city'] = trim((string) $clientInput['city']);
        // Collapse runs of spaces but keep the customer's line breaks.
        $deliveryAddress = trim(preg_replace("/[ \t]+/", ' ', str_replace("\r\n", "\n", (string) $clientInput['delivery_address'])));
        if (mb_strlen($deliveryAddress) < 5) {
            return response()->json([
                'message' => 'Please enter your full delivery address.',
                'errors' => ['client.delivery_address' => ['Please enter your full delivery address.']],
            ], 422);
        }
        $clientInput['delivery_address'] = $deliveryAddress;
        $clientInput['address'] = $deliveryAddress;
        $clientInput['email'] = OrderConfirmation::deliverableEmail($clientInput['email'] ?? null);
        $locale = OrderConfirmation::normalizeLocale($request->input('locale'));

        try {
            $priced = $this->priceOrder($request->products);
        } catch (OrderRejected $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
        ['lines' => $lines, 'orderLines' => $orderLines, 'subtotal' => $subtotal, 'deliveryFee' => $deliveryFee, 'total' => $total] = $priced;

        // The customer confirmed a total on the checkout page: never record a different amount.
        if ($request->filled('expected_total') && abs((float) $request->input('expected_total') - $total) > 0.009) {
            return response()->json([
                'message' => 'Prices changed since you opened the checkout. Please check the new total and confirm again.',
                'code' => 'total_changed',
                'quote' => $this->quotePayload($priced),
            ], 409);
        }

        // Units each stock source (product, deal or cable variant) must supply, all lines together.
        $demands = $this->stockDemands($lines);

        $order = DB::transaction(function () use ($clientInput, $locale, $demands, $orderLines, $subtotal, $deliveryFee, $total) {
            // Take the units from stock. Stock may go below zero: −3 means 3 units were
            // sold that the shop still has to source ("Products to prepare" shows it).
            $this->takeStock($demands);

            $clientData = $clientInput;
            $client = Client::updateOrCreate(
                ['phone' => $clientData['phone']],
                [
                    'name' => $clientData['name'],
                    'email' => $clientData['email'] ?? null,
                    // clients.address is a 255-char column; the full address lives on the order.
                    'address' => Str::limit($clientData['delivery_address'] . ', ' . $clientData['city'], 255, ''),
                ]
            );

            $order = Order::create([
                'client_id' => $client->id,
                'client_data' => $clientData,
                'delivery_address' => $clientData['delivery_address'],
                'products' => $orderLines,
                'subtotal' => $subtotal,
                'delivery_fee' => $deliveryFee,
                'total_price' => $total,
                'status' => 'pending',
                'locale' => $locale,
            ]);

            // Send email notification to admin + all users
            try {
                $products = $orderLines;

                $recipients = User::whereNotNull('email')->pluck('email')->toArray();
                $adminEmail = config('mail.from.address');
                if (!in_array($adminEmail, $recipients)) {
                    $recipients[] = $adminEmail;
                }

                Mail::to($recipients)->send(new NewOrderNotification($order, $clientData, $products));
            } catch (\Throwable $e) {
                \Log::error('Failed to send order email: ' . $e->getMessage());
            }

            return $order;
            });

        // The order is committed at this point. The customer's confirmation is
        // queued; any problem with it is logged and never fails the checkout.
        $this->queueCustomerConfirmation($order);

        return response()->json($order->load('client'), 201);
    }

    /**
     * Price the requested lines from the database (never from client-sent values).
     * Lines for the same item are merged so offers apply to the full quantity.
     * Used by both the order and the checkout quote, so they always agree.
     *
     * @throws OrderRejected
     */
    private function priceOrder(array $products): array
    {
        $lines = [];
        foreach ($products as $item) {
            $isDeal = !empty($item['isDeal']) || !empty($item['oldPrice']) || !empty($item['old_price']);
            $model = $isDeal ? Deal::with(Deal::BUNDLE_WITH)->find($item['id']) : Product::with('variants')->find($item['id']);

            if (!$model || !$model->active) {
                throw new OrderRejected('This item is no longer available: ' . ($model->name ?? $item['name'] ?? $item['id']));
            }
            if ($model->coming_soon) {
                throw new OrderRejected('This item is coming soon and cannot be ordered yet: ' . $model->name);
            }

            // Bundle deal: both items must still exist and be orderable, and every pack
            // product with cable variants needs the cable type the customer picked.
            $bundleChoices = [];
            if ($isDeal && $model->isBundle()) {
                if ($model->bundleItems->count() !== 2 || $model->bundleItems->contains(fn ($row) => !$row->isAvailable())) {
                    throw new OrderRejected('This bundle is no longer available: ' . $model->name);
                }
                $picked = is_array($item['bundle_variants'] ?? null) ? $item['bundle_variants'] : [];
                foreach ($model->bundleItems as $row) {
                    $choices = $row->selectableVariants();
                    if ($choices->isEmpty()) {
                        $bundleChoices[$row->id] = null;
                        continue;
                    }
                    $chosen = $choices->firstWhere('id', (int) ($picked[$row->choiceKey()] ?? 0));
                    if (!$chosen) {
                        throw new OrderRejected('Please choose a cable type for ' . $row->item()->name . ' in: ' . $model->name);
                    }
                    $bundleChoices[$row->id] = $chosen;
                }
            }

            // Cable variants (products and single deals): the customer must pick an active variant.
            $variant = null;
            if (!($isDeal && $model->isBundle()) && $model->has_variants) {
                $activeVariants = $model->variants->where('active', true);
                if ($activeVariants->isNotEmpty()) {
                    $variant = $activeVariants->firstWhere('id', (int) ($item['variant_id'] ?? 0));
                    if (!$variant) {
                        throw new OrderRejected('Please choose a cable type for: ' . $model->name);
                    }
                }
            }

            $key = ($isDeal ? 'deal-' : 'product-') . $model->id . ($variant ? '-v' . $variant->id : '')
                . implode('', array_map(fn ($rowId, $v) => '-b' . $rowId . ':' . $v->id, array_keys(array_filter($bundleChoices)), array_filter($bundleChoices)));
            if (!isset($lines[$key])) {
                $lines[$key] = ['model' => $model, 'isDeal' => $isDeal, 'variant' => $variant, 'bundleChoices' => $bundleChoices, 'quantity' => 0];
            }
            $lines[$key]['quantity'] += (int) ($item['quantity'] ?? 1);
        }

        $orderLines = [];
        $subtotal = 0.0;
        foreach ($lines as $line) {
            $model = $line['model'];
            $variant = $line['variant'];
            $isBundle = $line['isDeal'] && $model->isBundle();
            $offerType = $line['isDeal'] && !$isBundle ? ($model->offer_type ?: OfferPricing::STANDARD) : OfferPricing::STANDARD;
            $unitPrice = $variant ? $variant->unitPrice($model) : (float) $model->price;
            $secondItemPrice = $offerType === OfferPricing::BOGO_FIXED ? (float) $model->second_item_price : null;
            $pricing = OfferPricing::line($unitPrice, $line['quantity'], $offerType, $secondItemPrice);
            $subtotal += $pricing['line_total'];

            $orderLines[] = array_merge([
                'id' => $model->id,
                'name' => $model->name,
                'price' => $unitPrice,
                'quantity' => $line['quantity'],
            ], $line['isDeal'] ? [
                'isDeal' => true,
                'oldPrice' => $isBundle
                    ? round($model->bundleItems->sum(fn ($row) => $row->unitPrice() * $row->units()), 2)
                    : (float) $model->old_price,
                'offer_type' => $offerType,
                'second_item_price' => $secondItemPrice,
            ] : [], $isBundle ? [
                'deal_type' => Deal::TYPE_BUNDLE,
                // Items shipped for every bundle ordered (quantity is per bundle).
                'bundle_items' => $model->bundleItems->map(function ($row) use ($line) {
                    $chosen = $line['bundleChoices'][$row->id] ?? null;
                    return array_merge([
                        'kind' => $row->kind(),
                        'id' => $row->item()->id,
                        'name' => $row->item()->name,
                        'price' => $row->unitPrice(),
                        'quantity' => $row->units(),
                    ], $row->kind() === DealBundleItem::KIND_DEAL ? ['isDeal' => true] : [], $chosen ? [
                        'variant_id' => $chosen->id,
                        'variant_type' => $chosen->type,
                        'variant_label' => $chosen->label,
                        'variant_stock_tracked' => $chosen->stock !== null,
                    ] : []);
                })->values()->all(),
            ] : [], $variant ? [
                'variant_id' => $variant->id,
                'variant_type' => $variant->type,
                'variant_label' => $variant->label,
                'variant_image' => $variant->image_url,
                // Which stock was decremented, so a cancellation restores the same one.
                'variant_stock_tracked' => $variant->stock !== null,
            ] : [], $pricing);
        }
        // Fixed nationwide delivery fee, added once per order. Never taken from the request.
        $subtotal = round($subtotal, 2);
        $deliveryFee = round((float) config('shop.delivery_fee'), 2);
        $total = round($subtotal + $deliveryFee, 2);

        return compact('lines', 'orderLines', 'subtotal', 'deliveryFee', 'total');
    }

    /**
     * POST /api/orders/quote — the exact amounts the server will record for these lines
     * (offers, delivery fee, total). Nothing is saved.
     */
    public function quote(Request $request)
    {
        $request->validate([
            'products' => 'required|array|min:1',
            'products.*.id' => 'required',
            'products.*.quantity' => 'nullable|integer|min:1',
            'products.*.variant_id' => 'nullable|integer',
            'products.*.bundle_variants' => 'nullable|array',
        ]);

        try {
            $priced = $this->priceOrder($request->products);
        } catch (OrderRejected $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json($this->quotePayload($priced));
    }

    /** Amounts of a priced order, per line and in total, as shown in the checkout summary. */
    private function quotePayload(array $priced): array
    {
        $lines = array_map(fn ($line) => [
            'id' => $line['id'],
            'isDeal' => !empty($line['isDeal']),
            'name' => $line['name'],
            'variant_id' => $line['variant_id'] ?? null,
            'variant_label' => $line['variant_label'] ?? null,
            'quantity' => $line['quantity'],
            'unit_price' => $line['price'],
            'line_subtotal' => $line['line_subtotal'],
            'discount' => $line['offer_discount'],
            'line_total' => $line['line_total'],
        ], $priced['orderLines']);

        return [
            'lines' => $lines,
            // Before offers, offer savings, after offers.
            'products_subtotal' => round(array_sum(array_column($lines, 'line_subtotal')), 2),
            'discount' => round(array_sum(array_column($lines, 'discount')), 2),
            'subtotal' => $priced['subtotal'],
            'delivery_fee' => $priced['deliveryFee'],
            'total' => $priced['total'],
            'items' => array_sum(array_column($lines, 'quantity')),
        ];
    }

    /**
     * Units to take from each stock source for the given order lines:
     * a cable variant with its own stock, else the product / deal; packs draw on their items.
     *
     * @return array<string, array{model: \Illuminate\Database\Eloquent\Model, quantity: int, name: string}>
     */
    private function stockDemands(array $lines): array
    {
        $demands = [];
        $add = function ($model, int $quantity, string $name) use (&$demands) {
            $key = get_class($model) . ':' . $model->getKey();
            $demands[$key] ??= ['model' => $model, 'quantity' => 0, 'name' => $name];
            $demands[$key]['quantity'] += $quantity;
        };

        foreach ($lines as $line) {
            $model = $line['model'];
            $variant = $line['variant'];
            if ($variant && $variant->stock !== null) {
                $add($variant, $line['quantity'], $model->name . ' (' . $variant->label . ')');
            } elseif ($line['isDeal'] && $model->isBundle()) {
                foreach ($model->bundleItems as $row) {
                    $chosen = $line['bundleChoices'][$row->id] ?? null;
                    $item = $row->item();
                    // The chosen cable's own stock, else the product's / bundled deal's stock.
                    $chosen && $chosen->stock !== null
                        ? $add($chosen, $line['quantity'] * $row->units(), $item->name . ' (' . $chosen->label . ')')
                        : $add($item, $line['quantity'] * $row->units(), $item->name);
                }
            } else {
                $add($model, $line['quantity'], $model->name);
            }
        }

        return $demands;
    }

    /** Take the ordered units from each stock source (may go negative = units still to source). */
    private function takeStock(array $demands): void
    {
        foreach ($demands as $demand) {
            $demand['model']->newQuery()->whereKey($demand['model']->getKey())->decrement('stock', $demand['quantity']);
        }
    }

    private function queueCustomerConfirmation(Order $order): void
    {
        if (!OrderConfirmation::deliverableEmail($order->client_data['email'] ?? null)) {
            return; // No (valid) email given: nothing to send.
        }

        try {
            SendOrderConfirmationEmail::dispatch($order->id);
        } catch (\Throwable $e) {
            Log::error('Failed to queue order confirmation email', [
                'order_id' => $order->id,
                'error' => $e->getMessage(),
            ]);
        }
    }

    public function updateStatus(Request $request, $id)
    {
        $request->validate([
            'status' => 'required|in:ongoing,done,cancelled,shipped,refunded',
        ]);

        $order = Order::findOrFail($id);
        $oldStatus = $order->status;

        // Restore stock if order is being cancelled or refunded (and wasn't already)
        if (in_array($request->status, ['cancelled', 'refunded']) && !in_array($oldStatus, ['cancelled', 'refunded'])) {
            $products = is_array($order->products) ? $order->products : json_decode($order->products, true);
            if ($products) {
                foreach ($products as $item) {
                    $quantity = $item['quantity'] ?? 1;
                    $isDeal = !empty($item['isDeal']) || !empty($item['oldPrice']) || !empty($item['old_price']);

                    if ($isDeal && ($item['deal_type'] ?? null) === Deal::TYPE_BUNDLE) {
                        // Bundles take stock from their items, so give it back to the same place.
                        foreach ($item['bundle_items'] ?? [] as $bundleItem) {
                            $units = $quantity * (int) ($bundleItem['quantity'] ?? 1);
                            $variant = !empty($bundleItem['variant_id']) && !empty($bundleItem['variant_stock_tracked'])
                                ? ProductVariant::where('product_id', $bundleItem['id'] ?? 0)->find($bundleItem['variant_id'])
                                : null;
                            if ($variant && $variant->stock !== null) {
                                $variant->increment('stock', $units);
                            } elseif (($bundleItem['kind'] ?? DealBundleItem::KIND_PRODUCT) === DealBundleItem::KIND_DEAL) {
                                Deal::find($bundleItem['id'] ?? 0)?->increment('stock', $units);
                            } else {
                                Product::find($bundleItem['id'] ?? 0)?->increment('stock', $units);
                            }
                        }
                    } elseif ($isDeal) {
                        $deal = Deal::find($item['id']);
                        if ($deal) {
                            $deal->increment('stock', $quantity);
                        }
                    } elseif (!empty($item['variant_id']) && !empty($item['variant_stock_tracked'])
                        && ($variant = ProductVariant::where('product_id', $item['id'])->find($item['variant_id']))
                        && $variant->stock !== null) {
                        $variant->increment('stock', $quantity);
                    } else {
                        $product = Product::find($item['id']);
                        if ($product) {
                            $product->increment('stock', $quantity);
                        }
                    }
                }
            }
        }

        $order->update(['status' => $request->status]);

        return response()->json($order->load('client'));
    }

    private function stripProductImages($orders)
    {
        return $orders->map(function ($order) {
            $products = is_array($order->products)
                ? $order->products
                : json_decode($order->products, true);

            if (is_array($products)) {
                $order->products = array_map(function ($p) {
                    unset($p['images'], $p['image'], $p['gallery'], $p['description'], $p['specs'], $p['reviews']);
                    return $p;
                }, $products);
            }
            return $order;
        });
    }

    public function index()
    {
        $orders = Order::with('client')->get();
        return response()->json($this->stripProductImages($orders));
    }

    public function webIndex()
    {
        $orders = Order::with('client')->get();
        return view('orders.index', compact('orders'));
    }

    public function history()
    {
        $orders = Order::with('client')->whereIn('status', ['done', 'cancelled', 'shipped', 'refunded'])->get();
        return response()->json($this->stripProductImages($orders));
    }

    public function webHistory()
    {
        $orders = Order::with('client')->whereIn('status', ['done', 'cancelled', 'shipped', 'refunded'])->get();
        return view('orders.history', compact('orders'));
    }

    /** Orders whose items still have to be prepared: new (pending) and confirmed (ongoing). */
    public const TO_PREPARE_STATUSES = ['pending', 'ongoing'];

    /**
     * GET /api/orders/merchandise — units to prepare per catalogue item over all orders
     * that are not shipped, done, cancelled or refunded. Packs count as their items.
     * Items are grouped by product / deal id (not name), with the orders that need them.
     */
    public function merchandise()
    {
        $orders = Order::with('client')
            ->whereIn('status', self::TO_PREPARE_STATUSES)
            ->orderBy('id')
            ->get();

        $groups = [];
        $add = function (array $line, int $units, Order $order, ?string $via) use (&$groups) {
            if ($units <= 0 || !isset($line['id'])) {
                return;
            }
            $kind = !empty($line['isDeal']) || ($line['kind'] ?? null) === DealBundleItem::KIND_DEAL ? 'deal' : 'product';
            $key = $kind . '-' . $line['id'];
            $groups[$key] ??= [
                'key' => $key,
                'kind' => $kind,
                'id' => (int) $line['id'],
                'name' => (string) ($line['name'] ?? ''),
                'total' => 0,
                'confirmed' => 0,
                'pending' => 0,
                'variants' => [],
                'orders' => [],
            ];
            $group = &$groups[$key];
            $group['total'] += $units;
            $group[$order->status === 'ongoing' ? 'confirmed' : 'pending'] += $units;
            $variant = $line['variant_label'] ?? null;
            if ($variant) {
                $group['variants'][$variant] = ($group['variants'][$variant] ?? 0) + $units;
            }
            $group['orders'][] = [
                'order_id' => $order->id,
                'status' => $order->status,
                'quantity' => $units,
                'variant_label' => $variant,
                'via_pack' => $via,
                'customer' => $order->client_data['name'] ?? $order->client?->name,
                'city' => $order->client_data['city'] ?? null,
                'created_at' => $order->created_at?->toIso8601String(),
            ];
            unset($group);
        };

        foreach ($orders as $order) {
            foreach ((is_array($order->products) ? $order->products : []) as $line) {
                $quantity = max((int) ($line['quantity'] ?? 1), 1);
                if (($line['deal_type'] ?? null) === Deal::TYPE_BUNDLE) {
                    // A pack is prepared as its items: ×(pack quantity × units per pack).
                    foreach ($line['bundle_items'] ?? [] as $item) {
                        $add($item, $quantity * max((int) ($item['quantity'] ?? 1), 1), $order, $line['name'] ?? null);
                    }
                } else {
                    $add($line, $quantity, $order, null);
                }
            }
        }

        // Current name, picture and stock left from the catalogue (the item may have been renamed).
        $ids = fn ($kind) => collect($groups)->where('kind', $kind)->pluck('id')->all();
        $catalogue = [
            'product' => Product::with('variants')->whereIn('id', $ids('product'))->get()->keyBy('id'),
            'deal' => Deal::whereIn('id', $ids('deal'))->get()->keyBy('id'),
        ];

        $items = collect($groups)->map(function ($group) use ($catalogue) {
            $model = $catalogue[$group['kind']][$group['id']] ?? null;
            $images = $model && is_array($model->images) ? $model->images : [];
            $group['name'] = $model->name ?? $group['name'];
            $group['image'] = $images[0] ?? null;
            // Stock already has every open order taken off, and may be negative: −3 = 3 units
            // sold that are not in the shop. Cable types with their own stock count separately.
            $sources = $model ? collect([$model])->concat(
                $model instanceof Product ? $model->variants->whereNotNull('stock') : []
            ) : collect();
            $group['in_stock'] = $model ? (int) $sources->sum(fn ($s) => max((int) $s->stock, 0)) : null;
            $group['to_source'] = (int) $sources->sum(fn ($s) => max(-(int) $s->stock, 0));
            $group['orders_count'] = collect($group['orders'])->pluck('order_id')->unique()->count();
            $group['variants'] = collect($group['variants'])
                ->map(fn ($units, $label) => ['label' => $label, 'quantity' => $units])
                ->values()->all();
            return $group;
        })->sortBy([['total', 'desc'], ['name', 'asc']])->values();

        return response()->json([
            'statuses' => self::TO_PREPARE_STATUSES,
            'orders_count' => $orders->count(),
            'pending_orders' => $orders->where('status', 'pending')->count(),
            'confirmed_orders' => $orders->where('status', 'ongoing')->count(),
            'total_units' => $items->sum('total'),
            'total_to_source' => $items->sum('to_source'),
            'items' => $items,
            'generated_at' => now()->toIso8601String(),
        ]);
    }

    public function stats()
    {
        $total = Order::count();
        $pending = Order::where('status', 'pending')->count();
        $ongoing = Order::where('status', 'ongoing')->count();
        $done = Order::where('status', 'done')->count();
        $shipped = Order::where('status', 'shipped')->count();
        $cancelled = Order::where('status', 'cancelled')->count();
        $refunded = Order::where('status', 'refunded')->count();
        // Sales = product revenue. Delivery fees are passed on to the courier, so they
        // are reported separately and never counted as sales.
        $totalSales = Order::where('status', 'shipped')->sum(DB::raw(self::PRODUCT_REVENUE_SQL));
        $monthSales = Order::where('status', 'shipped')
            ->whereMonth('created_at', now()->month)
            ->whereYear('created_at', now()->year)
            ->sum(DB::raw(self::PRODUCT_REVENUE_SQL));
        $totalDeliveryFees = Order::where('status', 'shipped')->sum('delivery_fee');
        $totalCustomers = Client::count();
        $totalProducts = Product::count() + Deal::count();
        $totalDeals = Deal::count();

        return response()->json([
            'total' => $total,
            'pending' => $pending,
            'ongoing' => $ongoing,
            'done' => $done,
            'shipped' => $shipped,
            'cancelled' => $cancelled,
            'refunded' => $refunded,
            'total_sales' => round((float) $totalSales, 2),
            'month_sales' => round((float) $monthSales, 2),
            'total_delivery_fees' => round((float) $totalDeliveryFees, 2),
            'total_orders' => $total,
            'total_customers' => $totalCustomers,
            'total_products' => $totalProducts,
            'total_deals' => $totalDeals,
        ]);
    }

    public function monthlySales(Request $request)
    {
        $year = $request->query('year', now()->year);

        $months = [];
        for ($m = 1; $m <= 12; $m++) {
            $sales = Order::where('status', 'shipped')
                ->whereMonth('created_at', $m)
                ->whereYear('created_at', $year)
                ->sum(DB::raw(self::PRODUCT_REVENUE_SQL));
            $count = Order::where('status', 'shipped')
                ->whereMonth('created_at', $m)
                ->whereYear('created_at', $year)
                ->count();
            $months[] = [
                'month' => $m,
                'sales' => (float) $sales,
                'orders' => $count,
            ];
        }

        return response()->json([
            'year' => (int) $year,
            'months' => $months,
        ]);
    }
}
