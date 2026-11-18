<?php

namespace Tests\Feature;

use App\Models\Deal;
use App\Models\Order;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class HiddenProductTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Mail::fake();
    }

    private function asAdmin(): void
    {
        Sanctum::actingAs(User::factory()->create());
    }

    private function asPublic(): void
    {
        $this->app['auth']->forgetGuards();
    }

    private function makeProduct(array $attrs = []): Product
    {
        return Product::create(array_merge([
            'name' => 'Product', 'price' => 100, 'description' => '', 'stock' => 10, 'category' => 'batteries',
            'images' => ['https://example.test/p.jpg'], 'reviews' => '', 'specs' => [], 'gallery' => [],
        ], $attrs));
    }

    private function order(array $products)
    {
        return $this->postJson('/api/orders', [
            'client' => ['name' => 'Test', 'phone' => '0633333333', 'city' => 'Casablanca', 'delivery_address' => 'Rue 12, Maarif'],
            'products' => $products,
        ]);
    }

    public function test_products_are_active_by_default(): void
    {
        $this->asAdmin();
        $id = $this->postJson('/api/products', ['name' => 'New', 'price' => 50])->assertCreated()->json('id');
        $this->assertTrue(Product::find($id)->active);
    }

    public function test_admin_can_hide_and_show_a_product_from_edit_products(): void
    {
        $product = $this->makeProduct(['name' => 'Charger']);
        $this->asAdmin();

        $this->putJson("/api/products/{$product->id}", ['name' => 'Charger', 'price' => 100, 'active' => false])->assertOk();
        $this->assertFalse($product->fresh()->active);

        // Saving without the field (older dashboard) keeps it hidden.
        $this->putJson("/api/products/{$product->id}", ['name' => 'Charger', 'price' => 100])->assertOk();
        $this->assertFalse($product->fresh()->active);

        $this->putJson("/api/products/{$product->id}", ['name' => 'Charger', 'price' => 100, 'active' => true])->assertOk();
        $this->assertTrue($product->fresh()->active);
    }

    public function test_hidden_product_is_not_in_the_store_but_admin_still_sees_it(): void
    {
        $visible = $this->makeProduct(['name' => 'Visible']);
        $hidden = $this->makeProduct(['name' => 'Hidden', 'active' => false]);

        $names = array_column($this->getJson('/api/products')->assertOk()->json(), 'name');
        $this->assertSame(['Visible'], $names);
        $this->getJson("/api/products/{$hidden->id}")->assertNotFound();
        $this->getJson("/api/products/{$visible->id}")->assertOk();

        $this->asAdmin();
        $names = array_column($this->getJson('/api/products')->assertOk()->json(), 'name');
        $this->assertEqualsCanonicalizing(['Visible', 'Hidden'], $names);
        $this->getJson("/api/products/{$hidden->id}")->assertOk()->assertJsonPath('active', false);
    }

    public function test_hidden_product_cannot_be_ordered_on_its_own(): void
    {
        $hidden = $this->makeProduct(['name' => 'Hidden', 'active' => false, 'stock' => 5]);

        $this->order([['id' => $hidden->id, 'quantity' => 1]])->assertStatus(422);
        $this->assertSame(0, Order::count());
        $this->assertSame(5, $hidden->fresh()->stock);
    }

    public function test_pack_with_a_hidden_product_keeps_working(): void
    {
        $a = $this->makeProduct(['name' => 'AirPods 4', 'price' => 149, 'stock' => 5]);
        $b = $this->makeProduct(['name' => 'Fast Charger', 'price' => 99, 'stock' => 3]);

        $this->asAdmin();
        $dealId = $this->postJson('/api/deals', [
            'deal_type' => 'bundle', 'name' => '', 'price' => 199, 'active' => true,
            'categories' => ['golden'], 'images' => [], 'bundle_product_ids' => [$a->id, $b->id],
        ])->assertCreated()->json('id');
        // Hide one product of the pack.
        $this->putJson("/api/products/{$b->id}", ['name' => 'Fast Charger', 'price' => 99, 'stock' => 3, 'active' => false])->assertOk();

        $this->asPublic();
        // The pack is still listed with both items available, and its page still opens.
        $deal = collect($this->getJson('/api/deals')->assertOk()->json())->firstWhere('id', $dealId);
        $this->assertTrue($deal['active']);
        $this->getJson("/api/deals/{$dealId}")->assertOk();
        $this->assertNotContains('Fast Charger', array_column($this->getJson('/api/products')->json(), 'name'));

        // The pack can still be ordered and takes stock from the hidden product.
        $orderId = $this->order([['id' => $dealId, 'isDeal' => true, 'quantity' => 1]])->assertCreated()->json('id');
        $order = Order::find($orderId);
        $this->assertEquals(199, (float) $order->subtotal);
        $this->assertSame(['AirPods 4', 'Fast Charger'], array_column($order->products[0]['bundle_items'], 'name'));
        $this->assertSame(4, $a->fresh()->stock);
        $this->assertSame(2, $b->fresh()->stock);
        $this->assertTrue(Deal::find($dealId)->active);
    }
}
