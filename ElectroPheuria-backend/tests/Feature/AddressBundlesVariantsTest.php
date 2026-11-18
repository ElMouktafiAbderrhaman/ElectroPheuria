<?php

namespace Tests\Feature;

use App\Models\Deal;
use App\Models\DealBundleItem;
use App\Models\Order;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AddressBundlesVariantsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Mail::fake();
        Storage::fake('public');
    }

    private function actingAsAdmin(): void
    {
        Sanctum::actingAs(User::factory()->create());
    }

    private function makeProduct(array $attrs = []): Product
    {
        return Product::create(array_merge([
            'name' => 'Product', 'price' => 100, 'description' => '', 'stock' => 10, 'category' => 'batteries',
            'images' => ['https://example.test/p.jpg'], 'reviews' => '', 'specs' => [], 'gallery' => [],
        ], $attrs));
    }

    private function client(array $overrides = []): array
    {
        return array_merge([
            'name' => 'Test', 'phone' => '0633333333', 'city' => 'Casablanca',
            'delivery_address' => "Rue 12, Immeuble 4, Appt 7\nMaarif",
        ], $overrides);
    }

    private function order(array $products, array $client = [])
    {
        return $this->postJson('/api/orders', ['client' => $this->client($client), 'products' => $products]);
    }

    private function uploadImage(): string
    {
        return $this->post('/api/product-variants/images', [
            'image' => UploadedFile::fake()->image('cable.jpg', 400, 400),
        ], ['Accept' => 'application/json'])->assertCreated()->json('path');
    }

    // ───────────── Task 1: delivery address ─────────────

    public function test_delivery_address_is_saved_with_the_order(): void
    {
        $product = $this->makeProduct();

        $id = $this->order([['id' => $product->id, 'quantity' => 1]])->assertCreated()->json('id');

        $order = Order::find($id);
        $this->assertSame("Rue 12, Immeuble 4, Appt 7\nMaarif", $order->delivery_address);
        $this->assertSame("Rue 12, Immeuble 4, Appt 7\nMaarif", $order->client_data['delivery_address']);
        $this->assertSame('Casablanca', $order->client_data['city']);

        // Visible to the admin in the orders list.
        $this->actingAsAdmin();
        $row = collect($this->getJson('/api/orders')->assertOk()->json())->firstWhere('id', $id);
        $this->assertSame("Rue 12, Immeuble 4, Appt 7\nMaarif", $row['delivery_address']);
    }

    public function test_delivery_address_is_required_and_validated(): void
    {
        $product = $this->makeProduct();

        $this->order([['id' => $product->id]], ['delivery_address' => null])
            ->assertStatus(422)->assertJsonValidationErrors('client.delivery_address');
        $this->order([['id' => $product->id]], ['delivery_address' => '   '])
            ->assertStatus(422)->assertJsonValidationErrors('client.delivery_address');
        $this->order([['id' => $product->id]], ['delivery_address' => str_repeat('a', 501)])
            ->assertStatus(422)->assertJsonValidationErrors('client.delivery_address');
        $this->order([['id' => $product->id]], ['city' => ''])
            ->assertStatus(422)->assertJsonValidationErrors('client.city');

        $this->assertSame(0, Order::count());
        $this->assertSame(10, $product->fresh()->stock);
    }

    // ───────────── Task 2: bundle deals ─────────────

    private function bundlePayload(array $overrides = []): array
    {
        return array_merge([
            'deal_type' => 'bundle',
            'name' => '',
            'price' => 199,
            'active' => true,
            'categories' => ['golden'],
            'images' => [],
        ], $overrides);
    }

    public function test_bundle_deal_is_created_with_combined_price_and_discount(): void
    {
        $this->actingAsAdmin();
        $a = $this->makeProduct(['name' => 'AirPods 4', 'price' => 149]);
        $b = $this->makeProduct(['name' => 'Fast Charger', 'price' => 99]);

        $id = $this->postJson('/api/deals', $this->bundlePayload(['bundle_product_ids' => [$a->id, $b->id]]))
            ->assertCreated()->json('id');

        $deal = Deal::find($id);
        $this->assertSame('bundle', $deal->deal_type);
        $this->assertSame('AirPods 4 + Fast Charger', $deal->name);
        $this->assertEquals(248, $deal->old_price);
        $this->assertEquals(199, $deal->price);
        $this->assertSame(20, $deal->discount);
        $this->assertSame([$a->id, $b->id], $deal->bundleItems->pluck('product_id')->all());

        $json = $this->getJson("/api/deals/{$id}")->assertOk()->json();
        $this->assertEquals(248, $json['oldPrice']);
        $this->assertSame(20, $json['discount']);
        $this->assertCount(2, $json['bundle_products']);
        $this->assertTrue($json['bundle_complete']);
        $this->assertSame(10, $json['stock']);
        $this->assertSame(['https://example.test/p.jpg', 'https://example.test/p.jpg'], $json['images']);
    }

    public function test_bundle_validation(): void
    {
        $this->actingAsAdmin();
        $a = $this->makeProduct(['price' => 149]);
        $b = $this->makeProduct(['price' => 99]);

        // Same product twice
        $this->postJson('/api/deals', $this->bundlePayload(['bundle_product_ids' => [$a->id, $a->id]]))
            ->assertStatus(422)->assertJsonValidationErrors('bundle_product_ids.0');
        // Only one product
        $this->postJson('/api/deals', $this->bundlePayload(['bundle_product_ids' => [$a->id]]))
            ->assertStatus(422)->assertJsonValidationErrors('bundle_product_ids');
        // Unknown product
        $this->postJson('/api/deals', $this->bundlePayload(['bundle_product_ids' => [$a->id, 999999]]))
            ->assertStatus(422)->assertJsonValidationErrors('bundle_product_ids.1');
        // Price not below the combined price
        $this->postJson('/api/deals', $this->bundlePayload(['bundle_product_ids' => [$a->id, $b->id], 'price' => 248]))
            ->assertStatus(422)->assertJsonValidationErrors('price');

        $this->assertSame(0, Deal::count());
    }

    public function test_bundle_order_charges_bundle_price_and_takes_stock_from_both_products(): void
    {
        $this->actingAsAdmin();
        $a = $this->makeProduct(['name' => 'AirPods 4', 'price' => 149, 'stock' => 5]);
        $b = $this->makeProduct(['name' => 'Fast Charger', 'price' => 99, 'stock' => 3]);
        $id = $this->postJson('/api/deals', $this->bundlePayload(['bundle_product_ids' => [$a->id, $b->id]]))->json('id');

        // A client-sent price is ignored: the server charges the bundle price.
        $orderId = $this->order([['id' => $id, 'isDeal' => true, 'price' => 1, 'quantity' => 2]])
            ->assertCreated()->json('id');

        $order = Order::find($orderId);
        $this->assertEquals(398, (float) $order->subtotal);
        $line = $order->products[0];
        $this->assertSame('bundle', $line['deal_type']);
        $this->assertEquals(248, $line['oldPrice']);
        $this->assertSame(['AirPods 4', 'Fast Charger'], array_column($line['bundle_items'], 'name'));
        $this->assertSame(3, $a->fresh()->stock);
        $this->assertSame(1, $b->fresh()->stock);
        $this->assertSame(0, Deal::find($id)->stock);

        // Cancelling gives the stock back to the two products.
        $this->putJson("/api/orders/{$orderId}/status", ['status' => 'cancelled'])->assertOk();
        $this->assertSame(5, $a->fresh()->stock);
        $this->assertSame(3, $b->fresh()->stock);
    }

    public function test_bundle_edit_toggle_and_delete_keep_products(): void
    {
        $this->actingAsAdmin();
        $a = $this->makeProduct(['price' => 149]);
        $b = $this->makeProduct(['price' => 99]);
        $c = $this->makeProduct(['name' => 'Cable', 'price' => 49]);
        $id = $this->postJson('/api/deals', $this->bundlePayload(['bundle_product_ids' => [$a->id, $b->id]]))->json('id');

        // Swap the second product and change the price
        $this->putJson("/api/deals/{$id}", $this->bundlePayload([
            'id' => $id, 'name' => 'My Pack', 'bundle_product_ids' => [$a->id, $c->id], 'price' => 159,
        ]))->assertOk();
        $deal = Deal::find($id);
        $this->assertSame([$a->id, $c->id], $deal->bundleItems->pluck('product_id')->all());
        $this->assertEquals(198, $deal->old_price);
        $this->assertSame(20, $deal->discount);
        $this->assertSame('My Pack', $deal->name);

        // Deactivate: hidden from the public
        $this->putJson("/api/deals/{$id}", $this->bundlePayload([
            'id' => $id, 'bundle_product_ids' => [$a->id, $c->id], 'price' => 159, 'active' => false,
        ]))->assertOk();
        $this->assertFalse(Deal::find($id)->active);

        // Delete: the products stay
        $this->deleteJson("/api/deals/{$id}")->assertOk();
        $this->assertNull(Deal::find($id));
        $this->assertSame(3, Product::count());
        $this->assertDatabaseCount('deal_bundle_items', 0);
    }

    public function test_bundle_with_deleted_product_cannot_be_ordered(): void
    {
        $this->actingAsAdmin();
        $a = $this->makeProduct(['price' => 149]);
        $b = $this->makeProduct(['price' => 99]);
        $id = $this->postJson('/api/deals', $this->bundlePayload(['bundle_product_ids' => [$a->id, $b->id]]))->json('id');

        $this->deleteJson("/api/products/{$b->id}")->assertOk();

        $json = $this->getJson("/api/deals/{$id}")->json();
        $this->assertFalse($json['bundle_complete']);
        $this->assertSame(0, $json['stock']);
        $this->order([['id' => $id, 'isDeal' => true, 'quantity' => 1]])->assertStatus(422);
    }

    public function test_single_deals_still_work_next_to_bundles(): void
    {
        $this->actingAsAdmin();
        $id = $this->postJson('/api/deals', [
            'name' => 'Classic', 'oldPrice' => 300, 'price' => 200, 'stock' => 4, 'categories' => ['golden'], 'images' => [],
        ])->assertCreated()->json('id');
        $this->assertSame('single', Deal::find($id)->deal_type);

        $orderId = $this->order([['id' => $id, 'isDeal' => true, 'quantity' => 1]])->assertCreated()->json('id');
        $this->assertEquals(200, (float) Order::find($orderId)->subtotal);
        $this->assertSame(3, Deal::find($id)->stock);
    }

    // ───────────── Task 3: cable variants ─────────────

    private function cableProduct(array $variantOverrides = [], array $productOverrides = []): int
    {
        $lightning = $this->uploadImage();
        $usbc = $this->uploadImage();

        return $this->postJson('/api/products', array_merge([
            'name' => 'Fast Charging Cable', 'price' => 79, 'stock' => 20, 'category' => 'batteries',
            'images' => [], 'has_variants' => true,
            'variants' => [
                array_merge(['type' => 'lightning', 'image_path' => $lightning, 'price' => 89, 'stock' => 5, 'active' => true], $variantOverrides['lightning'] ?? []),
                array_merge(['type' => 'usb_c', 'image_path' => $usbc, 'price' => null, 'stock' => null, 'active' => true], $variantOverrides['usb_c'] ?? []),
            ],
        ], $productOverrides))->assertCreated()->json('id');
    }

    public function test_variant_images_are_stored_as_files_and_served(): void
    {
        $this->actingAsAdmin();
        $id = $this->cableProduct();

        $product = Product::with('variants')->find($id);
        $this->assertTrue($product->has_variants);
        $this->assertCount(2, $product->variants);
        foreach ($product->variants as $variant) {
            $this->assertStringStartsWith('product-variants/', $variant->image_path);
            Storage::disk('public')->assertExists($variant->image_path);
        }

        $json = $this->getJson("/api/products/{$id}")->assertOk()->json();
        $this->assertSame(['lightning', 'usb_c'], array_column($json['variants'], 'type'));
        $this->assertSame(['Lightning', 'USB Type-C'], array_column($json['variants'], 'label'));
        $this->assertEquals(89, $json['variants'][0]['price']);
        $this->assertNull($json['variants'][1]['price']);

        $url = $json['variants'][0]['image_url'];
        $this->assertStringStartsWith('/api/product-variants/images/', $url);
        $this->get($url)->assertOk();
        $this->get('/api/product-variants/images/' . str_repeat('a', 32) . '.jpg')->assertNotFound();
    }

    public function test_variant_validation(): void
    {
        $this->actingAsAdmin();
        $img = $this->uploadImage();

        $base = ['name' => 'Cable', 'price' => 79, 'stock' => 5, 'category' => 'batteries', 'images' => [], 'has_variants' => true];
        // Image that was never uploaded (e.g. base64 / foreign path)
        $this->postJson('/api/products', $base + ['variants' => [['type' => 'lightning', 'image_path' => 'data:image/png;base64,AAAA']]])
            ->assertStatus(422)->assertJsonValidationErrors('variants.0.image_path');
        // Same type twice
        $this->postJson('/api/products', $base + ['variants' => [['type' => 'lightning', 'image_path' => $img], ['type' => 'lightning', 'image_path' => $img]]])
            ->assertStatus(422)->assertJsonValidationErrors('variants.0.type');
        // Unknown type
        $this->postJson('/api/products', $base + ['variants' => [['type' => 'micro_usb', 'image_path' => $img]]])
            ->assertStatus(422)->assertJsonValidationErrors('variants.0.type');
        // Variants on, but none active
        $this->postJson('/api/products', $base + ['variants' => [['type' => 'lightning', 'image_path' => $img, 'active' => false]]])
            ->assertStatus(422)->assertJsonValidationErrors('variants');
        // Negative stock / zero price
        $this->postJson('/api/products', $base + ['variants' => [['type' => 'lightning', 'image_path' => $img, 'stock' => -1, 'price' => 0]]])
            ->assertStatus(422)->assertJsonValidationErrors(['variants.0.stock', 'variants.0.price']);
        // Non-image upload
        $this->post('/api/product-variants/images', ['image' => UploadedFile::fake()->create('x.pdf', 10, 'application/pdf')], ['Accept' => 'application/json'])
            ->assertStatus(422);

        $this->assertSame(0, Product::count());
    }

    public function test_variant_order_uses_variant_price_and_stock(): void
    {
        $this->actingAsAdmin();
        $id = $this->cableProduct();
        $variants = Product::find($id)->variants->keyBy('type');

        $orderId = $this->order([
            ['id' => $id, 'variant_id' => $variants['lightning']->id, 'quantity' => 2, 'price' => 1],
            ['id' => $id, 'variant_id' => $variants['usb_c']->id, 'quantity' => 1],
        ])->assertCreated()->json('id');

        $order = Order::find($orderId);
        // Lightning has its own price (89), Type-C uses the product price (79).
        $this->assertEquals(2 * 89 + 79, (float) $order->subtotal);
        $lines = collect($order->products)->keyBy('variant_type');
        $this->assertSame('Lightning', $lines['lightning']['variant_label']);
        $this->assertSame(2, $lines['lightning']['quantity']);
        $this->assertSame('USB Type-C', $lines['usb_c']['variant_label']);
        $this->assertStringStartsWith('/api/product-variants/images/', $lines['usb_c']['variant_image']);

        // Lightning has its own stock; Type-C draws on the product stock.
        $this->assertSame(3, $variants['lightning']->fresh()->stock);
        $this->assertSame(19, Product::find($id)->stock);

        // Admin can see the cable type in the orders list.
        $row = collect($this->getJson('/api/orders')->json())->firstWhere('id', $orderId);
        $this->assertEqualsCanonicalizing(['Lightning', 'USB Type-C'], array_column($row['products'], 'variant_label'));

        // Cancelling restores each stock where it was taken.
        $this->putJson("/api/orders/{$orderId}/status", ['status' => 'cancelled'])->assertOk();
        $this->assertSame(5, $variants['lightning']->fresh()->stock);
        $this->assertSame(20, Product::find($id)->stock);
    }

    public function test_variant_must_be_selected_active_and_in_stock(): void
    {
        $this->actingAsAdmin();
        $id = $this->cableProduct(['lightning' => ['stock' => 0], 'usb_c' => ['active' => false]]);
        $variants = Product::find($id)->variants->keyBy('type');

        $this->order([['id' => $id, 'quantity' => 1]])->assertStatus(422);
        $this->order([['id' => $id, 'variant_id' => $variants['lightning']->id]])->assertStatus(422);
        $this->order([['id' => $id, 'variant_id' => $variants['usb_c']->id]])->assertStatus(422);
        $this->order([['id' => $id, 'variant_id' => 999999]])->assertStatus(422);
        $this->assertSame(0, Order::count());
    }

    public function test_variant_update_replaces_and_cleans_up_images(): void
    {
        $this->actingAsAdmin();
        $id = $this->cableProduct();
        $old = Product::find($id)->variants->keyBy('type');
        $newImage = $this->uploadImage();

        // Replace the Lightning image and drop the Type-C variant.
        $this->putJson("/api/products/{$id}", [
            'id' => $id, 'name' => 'Fast Charging Cable', 'price' => 79, 'stock' => 20, 'category' => 'batteries',
            'images' => [], 'has_variants' => true,
            'variants' => [['type' => 'lightning', 'image_path' => $newImage, 'price' => 95, 'stock' => 7, 'active' => true]],
        ])->assertOk();

        $variants = Product::find($id)->variants;
        $this->assertCount(1, $variants);
        $this->assertSame($old['lightning']->id, $variants[0]->id);
        $this->assertSame($newImage, $variants[0]->image_path);
        $this->assertEquals(95, $variants[0]->price);
        Storage::disk('public')->assertMissing($old['lightning']->image_path);
        Storage::disk('public')->assertMissing($old['usb_c']->image_path);
        Storage::disk('public')->assertExists($newImage);

        // An update without "variants" (older dashboard) leaves them untouched.
        $this->putJson("/api/products/{$id}", ['id' => $id, 'name' => 'Renamed', 'price' => 79, 'stock' => 20, 'category' => 'batteries'])->assertOk();
        $this->assertCount(1, Product::find($id)->variants);
        $this->assertTrue(Product::find($id)->has_variants);

        // Deleting the product removes its variant images.
        $this->deleteJson("/api/products/{$id}")->assertOk();
        Storage::disk('public')->assertMissing($newImage);
        $this->assertSame(0, ProductVariant::count());
    }

    // ───────────── Packs with deals and cable products ─────────────

    private function singleDeal(array $attrs = []): Deal
    {
        return Deal::create(array_merge([
            'name' => 'AirPods 4', 'description' => '', 'old_price' => 149, 'price' => 149, 'discount' => 0,
            'offer_type' => 'bogo_fixed', 'second_item_price' => 50, 'stock' => 10, 'categories' => ['pods'],
            'images' => ['https://example.test/airpods.jpg'], 'reviews' => '', 'specs' => [], 'gallery' => [], 'active' => true,
        ], $attrs));
    }

    public function test_pack_can_combine_a_deal_and_a_cable_product(): void
    {
        $this->actingAsAdmin();
        $airpods = $this->singleDeal();
        $cable = $this->cableProduct();   // 79 MAD, lightning stock 5, usb_c shares product stock 20

        $id = $this->postJson('/api/deals', $this->bundlePayload([
            'bundle_items' => [['type' => 'deal', 'id' => $airpods->id], ['type' => 'product', 'id' => $cable]],
            'price' => 199,
        ]))->assertCreated()->json('id');

        $deal = $this->getJson("/api/deals/{$id}")->assertOk()->json();
        $this->assertSame('AirPods 4 + Fast Charging Cable', $deal['name']);
        $this->assertEquals(228, $deal['oldPrice']);                // 149 + 79
        $this->assertTrue($deal['bundle_complete']);
        $this->assertSame(['deal', 'product'], array_column($deal['bundle_products'], 'kind'));
        $this->assertSame([], $deal['bundle_products'][0]['variants']);
        $this->assertSame(['lightning', 'usb_c'], array_column($deal['bundle_products'][1]['variants'], 'type'));
        $this->assertSame(10, $deal['stock']);                       // AirPods deal stock 10 < cables 5 + 20
        $this->assertNotNull(DealBundleItem::where('deal_id', $id)->whereNotNull('bundled_deal_id')->first());
    }

    public function test_pack_validation_for_deal_items(): void
    {
        $this->actingAsAdmin();
        $airpods = $this->singleDeal();
        $product = $this->makeProduct();
        $packId = $this->postJson('/api/deals', $this->bundlePayload([
            'bundle_items' => [['type' => 'deal', 'id' => $airpods->id], ['type' => 'product', 'id' => $product->id]],
        ]))->assertCreated()->json('id');

        // Same item twice, a missing deal, a pack inside a pack, a pack containing itself.
        $this->postJson('/api/deals', $this->bundlePayload(['bundle_items' => [['type' => 'deal', 'id' => $airpods->id], ['type' => 'deal', 'id' => $airpods->id]]]))
            ->assertStatus(422)->assertJsonValidationErrors('bundle_items.1');
        $this->postJson('/api/deals', $this->bundlePayload(['bundle_items' => [['type' => 'deal', 'id' => 999999], ['type' => 'product', 'id' => $product->id]]]))
            ->assertStatus(422)->assertJsonValidationErrors('bundle_items.0');
        $this->postJson('/api/deals', $this->bundlePayload(['bundle_items' => [['type' => 'deal', 'id' => $packId], ['type' => 'product', 'id' => $product->id]]]))
            ->assertStatus(422)->assertJsonValidationErrors('bundle_items.0');
        $this->putJson("/api/deals/{$packId}", $this->bundlePayload(['id' => $packId, 'bundle_items' => [['type' => 'deal', 'id' => $packId], ['type' => 'product', 'id' => $product->id]]]))
            ->assertStatus(422)->assertJsonValidationErrors('bundle_items.0');
        // Price must stay under 149 + 100.
        $this->postJson('/api/deals', $this->bundlePayload(['bundle_items' => [['type' => 'deal', 'id' => $airpods->id], ['type' => 'product', 'id' => $product->id]], 'price' => 249]))
            ->assertStatus(422)->assertJsonValidationErrors('price');
    }

    public function test_pack_order_requires_cable_choice_and_takes_stock_from_the_right_place(): void
    {
        $this->actingAsAdmin();
        $airpods = $this->singleDeal();
        $cable = $this->cableProduct();
        $variants = ProductVariant::where('product_id', $cable)->get()->keyBy('type');
        $packId = $this->postJson('/api/deals', $this->bundlePayload([
            'bundle_items' => [['type' => 'deal', 'id' => $airpods->id], ['type' => 'product', 'id' => $cable]],
            'price' => 199,
        ]))->json('id');

        // No cable chosen / a cable of another product → refused.
        $this->order([['id' => $packId, 'isDeal' => true, 'quantity' => 1]])
            ->assertStatus(422)->assertJsonFragment(['message' => 'Please choose a cable type for Fast Charging Cable in: AirPods 4 + Fast Charging Cable']);
        $this->order([['id' => $packId, 'isDeal' => true, 'quantity' => 1, 'bundle_variants' => [$cable => 999999]]])->assertStatus(422);

        // 2 packs with Lightning + 1 pack with USB-C, in one order.
        $orderId = $this->order([
            ['id' => $packId, 'isDeal' => true, 'quantity' => 2, 'bundle_variants' => [$cable => $variants['lightning']->id]],
            ['id' => $packId, 'isDeal' => true, 'quantity' => 1, 'bundle_variants' => [$cable => $variants['usb_c']->id]],
        ])->assertCreated()->json('id');

        $order = Order::find($orderId);
        $this->assertEquals(597, $order->subtotal);   // 3 × 199, the AirPods 2nd-item offer does not apply inside a pack
        $this->assertCount(2, $order->products);
        $lightningLine = collect($order->products)->first(fn ($l) => $l['quantity'] === 2);
        $this->assertSame('deal', $lightningLine['bundle_items'][0]['kind']);
        $this->assertSame('Lightning', $lightningLine['bundle_items'][1]['variant_label']);

        $this->assertSame(7, $airpods->fresh()->stock);                          // 10 − 3
        $this->assertSame(3, $variants['lightning']->fresh()->stock);            // own stock 5 − 2
        $this->assertSame(19, Product::find($cable)->stock);                     // USB-C shares product stock 20 − 1

        // Cancelling gives everything back to the same place.
        $this->putJson("/api/orders/{$orderId}/status", ['status' => 'cancelled'])->assertOk();
        $this->assertSame(10, $airpods->fresh()->stock);
        $this->assertSame(5, $variants['lightning']->fresh()->stock);
        $this->assertSame(20, Product::find($cable)->stock);

        // The admin email names the chosen cable.
        $html = Mail::sent(\App\Mail\NewOrderNotification::class)->last()->render();
        $this->assertStringContainsString('Fast Charging Cable (Cable: Lightning) ×2', $html);
    }

    public function test_pack_with_coming_soon_or_deleted_deal_cannot_be_ordered(): void
    {
        $this->actingAsAdmin();
        $airpods = $this->singleDeal();
        $product = $this->makeProduct();
        $packId = $this->postJson('/api/deals', $this->bundlePayload([
            'bundle_items' => [['type' => 'deal', 'id' => $airpods->id], ['type' => 'product', 'id' => $product->id]],
        ]))->json('id');

        $airpods->update(['coming_soon' => true]);
        $this->assertFalse($this->getJson("/api/deals/{$packId}")->json('bundle_complete'));
        $this->order([['id' => $packId, 'isDeal' => true, 'quantity' => 1]])->assertStatus(422);

        $airpods->delete();
        $this->assertFalse($this->getJson("/api/deals/{$packId}")->json('bundle_complete'));
        $this->order([['id' => $packId, 'isDeal' => true, 'quantity' => 1]])->assertStatus(422);
        $this->assertSame(10, $product->fresh()->stock);
    }

    public function test_variant_upload_requires_admin(): void
    {
        $this->post('/api/product-variants/images', ['image' => UploadedFile::fake()->image('a.jpg')], ['Accept' => 'application/json'])
            ->assertUnauthorized();
    }
}
