<?php

namespace Tests\Feature;

use App\Mail\NewOrderNotification;
use App\Models\Deal;
use App\Models\Order;
use App\Models\Product;
use App\Models\ProductVariant;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * The admin "new order" email must actually render. Mail::fake() alone never renders the
 * Blade view, which is how a template syntax error once went unnoticed for every order.
 */
class AdminOrderEmailTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_email_renders_for_every_kind_of_order_line(): void
    {
        Mail::fake();
        Storage::fake('public');

        $plain = Product::create(['name' => 'Plain Product', 'price' => 100, 'stock' => 10, 'category' => 'pods', 'images' => []]);
        $cable = Product::create(['name' => 'Fast Cable', 'price' => 79, 'stock' => 10, 'category' => 'batteries', 'images' => [], 'has_variants' => true]);
        Storage::disk('public')->put('product-variants/' . str_repeat('a', 32) . '.jpg', 'x');
        $variant = $cable->variants()->create(['type' => ProductVariant::USB_C, 'image_path' => 'product-variants/' . str_repeat('a', 32) . '.jpg', 'active' => true]);
        $bogo = Deal::create(['name' => 'Bogo Deal', 'description' => '', 'old_price' => 199, 'price' => 199, 'discount' => 0, 'offer_type' => 'bogo_fixed',
            'second_item_price' => 50, 'stock' => 10, 'categories' => [], 'images' => [], 'reviews' => '', 'specs' => [], 'gallery' => [], 'active' => true]);
        $pack = Deal::create(['name' => 'My Pack', 'description' => '', 'old_price' => 248, 'price' => 199, 'discount' => 20, 'offer_type' => 'standard',
            'stock' => 0, 'categories' => [], 'images' => [], 'reviews' => '', 'specs' => [], 'gallery' => [], 'active' => true, 'deal_type' => 'bundle']);
        $pack->bundleItems()->create(['product_id' => $plain->id, 'position' => 0]);
        $pack->bundleItems()->create(['product_id' => Product::create(['name' => 'Charger', 'price' => 148, 'stock' => 10, 'category' => 'batteries', 'images' => []])->id, 'position' => 1]);

        $this->postJson('/api/orders', [
            'client' => ['name' => 'Sara', 'phone' => '0611111111', 'city' => 'Rabat', 'delivery_address' => "Rue 12, Appt 3\nHay Riad"],
            'products' => [
                ['id' => $plain->id, 'quantity' => 1],
                ['id' => $cable->id, 'variant_id' => $variant->id, 'quantity' => 1],
                ['id' => $bogo->id, 'isDeal' => true, 'quantity' => 2],
                ['id' => $pack->id, 'isDeal' => true, 'quantity' => 2],
            ],
        ])->assertCreated();

        $sent = Mail::sent(NewOrderNotification::class);
        $this->assertCount(1, $sent);
        $html = $sent->first()->render(); // throws on any Blade / PHP error

        $this->assertStringContainsString('Rue 12, Appt 3', $html);
        $this->assertStringContainsString('Hay Riad', $html);
        $this->assertStringContainsString('Rabat', $html);
        $this->assertStringContainsString('Cable: USB Type-C', $html);
        $this->assertStringContainsString('Buy 1, Get the 2nd for 50.00 MAD', $html);
        $this->assertStringContainsString('Plain Product ×2 + Charger ×2', $html);
        $this->assertStringNotContainsString('@if', $html);
        $this->assertStringNotContainsString('@endif', $html);
    }

    public function test_admin_email_still_renders_for_older_orders_without_address(): void
    {
        $order = Order::make(['total_price' => 149, 'products' => [], 'status' => 'pending']);
        $order->id = 1;
        $order->created_at = now();
        $html = (new NewOrderNotification($order, ['name' => 'Old', 'phone' => '06', 'address' => 'Fès'], [
            ['name' => 'AirPods 4', 'quantity' => 1, 'price' => 149],
        ]))->render();

        $this->assertStringContainsString('Fès', $html);
        $this->assertStringContainsString('AirPods 4', $html);
    }
}
