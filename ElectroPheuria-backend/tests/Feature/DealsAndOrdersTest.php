<?php

namespace Tests\Feature;

use App\Models\Deal;
use App\Models\Order;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class DealsAndOrdersTest extends TestCase
{
    use RefreshDatabase;

    private function actingAsAdmin(): void
    {
        Sanctum::actingAs(User::factory()->create());
    }

    private function dealPayload(array $overrides = []): array
    {
        return array_merge([
            'name' => 'Test Earbuds Deal',
            'oldPrice' => 299,
            'price' => 149.5,
            'discount' => 10, // deliberately wrong: the server must recompute it
            'stock' => 5,
            'categories' => ['golden'],
            'images' => [],
        ], $overrides);
    }

    public function test_deal_discount_is_computed_from_manual_prices(): void
    {
        $this->actingAsAdmin();

        $res = $this->postJson('/api/deals', $this->dealPayload())->assertCreated();

        $deal = Deal::find($res->json('id'));
        $this->assertEquals(299.0, $deal->old_price);
        $this->assertEquals(149.5, $deal->price);
        $this->assertSame(50, $deal->discount);
        $this->assertTrue($deal->active);
    }

    public function test_deal_rejects_invalid_prices(): void
    {
        $this->actingAsAdmin();

        $this->postJson('/api/deals', $this->dealPayload(['price' => 299]))
            ->assertStatus(422)->assertJsonValidationErrors('price');
        $this->postJson('/api/deals', $this->dealPayload(['price' => 400]))
            ->assertStatus(422)->assertJsonValidationErrors('price');
        $this->postJson('/api/deals', $this->dealPayload(['price' => -5]))
            ->assertStatus(422)->assertJsonValidationErrors('price');
        $this->postJson('/api/deals', $this->dealPayload(['oldPrice' => 0]))
            ->assertStatus(422)->assertJsonValidationErrors('old_price');
        $this->postJson('/api/deals', $this->dealPayload(['price' => null]))
            ->assertStatus(422)->assertJsonValidationErrors('price');

        $this->assertSame(0, Deal::count());
    }

    public function test_deal_update_recomputes_discount(): void
    {
        $this->actingAsAdmin();
        $id = $this->postJson('/api/deals', $this->dealPayload())->json('id');

        $this->putJson("/api/deals/{$id}", $this->dealPayload(['id' => $id, 'oldPrice' => 100, 'price' => 67.5]))
            ->assertOk();

        $this->assertSame(33, Deal::find($id)->discount);
    }

    public function test_inactive_deals_are_hidden_from_public_but_visible_to_admin(): void
    {
        $this->actingAsAdmin();
        $id = $this->postJson('/api/deals', $this->dealPayload(['active' => false]))->json('id');

        // Admin can still open it.
        $this->getJson("/api/deals/{$id}")->assertOk()->assertJsonPath('active', false);

        // Public visitor gets 404 and cannot order it.
        $this->app['auth']->forgetGuards();
        $this->getJson("/api/deals/{$id}")->assertNotFound();

        Mail::fake();
        $this->postJson('/api/orders', [
            'client' => ['name' => 'Test', 'phone' => '0600000000', 'address' => 'Fès', 'city' => 'Fès', 'delivery_address' => '12 Rue Test, Apt 3'],
            'products' => [['id' => $id, 'name' => 'x', 'price' => 149.5, 'quantity' => 1, 'isDeal' => true]],
            'total_price' => 149.5,
        ])->assertStatus(422);
        $this->assertSame(0, Order::count());
    }

    private function makeDeal(array $attrs = []): Deal
    {
        return Deal::create(array_merge([
            'name' => 'Deal', 'description' => '', 'old_price' => 200, 'price' => 200, 'discount' => 0,
            'offer_type' => 'standard', 'stock' => 50, 'categories' => [], 'images' => [], 'reviews' => '',
            'specs' => [], 'gallery' => [], 'active' => true,
        ], $attrs));
    }

    private function order(array $products, $total = 1)
    {
        return $this->postJson('/api/orders', [
            'client' => ['name' => 'Test', 'phone' => '0633333333', 'address' => 'Rabat', 'city' => 'Rabat', 'delivery_address' => '12 Rue Test, Apt 3'],
            'products' => $products,
            'total_price' => $total,
        ]);
    }

    public function test_bogo_deal_is_stored_without_promo_price(): void
    {
        $this->actingAsAdmin();

        $id = $this->postJson('/api/deals', $this->dealPayload(['offer_type' => 'bogo_half', 'price' => 200, 'oldPrice' => 500]))
            ->assertCreated()->json('id');

        $deal = Deal::find($id);
        $this->assertSame('bogo_half', $deal->offer_type);
        $this->assertEquals(200.0, $deal->price);
        $this->assertEquals(200.0, $deal->old_price); // no stacked promo price
        $this->assertSame(0, $deal->discount);

        $this->postJson('/api/deals', $this->dealPayload(['offer_type' => 'bogo_half', 'price' => 0]))
            ->assertStatus(422)->assertJsonValidationErrors('price');
        $this->postJson('/api/deals', $this->dealPayload(['offer_type' => 'something_else']))
            ->assertStatus(422)->assertJsonValidationErrors('offer_type');
    }

    public function test_deal_update_keeps_offer_type_when_not_sent_and_can_switch_back(): void
    {
        $this->actingAsAdmin();
        $deal = $this->makeDeal(['offer_type' => 'bogo_half']);

        $this->putJson("/api/deals/{$deal->id}", ['id' => $deal->id, 'name' => 'Deal', 'price' => 180])->assertOk();
        $this->assertSame('bogo_half', $deal->fresh()->offer_type);

        $this->putJson("/api/deals/{$deal->id}", ['id' => $deal->id, 'name' => 'Deal', 'offer_type' => 'standard', 'oldPrice' => 300, 'price' => 150])->assertOk();
        $fresh = $deal->fresh();
        $this->assertSame('standard', $fresh->offer_type);
        $this->assertSame(50, $fresh->discount);
    }

    public function test_charm_price_rounds_down_to_ending_in_9(): void
    {
        $this->assertSame(439.0, \App\Support\OfferPricing::charmPrice(447.50));
        $this->assertSame(449.0, \App\Support\OfferPricing::charmPrice(449.00));
        $this->assertSame(289.0, \App\Support\OfferPricing::charmPrice(298.50));
        $this->assertSame(299.0, \App\Support\OfferPricing::charmPrice(300.00));
        $this->assertSame(589.0, \App\Support\OfferPricing::charmPrice(597.00));

        // Single items and standard deals are never rounded.
        $this->assertSame(200.0, \App\Support\OfferPricing::line(200, 1, 'bogo_half')['line_total']);
        $this->assertSame(657.0, \App\Support\OfferPricing::line(219, 3, 'standard')['line_total']);
    }

    public function test_bogo_order_totals_for_quantities_1_to_4(): void
    {
        Mail::fake();
        $deal = $this->makeDeal(['offer_type' => 'bogo_half', 'price' => 199, 'old_price' => 199]);

        // 199, 298.50 → 289, 497.50 → 489, 597 → 589
        foreach ([1 => 199.0, 2 => 289.0, 3 => 489.0, 4 => 589.0] as $qty => $expected) {
            // Client sends a bogus total and unit price; both must be ignored.
            $res = $this->order([['id' => $deal->id, 'name' => 'x', 'price' => 1, 'quantity' => $qty, 'isDeal' => true]], 1)
                ->assertCreated();

            $order = Order::find($res->json('id'));
            $this->assertEquals($expected, (float) $order->subtotal, "qty $qty");
            $this->assertEquals($expected, $order->products[0]['line_total']);
            $this->assertEquals(199 * $qty - $expected, $order->products[0]['offer_discount']);
            $this->assertSame('bogo_half', $order->products[0]['offer_type']);
        }
    }

    public function test_standard_deal_order_uses_database_price(): void
    {
        Mail::fake();
        $deal = $this->makeDeal(['old_price' => 438, 'price' => 219, 'discount' => 50]);

        $res = $this->order([['id' => $deal->id, 'name' => 'x', 'price' => 1, 'quantity' => 3, 'oldPrice' => 438]], 3)
            ->assertCreated();

        $order = Order::find($res->json('id'));
        $this->assertEquals(657.0, (float) $order->subtotal); // 3 × 219, no 1+1 discount
        $this->assertEquals(0, $order->products[0]['offer_discount']);
        $this->assertSame(47, $deal->fresh()->stock);
    }

    public function test_split_lines_of_same_bogo_item_are_merged(): void
    {
        Mail::fake();
        $deal = $this->makeDeal(['offer_type' => 'bogo_half', 'price' => 200, 'old_price' => 200]);

        $res = $this->order([
            ['id' => $deal->id, 'quantity' => 1, 'isDeal' => true],
            ['id' => $deal->id, 'quantity' => 1, 'isDeal' => true],
        ])->assertCreated();

        $this->assertEquals(299.0, (float) Order::find($res->json('id'))->subtotal); // 300 → 299
    }

    public function test_bogo_fixed_deal_validates_and_stores_second_item_price(): void
    {
        $this->actingAsAdmin();

        $id = $this->postJson('/api/deals', $this->dealPayload(['offer_type' => 'bogo_fixed', 'price' => 199, 'oldPrice' => 500, 'second_item_price' => 50]))
            ->assertCreated()->json('id');

        $deal = Deal::find($id);
        $this->assertSame('bogo_fixed', $deal->offer_type);
        $this->assertEquals(199.0, $deal->old_price);
        $this->assertEquals(50.0, $deal->second_item_price);
        $this->assertSame(0, $deal->discount);

        $this->postJson('/api/deals', $this->dealPayload(['offer_type' => 'bogo_fixed', 'price' => 199]))
            ->assertStatus(422)->assertJsonValidationErrors('second_item_price');
        $this->postJson('/api/deals', $this->dealPayload(['offer_type' => 'bogo_fixed', 'price' => 199, 'second_item_price' => 199]))
            ->assertStatus(422)->assertJsonValidationErrors('second_item_price');

        // Switching back to a standard deal clears the second item price.
        $this->putJson("/api/deals/{$id}", ['id' => $id, 'name' => 'Deal', 'offer_type' => 'standard', 'oldPrice' => 300, 'price' => 150])->assertOk();
        $this->assertNull($deal->fresh()->second_item_price);
    }

    public function test_bogo_fixed_order_totals_for_quantities_1_to_4(): void
    {
        Mail::fake();
        $deal = $this->makeDeal(['offer_type' => 'bogo_fixed', 'price' => 199, 'old_price' => 199, 'second_item_price' => 50]);

        foreach ([1 => 199.0, 2 => 249.0, 3 => 448.0, 4 => 498.0] as $qty => $expected) {
            $res = $this->order([['id' => $deal->id, 'name' => 'x', 'price' => 1, 'quantity' => $qty, 'isDeal' => true]], 1)
                ->assertCreated();

            $order = Order::find($res->json('id'));
            $this->assertEquals($expected, (float) $order->subtotal, "qty $qty");
            $this->assertSame('bogo_fixed', $order->products[0]['offer_type']);
            $this->assertEquals(199 * $qty - $expected, $order->products[0]['offer_discount']);
        }
    }

    public function test_unknown_item_is_rejected(): void
    {
        $this->order([['id' => 999999, 'name' => 'ghost', 'price' => 1, 'quantity' => 1]])->assertStatus(422);
        $this->assertSame(0, Order::count());
    }

    public function test_order_saves_city_outside_casablanca(): void
    {
        Mail::fake();
        $deal = $this->makeDeal();

        $this->postJson('/api/orders', [
            'client' => ['name' => 'Test Client', 'phone' => '0611111111', 'address' => 'Agadir', 'city' => 'Agadir', 'delivery_address' => '12 Rue Test, Apt 3'],
            'products' => [['id' => $deal->id, 'name' => 'Item', 'price' => 100, 'quantity' => 1, 'isDeal' => true]],
            'total_price' => 100,
        ])->assertCreated();

        $order = Order::first();
        $this->assertSame('Agadir', $order->client_data['city']);
        $this->assertSame('12 Rue Test, Apt 3', $order->client_data['delivery_address']);
        $this->assertSame('12 Rue Test, Apt 3', $order->delivery_address);
        $this->assertSame('12 Rue Test, Apt 3, Agadir', $order->client->address);
    }

    public function test_order_requires_city(): void
    {
        $this->postJson('/api/orders', [
            'client' => ['name' => 'Test', 'phone' => '0622222222'],
            'products' => [['id' => 1, 'name' => 'Item', 'price' => 100, 'quantity' => 1]],
            'total_price' => 100,
        ])->assertStatus(422)->assertJsonValidationErrors(['client.city', 'client.delivery_address']);
    }
}
