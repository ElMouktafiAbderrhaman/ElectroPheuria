<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Queue;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Ad → product → "Purchase Now" → checkout flow (any quantity the stock allows)
 * and the dashboard "Products to prepare" totals.
 */
class PurchaseFlowTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Mail::fake();
        Queue::fake();
    }

    private function product(array $attrs = []): Product
    {
        return Product::create(array_merge([
            'name' => 'AirPods 4', 'price' => 149, 'description' => '', 'stock' => 50, 'category' => 'pods',
            'images' => ['https://cdn.example/airpods.jpg'], 'reviews' => '', 'specs' => [], 'gallery' => [],
        ], $attrs));
    }

    private function order(array $products, string $phone = '0633333333')
    {
        return $this->postJson('/api/orders', [
            'client' => ['name' => 'Client ' . $phone, 'phone' => $phone, 'city' => 'Rabat', 'delivery_address' => '12 Rue Test, Apt 3'],
            'products' => $products,
        ]);
    }

    private function merchandise(): array
    {
        Sanctum::actingAs(User::factory()->create());
        return $this->getJson('/api/orders/merchandise')->assertOk()->json();
    }

    private function units(array $report, Product $product): int
    {
        return collect($report['items'])->firstWhere('key', 'product-' . $product->id)['total'] ?? 0;
    }

    // ───────────── Quantities and stock ─────────────

    public function test_quantity_above_the_old_limit_of_100_is_accepted_when_in_stock(): void
    {
        $p = $this->product(['price' => 10, 'stock' => 500]);

        $res = $this->order([['id' => $p->id, 'quantity' => 150]])->assertCreated();

        $res->assertJsonPath('subtotal', 1500)->assertJsonPath('total_price', 1520);
        $this->assertSame(350, $p->fresh()->stock);
    }

    public function test_zero_negative_and_fractional_quantities_are_rejected(): void
    {
        $p = $this->product();
        foreach ([0, -2, 1.5, 'abc'] as $qty) {
            $this->order([['id' => $p->id, 'quantity' => $qty]])->assertStatus(422);
        }
        $this->assertSame(0, Order::count());
        $this->assertSame(50, $p->fresh()->stock);
    }

    public function test_stock_never_limits_what_a_customer_orders(): void
    {
        $p = $this->product(['stock' => 3]);

        // 10 ordered with 3 in stock: accepted, stock shows 7 units still to source.
        $this->order([['id' => $p->id, 'quantity' => 10]])->assertCreated();
        $this->assertSame(-7, $p->fresh()->stock);

        // Sold out (and below): still orderable.
        $this->order([['id' => $p->id, 'quantity' => 2], ['id' => $p->id, 'quantity' => 1]], '0622222222')->assertCreated();
        $this->assertSame(-10, $p->fresh()->stock);
    }

    public function test_cancelling_gives_back_exactly_what_was_taken(): void
    {
        $p = $this->product(['stock' => 3]);
        $id = $this->order([['id' => $p->id, 'quantity' => 10]])->assertCreated()->json('id');
        Sanctum::actingAs(User::factory()->create());
        $this->putJson("/api/orders/{$id}/status", ['status' => 'cancelled'])->assertOk();
        $this->assertSame(3, $p->fresh()->stock);
    }

    public function test_prices_sent_by_the_browser_are_ignored(): void
    {
        $p = $this->product(['price' => 149, 'stock' => 10]);
        $this->postJson('/api/orders', [
            'client' => ['name' => 'X', 'phone' => '0612345678', 'city' => 'Rabat', 'delivery_address' => '12 Rue Test'],
            'products' => [['id' => $p->id, 'price' => 1, 'quantity' => 5]],
            'total_price' => 5,
            'delivery_fee' => 0,
        ])->assertCreated()
            ->assertJsonPath('products.0.price', 149)
            ->assertJsonPath('subtotal', 745)
            ->assertJsonPath('delivery_fee', 20)
            ->assertJsonPath('total_price', 765);
    }

    // ───────────── Checkout quote & confirmed total ─────────────

    public function test_quote_returns_the_exact_amounts_the_order_records(): void
    {
        $p = $this->product(['price' => 149, 'stock' => 10]);
        $deal = \App\Models\Deal::create([
            'name' => 'Power Bank 1+1', 'description' => '', 'old_price' => 0, 'price' => 199, 'discount' => 0,
            'offer_type' => 'bogo_half', 'stock' => 10, 'categories' => [], 'images' => [], 'reviews' => '',
            'specs' => [], 'gallery' => [], 'active' => true,
        ]);
        $products = [['id' => $p->id, 'quantity' => 2, 'price' => 1], ['id' => $deal->id, 'isDeal' => true, 'quantity' => 3]];

        $quote = $this->postJson('/api/orders/quote', ['products' => $products])->assertOk()->json();

        $this->assertEquals(298 + 597, $quote['products_subtotal']);   // before offers
        $this->assertEquals(108, $quote['discount']);                  // 597 → 489 (2nd at -50%, charm price)
        $this->assertEquals(20, $quote['delivery_fee']);
        $this->assertEquals(298 + 489 + 20, $quote['total']);
        $this->assertSame(5, $quote['items']);
        $this->assertEquals([149, 199], array_column($quote['lines'], 'unit_price'));
        $this->assertSame(0, Order::count());                          // nothing saved
        $this->assertSame(10, $p->fresh()->stock);

        $order = $this->postJson('/api/orders', [
            'client' => ['name' => 'X', 'phone' => '0612345678', 'city' => 'Rabat', 'delivery_address' => '12 Rue Test'],
            'products' => $products,
            'expected_total' => $quote['total'],
        ])->assertCreated()->json();
        $this->assertEquals($quote['total'], $order['total_price']);
    }

    public function test_quote_ignores_stock(): void
    {
        $p = $this->product(['stock' => 0]);
        $this->postJson('/api/orders/quote', ['products' => [['id' => $p->id, 'quantity' => 30]]])
            ->assertOk()->assertJsonPath('total', 30 * 149 + 20);
    }

    public function test_to_prepare_shows_units_in_stock_and_units_to_source(): void
    {
        $airpods = $this->product(['stock' => 5]);
        $this->order([['id' => $airpods->id, 'quantity' => 8]], '0611111111')->assertCreated();

        $item = collect($this->merchandise()['items'])->firstWhere('key', 'product-' . $airpods->id);
        $this->assertSame(8, $item['total']);
        $this->assertSame(0, $item['in_stock']);
        $this->assertSame(3, $item['to_source']);   // 8 sold, 5 were in stock
    }

    public function test_order_is_refused_when_the_confirmed_total_is_no_longer_right(): void
    {
        $p = $this->product(['price' => 149, 'stock' => 10]);
        $p->update(['price' => 159]); // price changed after the customer saw 149 × 2 + 20 = 318

        $this->postJson('/api/orders', [
            'client' => ['name' => 'X', 'phone' => '0612345678', 'city' => 'Rabat', 'delivery_address' => '12 Rue Test'],
            'products' => [['id' => $p->id, 'quantity' => 2]],
            'expected_total' => 318,
        ])->assertStatus(409)
            ->assertJsonPath('code', 'total_changed')
            ->assertJsonPath('quote.total', 338);

        $this->assertSame(0, Order::count());
        $this->assertSame(10, $p->fresh()->stock);
    }

    // ───────────── Products to prepare ─────────────

    public function test_acceptance_scenario_five_then_eight_then_recalculated(): void
    {
        $airpods = $this->product(['stock' => 50]);
        $adapter = $this->product(['name' => 'Apple 20W Adapter', 'price' => 99, 'stock' => 50]);

        // Customer 1: AirPods 4 × 5 from the ad.
        $first = $this->order([['id' => $airpods->id, 'quantity' => 5]], '0611111111')->assertCreated()->json('id');
        $report = $this->merchandise();
        $this->assertSame(5, $this->units($report, $airpods));
        $this->assertSame(1, $report['orders_count']);

        // Customer 2: 3 more → 8.
        $second = $this->order([['id' => $airpods->id, 'quantity' => 3], ['id' => $adapter->id, 'quantity' => 2]], '0622222222')
            ->assertCreated()->json('id');
        $report = $this->merchandise();
        $this->assertSame(8, $this->units($report, $airpods));
        $this->assertSame(2, $this->units($report, $adapter));
        $this->assertSame(10, $report['total_units']);
        $this->assertSame(2, $report['orders_count']);

        $item = collect($report['items'])->firstWhere('key', 'product-' . $airpods->id);
        $this->assertSame('AirPods 4', $item['name']);
        $this->assertSame('https://cdn.example/airpods.jpg', $item['image']);
        $this->assertSame([[$first, 5], [$second, 3]], array_map(fn ($o) => [$o['order_id'], $o['quantity']], $item['orders']));
        $this->assertSame('Client 0611111111', $item['orders'][0]['customer']);
        // Largest requirement first.
        $this->assertSame('product-' . $airpods->id, $report['items'][0]['key']);

        // Confirming an order keeps it in the list (split into confirmed / pending).
        $this->putJson("/api/orders/{$first}/status", ['status' => 'ongoing'])->assertOk();
        $item = collect($this->merchandise()['items'])->firstWhere('key', 'product-' . $airpods->id);
        $this->assertSame([8, 5, 3], [$item['total'], $item['confirmed'], $item['pending']]);

        // Cancelled → no longer required.
        $this->putJson("/api/orders/{$second}/status", ['status' => 'cancelled'])->assertOk();
        $report = $this->merchandise();
        $this->assertSame(5, $this->units($report, $airpods));
        $this->assertSame(0, $this->units($report, $adapter));

        // Shipped (fulfilled) → nothing left to prepare.
        $this->putJson("/api/orders/{$first}/status", ['status' => 'shipped'])->assertOk();
        $report = $this->merchandise();
        $this->assertSame([], $report['items']);
        $this->assertSame(0, $report['total_units']);
        $this->assertSame(0, $report['orders_count']);
    }

    public function test_done_and_refunded_orders_are_not_counted(): void
    {
        $p = $this->product();
        $done = $this->order([['id' => $p->id, 'quantity' => 2]], '0611111111')->json('id');
        $refunded = $this->order([['id' => $p->id, 'quantity' => 4]], '0622222222')->json('id');
        Order::find($done)->update(['status' => 'done']);
        Order::find($refunded)->update(['status' => 'refunded']);

        $this->assertSame([], $this->merchandise()['items']);
    }

    public function test_items_are_grouped_by_id_not_by_name(): void
    {
        $black = $this->product(['name' => 'Earbuds']);
        $white = $this->product(['name' => 'Earbuds']);
        $this->order([['id' => $black->id, 'quantity' => 2], ['id' => $white->id, 'quantity' => 1]])->assertCreated();

        $report = $this->merchandise();
        $this->assertCount(2, $report['items']);
        $this->assertSame(2, $this->units($report, $black));
        $this->assertSame(1, $this->units($report, $white));
    }

    public function test_packs_count_as_their_items(): void
    {
        $airpods = $this->product(['stock' => 20]);
        $charger = $this->product(['name' => 'Fast Charger', 'price' => 99, 'stock' => 20]);
        Sanctum::actingAs(User::factory()->create());
        $pack = $this->postJson('/api/deals', [
            'deal_type' => 'bundle', 'name' => 'Pack', 'price' => 199, 'active' => true, 'categories' => ['golden'], 'images' => [],
            'bundle_product_ids' => [$airpods->id, $charger->id],
        ])->assertCreated()->json('id');

        $this->order([['id' => $pack, 'isDeal' => true, 'quantity' => 2], ['id' => $airpods->id, 'quantity' => 1]])->assertCreated();

        $report = $this->merchandise();
        $this->assertSame(3, $this->units($report, $airpods));
        $this->assertSame(2, $this->units($report, $charger));
        $item = collect($report['items'])->firstWhere('key', 'product-' . $airpods->id);
        $this->assertSame(1, $item['orders_count']);
        $this->assertNotNull(collect($item['orders'])->firstWhere('quantity', 2)['via_pack']);
    }

    public function test_merchandise_requires_authentication(): void
    {
        $this->getJson('/api/orders/merchandise')->assertUnauthorized();
    }

    // ───────────── "On route" status ─────────────

    public function test_order_moves_through_on_route_before_shipped(): void
    {
        $p = $this->product(['stock' => 10]);
        $id = $this->order([['id' => $p->id, 'quantity' => 3]])->assertCreated()->json('id');
        Sanctum::actingAs(User::factory()->create());

        $this->putJson("/api/orders/{$id}/status", ['status' => 'ongoing'])->assertOk();
        $this->putJson("/api/orders/{$id}/status", ['status' => 'on_route'])
            ->assertOk()->assertJsonPath('status', 'on_route');

        // Out with the courier: already prepared, not yet a sale.
        $this->assertSame([], $this->merchandise()['items']);
        $stats = $this->getJson('/api/stats')->assertOk()->json();
        $this->assertSame(1, $stats['on_route']);
        $this->assertSame(0, $stats['shipped']);

        $this->putJson("/api/orders/{$id}/status", ['status' => 'shipped'])->assertOk();
        $this->assertSame('shipped', Order::find($id)->status);
        $this->assertSame(7, $p->fresh()->stock);
    }

    public function test_cancelling_an_on_route_order_restores_stock(): void
    {
        $p = $this->product(['stock' => 10]);
        $id = $this->order([['id' => $p->id, 'quantity' => 4]])->json('id');
        Sanctum::actingAs(User::factory()->create());

        $this->putJson("/api/orders/{$id}/status", ['status' => 'on_route'])->assertOk();
        $this->assertSame(6, $p->fresh()->stock);

        $this->putJson("/api/orders/{$id}/status", ['status' => 'cancelled'])->assertOk();
        $this->assertSame(10, $p->fresh()->stock);
    }

    public function test_unknown_status_is_rejected(): void
    {
        $p = $this->product();
        $id = $this->order([['id' => $p->id, 'quantity' => 1]])->json('id');
        Sanctum::actingAs(User::factory()->create());

        $this->putJson("/api/orders/{$id}/status", ['status' => 'on-the-moon'])->assertUnprocessable();
    }
}
