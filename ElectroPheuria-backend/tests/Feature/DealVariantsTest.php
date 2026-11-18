<?php

namespace Tests\Feature;

use App\Models\Deal;
use App\Models\Order;
use App\Models\ProductVariant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/** Cable variants (Lightning / USB Type-C) on single deals: they share the deal's price and stock. */
class DealVariantsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Mail::fake();
        Storage::fake('public');
        Sanctum::actingAs(User::factory()->create());
    }

    private function uploadImage(): string
    {
        return $this->post('/api/product-variants/images', [
            'image' => UploadedFile::fake()->image('cable.jpg', 400, 400),
        ], ['Accept' => 'application/json'])->assertCreated()->json('path');
    }

    private function cableDeal(array $overrides = []): int
    {
        return $this->postJson('/api/deals', array_merge([
            'name' => 'Fast Charger Deal', 'oldPrice' => 199, 'price' => 149, 'stock' => 6,
            'categories' => ['golden'], 'images' => [], 'has_variants' => true,
            'variants' => [
                // Price / stock sent by a client are ignored for deals.
                ['type' => 'lightning', 'image_path' => $this->uploadImage(), 'price' => 999, 'stock' => 1, 'active' => true],
                ['type' => 'usb_c', 'image_path' => $this->uploadImage(), 'active' => true],
            ],
        ], $overrides))->assertCreated()->json('id');
    }

    private function order(array $line)
    {
        return $this->postJson('/api/orders', [
            'client' => ['name' => 'Test', 'phone' => '0633333333', 'city' => 'Casablanca', 'delivery_address' => 'Rue 12, Maarif'],
            'products' => [$line],
        ]);
    }

    public function test_deal_is_created_with_cable_variants_using_the_deal_price_and_stock(): void
    {
        $id = $this->cableDeal();

        $deal = $this->getJson("/api/deals/{$id}")->assertOk()->json();
        $this->assertTrue($deal['has_variants']);
        $this->assertSame(['lightning', 'usb_c'], array_column($deal['variants'], 'type'));
        $this->assertSame([null, null], array_column($deal['variants'], 'price'));
        $this->assertSame([null, null], array_column($deal['variants'], 'stock'));
        $this->assertNotNull($deal['variants'][0]['image_url']);

        $listed = collect($this->getJson('/api/deals')->json())->firstWhere('id', $id);
        $this->assertCount(2, $listed['variants']);
    }

    public function test_order_needs_a_cable_choice_and_takes_stock_from_the_deal(): void
    {
        $id = $this->cableDeal();
        $usbc = ProductVariant::where('deal_id', $id)->where('type', 'usb_c')->first();

        $this->order(['id' => $id, 'isDeal' => true, 'quantity' => 1])->assertStatus(422);

        $orderId = $this->order(['id' => $id, 'isDeal' => true, 'quantity' => 2, 'variant_id' => $usbc->id])
            ->assertCreated()->json('id');
        $line = Order::find($orderId)->products[0];
        $this->assertSame('USB Type-C', $line['variant_label']);
        $this->assertEquals(149, $line['price']);
        $this->assertEquals(298, (float) Order::find($orderId)->subtotal);
        $this->assertSame(4, Deal::find($id)->stock);

        // Cancelling gives the stock back to the deal.
        $this->putJson("/api/orders/{$orderId}/status", ['status' => 'cancelled'])->assertOk();
        $this->assertSame(6, Deal::find($id)->stock);
    }

    public function test_disabled_cable_or_a_variant_of_another_item_is_refused(): void
    {
        $id = $this->cableDeal();
        $lightning = ProductVariant::where('deal_id', $id)->where('type', 'lightning')->first();
        $lightning->update(['active' => false]);

        $this->order(['id' => $id, 'isDeal' => true, 'quantity' => 1, 'variant_id' => $lightning->id])->assertStatus(422);

        $other = $this->cableDeal(['name' => 'Other deal']);
        $foreign = ProductVariant::where('deal_id', $other)->where('type', 'usb_c')->first();
        $this->order(['id' => $id, 'isDeal' => true, 'quantity' => 1, 'variant_id' => $foreign->id])->assertStatus(422);
        $this->assertSame(0, Order::count());
    }

    public function test_variants_can_be_turned_off_and_are_removed_when_the_deal_becomes_a_bundle(): void
    {
        $id = $this->cableDeal();

        // Saving without the variants field (older dashboard) keeps them.
        $this->putJson("/api/deals/{$id}", ['name' => 'Fast Charger Deal', 'oldPrice' => 199, 'price' => 149, 'stock' => 6, 'categories' => ['golden']])->assertOk();
        $this->assertTrue(Deal::find($id)->has_variants);
        $this->assertSame(2, ProductVariant::where('deal_id', $id)->count());

        // Variants switched off: a plain deal again, orderable without a cable choice.
        $this->putJson("/api/deals/{$id}", ['name' => 'Fast Charger Deal', 'oldPrice' => 199, 'price' => 149, 'stock' => 6, 'categories' => ['golden'], 'has_variants' => false, 'variants' => []])->assertOk();
        $this->assertFalse(Deal::find($id)->has_variants);
        $this->order(['id' => $id, 'isDeal' => true, 'quantity' => 1])->assertCreated();

        // Back on, then converted into a bundle: its own variants are deleted.
        $this->putJson("/api/deals/{$id}", ['name' => 'Fast Charger Deal', 'oldPrice' => 199, 'price' => 149, 'stock' => 6, 'categories' => ['golden'], 'has_variants' => true,
            'variants' => [['type' => 'usb_c', 'image_path' => $this->uploadImage(), 'active' => true]]])->assertOk();
        $other = Deal::create(['name' => 'AirPods', 'description' => '', 'old_price' => 149, 'price' => 149, 'discount' => 0, 'stock' => 10,
            'categories' => ['pods'], 'images' => [], 'reviews' => '', 'specs' => [], 'gallery' => [], 'active' => true]);
        $single = Deal::create(['name' => 'Case', 'description' => '', 'old_price' => 50, 'price' => 50, 'discount' => 0, 'stock' => 10,
            'categories' => ['pods'], 'images' => [], 'reviews' => '', 'specs' => [], 'gallery' => [], 'active' => true]);
        $this->putJson("/api/deals/{$id}", ['deal_type' => 'bundle', 'name' => '', 'price' => 150, 'active' => true, 'categories' => ['golden'], 'images' => [],
            'bundle_items' => [['type' => 'deal', 'id' => $other->id], ['type' => 'deal', 'id' => $single->id]]])->assertOk();
        $this->assertFalse(Deal::find($id)->has_variants);
        $this->assertSame(0, ProductVariant::where('deal_id', $id)->count());
    }

    public function test_pack_containing_a_deal_with_cables_asks_for_the_cable(): void
    {
        $cableDealId = $this->cableDeal();
        $lightning = ProductVariant::where('deal_id', $cableDealId)->where('type', 'lightning')->first();
        $airpods = Deal::create(['name' => 'AirPods', 'description' => '', 'old_price' => 149, 'price' => 149, 'discount' => 0, 'stock' => 10,
            'categories' => ['pods'], 'images' => [], 'reviews' => '', 'specs' => [], 'gallery' => [], 'active' => true]);

        $packId = $this->postJson('/api/deals', ['deal_type' => 'bundle', 'name' => '', 'price' => 250, 'active' => true, 'categories' => ['golden'], 'images' => [],
            'bundle_items' => [['type' => 'deal', 'id' => $airpods->id], ['type' => 'deal', 'id' => $cableDealId]]])->assertCreated()->json('id');

        $pack = $this->getJson("/api/deals/{$packId}")->assertOk()->json();
        $this->assertSame([], $pack['bundle_products'][0]['variants']);
        $this->assertSame(['lightning', 'usb_c'], array_column($pack['bundle_products'][1]['variants'], 'type'));
        $this->assertSame([6, 6], array_column($pack['bundle_products'][1]['variants'], 'stock'));

        $this->order(['id' => $packId, 'isDeal' => true, 'quantity' => 1])->assertStatus(422);

        $orderId = $this->order(['id' => $packId, 'isDeal' => true, 'quantity' => 1, 'bundle_variants' => ["deal-{$cableDealId}" => $lightning->id]])
            ->assertCreated()->json('id');
        $items = Order::find($orderId)->products[0]['bundle_items'];
        $this->assertSame('Lightning', $items[1]['variant_label']);
        $this->assertSame(5, Deal::find($cableDealId)->stock);
        $this->assertSame(9, $airpods->fresh()->stock);

        $this->putJson("/api/orders/{$orderId}/status", ['status' => 'cancelled'])->assertOk();
        $this->assertSame(6, Deal::find($cableDealId)->stock);
    }

    public function test_deleting_a_deal_removes_its_cable_images(): void
    {
        $id = $this->cableDeal();
        $paths = ProductVariant::where('deal_id', $id)->pluck('image_path')->all();
        foreach ($paths as $p) {
            Storage::disk('public')->assertExists($p);
        }

        $this->deleteJson("/api/deals/{$id}")->assertOk();
        $this->assertSame(0, ProductVariant::where('deal_id', $id)->count());
        foreach ($paths as $p) {
            Storage::disk('public')->assertMissing($p);
        }
    }
}
