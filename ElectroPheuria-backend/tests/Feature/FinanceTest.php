<?php

namespace Tests\Feature;

use App\Models\Client;
use App\Models\Deal;
use App\Models\Expense;
use App\Models\FinanceSetting;
use App\Models\Order;
use App\Models\Product;
use App\Models\User;
use Database\Seeders\FinanceSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class FinanceTest extends TestCase
{
    use RefreshDatabase;

    private function actingAsAdmin(): void
    {
        Sanctum::actingAs(User::factory()->create());
    }

    private function order(string $status, float $total): void
    {
        $client = Client::create(['name' => 'C', 'email' => uniqid() . '@x.test', 'phone' => '0600000000', 'address' => 'Rabat']);
        Order::create(['client_id' => $client->id, 'products' => [], 'total_price' => $total, 'status' => $status]);
    }

    public function test_every_finance_route_requires_authentication(): void
    {
        $this->getJson('/api/finance')->assertUnauthorized();
        $this->putJson('/api/finance/settings', [])->assertUnauthorized();
        $this->postJson('/api/finance/movements', [])->assertUnauthorized();
        $this->deleteJson('/api/finance/movements/1')->assertUnauthorized();
        $this->postJson('/api/finance/expenses', [])->assertUnauthorized();
        $this->putJson('/api/finance/expenses/1', [])->assertUnauthorized();
        $this->deleteJson('/api/finance/expenses/1')->assertUnauthorized();
        $this->putJson('/api/finance/items/product/1', [])->assertUnauthorized();
    }

    public function test_costs_never_leak_into_the_public_catalogue(): void
    {
        $p = Product::create(['name' => 'P', 'price' => 100]);
        $p->forceFill(['cost_price' => 40, 'packaging_cost' => 3, 'deal_price_2' => 180])->save();
        $d = Deal::create(['name' => 'D', 'old_price' => 150, 'price' => 150, 'offer_type' => 'standard', 'stock' => 1]);
        $d->forceFill(['cost_price' => 50])->save();

        foreach (['/api/products', "/api/products/{$p->id}", '/api/deals', "/api/deals/{$d->id}"] as $url) {
            $body = $this->getJson($url)->assertOk()->getContent();
            $this->assertStringNotContainsString('cost_price', $body, $url);
            $this->assertStringNotContainsString('packaging_cost', $body, $url);
            $this->assertStringNotContainsString('deal_price_2', $body, $url);
        }
    }

    public function test_money_in_is_the_money_actually_received(): void
    {
        $this->actingAsAdmin();
        // Orders alone are never income: shipped / delivered ones are only "expected".
        $this->order('shipped', 149);
        $this->order('done', 199);
        foreach (['pending', 'ongoing', 'cancelled', 'refunded'] as $status) {
            $this->order($status, 1000);
        }

        $res = $this->getJson('/api/finance')->assertOk();
        $res->assertJsonPath('revenue.total', 0)
            ->assertJsonPath('summary.income', 0)
            ->assertJsonPath('orders.expected.total', 348)
            ->assertJsonPath('orders.expected.count', 2)
            ->assertJsonPath('orders.pipeline.total', 2000);

        $this->postJson('/api/finance/movements', ['type' => 'income', 'account' => 'bank', 'source' => 'AirPods 4', 'occurred_on' => '2026-11-13', 'amount' => 150])->assertCreated();
        $this->postJson('/api/finance/movements', ['type' => 'income', 'account' => 'bank', 'source' => 'AirPods 4 x2', 'occurred_on' => '2026-11-13', 'amount' => 200])->assertCreated();

        $this->getJson('/api/finance')
            ->assertJsonPath('revenue.total', 350)
            ->assertJsonPath('summary.income', 350)
            ->assertJsonPath('monthly.0.period', '2026-11')
            ->assertJsonPath('monthly.0.income', 350)
            ->assertJsonPath('yearly.0.income', 350);
    }

    public function test_settings_and_movements(): void
    {
        $this->actingAsAdmin();

        $this->putJson('/api/finance/settings', ['opening_balance' => 4151.88, 'opening_date' => '2026-11-02', 'reconciled_on' => null, 'delivery_per_order' => 20])
            ->assertOk()->assertJson(['opening_balance' => 4151.88, 'opening_date' => '2026-11-02', 'reconciled_on' => null]);
        $this->assertSame(1, FinanceSetting::count());

        $id = $this->postJson('/api/finance/movements', ['type' => 'expense', 'category' => 'other', 'account' => 'bank', 'label' => 'Stock purchase', 'occurred_on' => '2026-11-03', 'amount' => 500])
            ->assertCreated()->json('id');
        $this->postJson('/api/finance/movements', ['type' => 'expense', 'category' => 'other', 'account' => 'bank', 'label' => 'Bad', 'occurred_on' => '2026-11-03', 'amount' => -5])
            ->assertStatus(422)->assertJsonValidationErrors('amount');
        $this->postJson('/api/finance/movements', ['type' => 'sideways', 'label' => 'Bad', 'occurred_on' => '2026-11-03', 'amount' => 5])
            ->assertStatus(422)->assertJsonValidationErrors('type');

        $this->getJson('/api/finance')->assertJsonPath('movements.0.amount', 500)->assertJsonPath('movements.0.direction', 'out');
        $this->deleteJson("/api/finance/movements/$id")->assertOk();
        $this->getJson('/api/finance')->assertJsonCount(0, 'movements');
    }

    public function test_expense_amount_keeps_null_distinct_from_zero(): void
    {
        $this->actingAsAdmin();

        $unknown = $this->postJson('/api/finance/expenses', ['category' => 'variable', 'label' => 'Packaging', 'amount' => null])
            ->assertCreated()->assertJsonPath('amount', null)->json('id');
        $this->postJson('/api/finance/expenses', ['category' => 'fixed', 'label' => 'Merlin', 'amount' => 0, 'verified' => true])
            ->assertCreated()->assertJsonPath('amount', 0)->assertJsonPath('verified', true);

        $this->assertNull(Expense::find($unknown)->amount);

        $this->putJson("/api/finance/expenses/$unknown", ['category' => 'variable', 'label' => 'Packaging', 'amount' => 3.5])
            ->assertOk()->assertJsonPath('amount', 3.5);
        $this->putJson("/api/finance/expenses/$unknown", ['category' => 'variable', 'label' => 'Packaging', 'amount' => ''])
            ->assertOk()->assertJsonPath('amount', null);

        $this->postJson('/api/finance/expenses', ['category' => 'other', 'label' => 'x', 'amount' => 1])
            ->assertStatus(422)->assertJsonValidationErrors('category');
        $this->deleteJson("/api/finance/expenses/$unknown")->assertOk();
    }

    public function test_item_costs_and_derived_two_unit_prices(): void
    {
        $this->actingAsAdmin();
        $product = Product::create(['name' => 'Speaker', 'price' => 300]);
        $fixed = Deal::create(['name' => 'AirPods Pro 2', 'old_price' => 150, 'price' => 150, 'offer_type' => 'bogo_fixed', 'second_item_price' => 50, 'stock' => 5]);
        $half = Deal::create(['name' => 'Oraimo', 'old_price' => 199, 'price' => 199, 'offer_type' => 'bogo_half', 'stock' => 5]);

        $this->putJson("/api/finance/items/product/{$product->id}", ['cost_price' => 120, 'packaging_cost' => 4, 'deal_price_2' => 520])
            ->assertOk()->assertJson(['cost_price' => 120, 'packaging_cost' => 4, 'deal_price_2' => 520]);
        $this->putJson("/api/finance/items/deal/{$fixed->id}", ['cost_price' => 50, 'packaging_cost' => null])
            ->assertOk()->assertJson(['cost_price' => 50, 'packaging_cost' => null, 'deal_price_2' => 200]);
        $this->putJson("/api/finance/items/deal/{$fixed->id}", ['cost_price' => -1])
            ->assertStatus(422)->assertJsonValidationErrors('cost_price');
        $this->putJson('/api/finance/items/order/1', [])->assertNotFound();

        $items = collect($this->getJson('/api/finance')->json('items'))->keyBy('name');
        $this->assertEquals(200, $items['AirPods Pro 2']['deal_price_2']);   // 150 + 50
        $this->assertEquals(289, $items['Oraimo']['deal_price_2']);          // 298.50 rounded down to …9
        $this->assertNull($items['Oraimo']['cost_price']);                    // unknown, not 0

        // The regular catalogue edit form must not wipe costs.
        $this->putJson("/api/products/{$product->id}", ['id' => $product->id, 'name' => 'Speaker', 'price' => 310])->assertOk();
        $this->assertEquals(120, $product->fresh()->cost_price);
    }

    public function test_seeder_is_idempotent_and_never_overwrites(): void
    {
        $deal = Deal::create(['name' => 'AirPods 4', 'old_price' => 150, 'price' => 150, 'offer_type' => 'standard', 'stock' => 1]);
        $this->seed(FinanceSeeder::class);
        $this->assertEquals(50, $deal->fresh()->cost_price);
        $this->assertSame(9, Expense::count());
        $this->assertNull(Expense::where('label', 'Packaging')->first()->amount);

        $deal->forceFill(['cost_price' => 60])->save();
        FinanceSetting::current()->update(['opening_balance' => 1]);
        $this->seed(FinanceSeeder::class);
        $this->assertEquals(60, $deal->fresh()->cost_price);
        $this->assertSame(9, Expense::count());
        $this->assertEquals(1, FinanceSetting::current()->opening_balance);
    }
}
