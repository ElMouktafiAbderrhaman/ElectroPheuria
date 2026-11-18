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

class ComingSoonTest extends TestCase
{
    use RefreshDatabase;

    private function deal(array $attrs = []): Deal
    {
        return Deal::create(array_merge([
            'name' => 'Teaser Deal', 'description' => '', 'old_price' => 200, 'price' => 200, 'discount' => 0,
            'offer_type' => 'standard', 'stock' => 5, 'categories' => [], 'images' => [], 'reviews' => '',
            'specs' => [], 'gallery' => [], 'active' => true,
        ], $attrs));
    }

    private function order(array $line)
    {
        return $this->postJson('/api/orders', [
            'client' => ['name' => 'C', 'phone' => '0611111111', 'address' => 'Rabat', 'city' => 'Rabat', 'delivery_address' => '12 Rue Test, Apt 3'],
            'products' => [$line],
        ]);
    }

    public function test_defaults_to_false_and_is_public_in_the_catalogue(): void
    {
        $deal = $this->deal();
        $product = Product::create(['name' => 'P', 'price' => 100, 'stock' => 3]);

        $this->getJson('/api/deals')->assertOk()->assertJsonPath('0.coming_soon', false);
        $this->getJson("/api/products/{$product->id}")->assertOk()->assertJsonPath('coming_soon', false);
        $this->getJson("/api/deals/{$deal->id}")->assertOk()->assertJsonPath('coming_soon', false);
    }

    public function test_admin_can_set_and_clear_coming_soon_on_deals_and_products(): void
    {
        Sanctum::actingAs(User::factory()->create());
        $deal = $this->deal();
        $product = Product::create(['name' => 'P', 'price' => 100, 'stock' => 3]);

        $dealPayload = ['id' => $deal->id, 'name' => 'Teaser Deal', 'oldPrice' => 250, 'price' => 200, 'stock' => 5];
        $this->putJson("/api/deals/{$deal->id}", $dealPayload + ['coming_soon' => true])->assertOk();
        $this->assertTrue($deal->fresh()->coming_soon);

        // Saving without the field keeps the current value.
        $this->putJson("/api/deals/{$deal->id}", $dealPayload)->assertOk();
        $this->assertTrue($deal->fresh()->coming_soon);

        $this->putJson("/api/deals/{$deal->id}", $dealPayload + ['coming_soon' => false])->assertOk();
        $this->assertFalse($deal->fresh()->coming_soon);

        $productPayload = ['id' => $product->id, 'name' => 'P', 'price' => 100, 'stock' => 3];
        $this->putJson("/api/products/{$product->id}", $productPayload + ['coming_soon' => true])->assertOk();
        $this->assertTrue($product->fresh()->coming_soon);
        $this->putJson("/api/products/{$product->id}", $productPayload)->assertOk();
        $this->assertTrue($product->fresh()->coming_soon);

        $id = $this->postJson('/api/deals', ['name' => 'New', 'oldPrice' => 300, 'price' => 250, 'coming_soon' => true])
            ->assertCreated()->json('id');
        $this->assertTrue(Deal::find($id)->coming_soon);
    }

    public function test_coming_soon_items_cannot_be_ordered(): void
    {
        Mail::fake();
        $deal = $this->deal(['coming_soon' => true]);
        $product = Product::create(['name' => 'Soon Product', 'price' => 100, 'stock' => 3, 'coming_soon' => true]);

        $this->order(['id' => $deal->id, 'quantity' => 1, 'isDeal' => true])
            ->assertStatus(422)->assertJsonPath('message', 'This item is coming soon and cannot be ordered yet: Teaser Deal');
        $this->order(['id' => $product->id, 'quantity' => 1])->assertStatus(422);

        $this->assertSame(0, Order::count());
        $this->assertSame(5, $deal->fresh()->stock);

        // Once it is launched, it can be ordered normally.
        $deal->update(['coming_soon' => false]);
        $this->order(['id' => $deal->id, 'quantity' => 1, 'isDeal' => true])->assertCreated();
    }
}
