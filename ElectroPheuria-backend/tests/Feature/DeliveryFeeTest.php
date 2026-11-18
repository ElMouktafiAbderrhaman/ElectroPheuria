<?php

namespace Tests\Feature;

use App\Models\Client;
use App\Models\Deal;
use App\Models\Order;
use App\Models\Product;
use App\Models\User;
use App\Mail\NewOrderNotification;
use App\Mail\OrderConfirmation;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Queue;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Fixed 20 MAD nationwide delivery fee: added once per order by the server,
 * stored separately from the products subtotal, never counted as product sales.
 */
class DeliveryFeeTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Mail::fake();
        Queue::fake();
    }

    private function deal(array $attrs = []): Deal
    {
        return Deal::create(array_merge([
            'name' => 'AirPods 4', 'description' => '', 'old_price' => 299, 'price' => 149, 'discount' => 50,
            'offer_type' => 'standard', 'stock' => 50, 'categories' => [], 'images' => [], 'reviews' => '',
            'specs' => [], 'gallery' => [], 'active' => true,
        ], $attrs));
    }

    private function product(array $attrs = []): Product
    {
        return Product::create(array_merge([
            'name' => 'Power Bank', 'price' => 99, 'description' => '', 'stock' => 50, 'category' => 'batteries',
            'images' => [], 'reviews' => '', 'specs' => [], 'gallery' => [],
        ], $attrs));
    }

    private function order(array $products, array $extra = [])
    {
        return $this->postJson('/api/orders', array_merge([
            'client' => ['name' => 'Test', 'phone' => '0633333333', 'city' => 'Agadir', 'delivery_address' => '12 Rue Test, Apt 3'],
            'products' => $products,
        ], $extra));
    }

    public function test_one_item_quantity_one_adds_twenty_mad(): void
    {
        $deal = $this->deal();
        $res = $this->order([['id' => $deal->id, 'quantity' => 1, 'isDeal' => true]])->assertCreated();

        $res->assertJsonPath('subtotal', 149)->assertJsonPath('delivery_fee', 20)->assertJsonPath('total_price', 169);
        $order = Order::find($res->json('id'));
        $this->assertEquals(149, $order->subtotal);
        $this->assertEquals(20, $order->delivery_fee);
        $this->assertEquals(169, $order->total_price);
    }

    public function test_quantity_two_is_charged_delivery_once(): void
    {
        $deal = $this->deal();
        $order = Order::find($this->order([['id' => $deal->id, 'quantity' => 2, 'isDeal' => true]])->assertCreated()->json('id'));

        $this->assertEquals(298, $order->subtotal);
        $this->assertEquals(20, $order->delivery_fee);
        $this->assertEquals(318, $order->total_price);
    }

    public function test_several_products_and_quantities_pay_one_fee(): void
    {
        $deal = $this->deal();
        $bogo = $this->deal(['name' => 'Earbuds', 'price' => 199, 'old_price' => 199, 'discount' => 0, 'offer_type' => 'bogo_fixed', 'second_item_price' => 50]);
        $product = $this->product();

        $order = Order::find($this->order([
            ['id' => $deal->id, 'quantity' => 2, 'isDeal' => true],   // 298
            ['id' => $bogo->id, 'quantity' => 2, 'isDeal' => true],   // 199 + 50 = 249
            ['id' => $product->id, 'quantity' => 3],                  // 297
        ])->assertCreated()->json('id'));

        $this->assertEquals(844, $order->subtotal);
        $this->assertEquals(20, $order->delivery_fee);
        $this->assertEquals(864, $order->total_price);
    }

    public function test_customer_cannot_remove_or_change_the_fee(): void
    {
        $deal = $this->deal();
        $order = Order::find($this->order(
            [['id' => $deal->id, 'quantity' => 1, 'isDeal' => true, 'price' => 1]],
            ['total_price' => 1, 'delivery_fee' => 0]
        )->assertCreated()->json('id'));

        $this->assertEquals(20, $order->delivery_fee);
        $this->assertEquals(169, $order->total_price);
    }

    public function test_fee_comes_from_config(): void
    {
        config(['shop.delivery_fee' => 25]);
        $deal = $this->deal();
        $order = Order::find($this->order([['id' => $deal->id, 'quantity' => 1, 'isDeal' => true]])->assertCreated()->json('id'));

        $this->assertEquals(25, $order->delivery_fee);
        $this->assertEquals(174, $order->total_price);
    }

    public function test_sales_stats_exclude_delivery_fees_and_keep_old_orders(): void
    {
        $client = Client::create(['name' => 'Old', 'phone' => '0611111111', 'address' => 'x']);
        // Placed before the fee existed: no subtotal column value, free delivery.
        Order::create(['client_id' => $client->id, 'products' => [], 'total_price' => 200, 'status' => 'shipped']);

        $deal = $this->deal();
        $id = $this->order([['id' => $deal->id, 'quantity' => 2, 'isDeal' => true]])->json('id');
        Order::find($id)->update(['status' => 'shipped']);

        Sanctum::actingAs(User::factory()->create());
        $stats = $this->getJson('/api/stats')->assertOk();
        $this->assertEquals(498, $stats->json('total_sales'));        // 200 + 298, fee excluded
        $this->assertEquals(20, $stats->json('total_delivery_fees'));

        $month = collect($this->getJson('/api/monthly-sales?year=' . now()->year)->json('months'))->firstWhere('month', now()->month);
        $this->assertEquals(498, $month['sales']);
    }

    public function test_emails_show_the_breakdown(): void
    {
        $deal = $this->deal();
        $order = Order::find($this->order([['id' => $deal->id, 'quantity' => 2, 'isDeal' => true]])->json('id'));

        $admin = (new NewOrderNotification($order, $order->client_data, $order->products))->render();
        $this->assertStringContainsString('Delivery fee', $admin);
        $this->assertStringContainsString('MAD 298.00', $admin);
        $this->assertStringContainsString('MAD 318.00', $admin);

        $order->locale = 'ar';
        $customer = (new OrderConfirmation($order))->render();
        $this->assertStringContainsString('التوصيل (لجميع أنحاء المغرب)', $customer);
        $this->assertStringContainsString('318', $customer);
    }
}
