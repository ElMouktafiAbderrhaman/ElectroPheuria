<?php

namespace Tests\Feature;

use App\Models\CashMovement;
use App\Models\Client;
use App\Models\Deal;
use App\Models\Order;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/** The scenarios from the Money Tracker brief, against the real API and database. */
class FinanceLedgerTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Sanctum::actingAs(User::factory()->create());
        $this->putJson('/api/finance/settings', ['opening_balance' => 2000, 'opening_cash' => 500, 'delivery_per_order' => 20])->assertOk();
    }

    private function move(array $data)
    {
        return $this->postJson('/api/finance/movements', $data + ['occurred_on' => '2026-11-15']);
    }

    private function summary(): array
    {
        return $this->getJson('/api/finance')->assertOk()->json('summary');
    }

    private function airpods(): Deal
    {
        return Deal::create(['name' => 'AirPods 4', 'description' => '', 'old_price' => 149, 'price' => 149, 'discount' => 0,
            'offer_type' => 'standard', 'stock' => 10, 'categories' => [], 'images' => [], 'reviews' => '', 'specs' => [], 'gallery' => [], 'active' => true]);
    }

    public function test_withdrawal_and_deposit_move_money_without_income_or_spending(): void
    {
        $this->assertEquals(['cash' => 500.0, 'bank' => 2000.0, 'total' => 2500.0], $this->summary()['balances']);

        $this->move(['type' => 'withdrawal', 'amount' => 300])->assertCreated();
        $s = $this->summary();
        $this->assertEquals(['cash' => 800.0, 'bank' => 1700.0, 'total' => 2500.0], $s['balances']);

        $this->move(['type' => 'deposit', 'amount' => 200])->assertCreated();
        $s = $this->summary();
        $this->assertEquals(['cash' => 600.0, 'bank' => 1900.0, 'total' => 2500.0], $s['balances']);
        $this->assertEquals(0, $s['income']);
        $this->assertEquals(0, $s['spending']);
        $this->assertEquals(300, $s['withdrawals']);
        $this->assertEquals(200, $s['deposits']);
    }

    public function test_transfers_cannot_exceed_the_source_account(): void
    {
        $this->move(['type' => 'withdrawal', 'amount' => 2000.01])->assertStatus(422)->assertJsonValidationErrors('amount');
        $this->move(['type' => 'deposit', 'amount' => 501])->assertStatus(422)->assertJsonValidationErrors('amount');
        $id = $this->move(['type' => 'deposit', 'amount' => 500])->assertCreated()->json('id');

        // Editing ignores the movement's own old amount when checking the balance.
        $this->putJson("/api/finance/movements/$id", ['type' => 'deposit', 'amount' => 500, 'occurred_on' => '2026-11-15'])->assertOk();
        $this->putJson("/api/finance/movements/$id", ['type' => 'deposit', 'amount' => 600, 'occurred_on' => '2026-11-15'])->assertStatus(422);
        $this->assertEquals(['cash' => 0.0, 'bank' => 2500.0, 'total' => 2500.0], $this->summary()['balances']);
    }

    public function test_every_expense_category_lands_in_spending_and_reduces_the_right_account(): void
    {
        $deal = $this->airpods();

        $this->move(['type' => 'expense', 'category' => 'packaging', 'account' => 'cash', 'label' => 'Packaging materials', 'amount' => 10])->assertCreated();
        $this->move(['type' => 'expense', 'category' => 'tiktok_ads', 'account' => 'bank', 'label' => 'TikTok advertising campaign', 'amount' => 150])->assertCreated();
        $this->move(['type' => 'expense', 'category' => 'meta_ads', 'account' => 'bank', 'amount' => 200])->assertCreated();
        $stock = $this->move(['type' => 'expense', 'category' => 'stock', 'account' => 'bank', 'item_type' => 'deal', 'item_id' => $deal->id,
            'quantity' => 5, 'unit_cost' => 100, 'amount' => 1])->assertCreated()->json(); // client amount is ignored
        $this->move(['type' => 'expense', 'category' => 'delivery', 'account' => 'cash', 'city' => 'Oued Zem', 'carrier' => 'Amana', 'amount' => 35])->assertCreated();

        $this->assertEquals(500, $stock['amount']);
        $this->assertSame('AirPods 4 × 5', $stock['label']);
        $this->assertSame('AirPods 4', $stock['item_name']);

        $s = $this->summary();
        $this->assertEquals(895, $s['spending']);
        $this->assertEquals(['packaging' => 10.0, 'tiktok_ads' => 150.0, 'meta_ads' => 200.0, 'stock' => 500.0, 'delivery' => 35.0, 'other' => 0.0], $s['spending_by_category']);
        $this->assertEquals(350, $s['advertising']);
        $this->assertEquals(['cash' => 45.0, 'bank' => 850.0], $s['spending_by_account']);
        $this->assertEquals(['cash' => 455.0, 'bank' => 1150.0, 'total' => 1605.0], $s['balances']);
        $this->assertEquals(0, $s['income']);
        $this->assertSame(10, $deal->fresh()->stock); // selling price and stock untouched
        $this->assertEquals(149, $deal->fresh()->price);

        $spending = $this->getJson('/api/finance/spending?from=2026-11-15&to=2026-11-15')->assertOk()->json();
        $this->assertEquals(895, $spending['totals']['spending']);
        $this->assertSame('Oued Zem', $spending['delivery_by_city'][0]['city']);
        $this->assertSame('AirPods 4', $spending['stock_by_item'][0]['item']);
        $this->assertSame(5, $spending['stock_by_item'][0]['quantity']);
        $this->assertEquals(0, $this->getJson('/api/finance/spending?from=2026-11-16')->json('totals.spending'));
    }

    public function test_type_specific_fields_are_required(): void
    {
        $this->move(['type' => 'expense', 'account' => 'bank', 'amount' => 10])->assertStatus(422)->assertJsonValidationErrors('category');
        $this->move(['type' => 'expense', 'category' => 'packaging', 'amount' => 10])->assertStatus(422)->assertJsonValidationErrors('account');
        $this->move(['type' => 'expense', 'category' => 'stock', 'account' => 'bank'])->assertStatus(422)
            ->assertJsonValidationErrors(['item_id', 'quantity', 'unit_cost']);
        $this->move(['type' => 'expense', 'category' => 'stock', 'account' => 'bank', 'item_type' => 'product', 'item_id' => 999, 'quantity' => 1, 'unit_cost' => 5])
            ->assertStatus(422)->assertJsonValidationErrors('item_id');
        $this->move(['type' => 'expense', 'category' => 'delivery', 'account' => 'cash', 'amount' => 35])->assertStatus(422)->assertJsonValidationErrors('city');
        $this->move(['type' => 'income', 'amount' => 150])->assertStatus(422)->assertJsonValidationErrors('account');
        $this->assertSame(0, CashMovement::count());
    }

    public function test_money_in_updates_balances_reports_and_order_expectations(): void
    {
        $client = Client::create(['name' => 'Sara', 'phone' => '0600000000']);
        $order = Order::create(['client_id' => $client->id, 'products' => [], 'total_price' => 199, 'status' => 'shipped', 'client_data' => ['name' => 'Sara', 'city' => 'Rabat']]);

        $this->move(['type' => 'income', 'account' => 'cash', 'source' => 'AirPods 4', 'amount' => 150])->assertCreated();
        $id = $this->move(['type' => 'income', 'account' => 'bank', 'source' => 'AirPods 4 x2 (shipped)', 'amount' => 200, 'occurred_on' => '2025-12-30'])->assertCreated()->json('id');

        $d = $this->getJson('/api/finance')->json();
        $this->assertEquals(350, $d['summary']['income']);
        $this->assertEquals(['cash' => 150.0, 'bank' => 200.0], $d['summary']['income_by_account']);
        $this->assertEquals(['cash' => 650.0, 'bank' => 2200.0, 'total' => 2850.0], $d['summary']['balances']);
        $this->assertEquals([['2025-12', 200.0], ['2026-11', 150.0]], array_map(fn ($r) => [$r['period'], $r['income']], $d['monthly']));
        $this->assertEquals([['2025', 200.0], ['2026', 150.0]], array_map(fn ($r) => [$r['period'], $r['income']], $d['yearly']));
        $this->assertEquals(199, $d['orders']['expected']['total']);

        // Linking the income to the shipped order: it is no longer "expected".
        $this->putJson("/api/finance/movements/$id", ['type' => 'income', 'account' => 'bank', 'order_id' => $order->id, 'amount' => 199, 'occurred_on' => '2026-11-14'])->assertOk();
        $d = $this->getJson('/api/finance')->json();
        $this->assertEquals(349, $d['summary']['income']);
        $this->assertEquals(0, $d['orders']['expected']['total']);
        // The same order cannot be received twice.
        $this->move(['type' => 'income', 'account' => 'cash', 'order_id' => $order->id, 'amount' => 199])->assertStatus(422)->assertJsonValidationErrors('order_id');
    }

    public function test_edit_and_delete_update_totals_without_duplicates(): void
    {
        $id = $this->move(['type' => 'expense', 'category' => 'packaging', 'account' => 'bank', 'amount' => 10])->json('id');
        $this->putJson("/api/finance/movements/$id", ['type' => 'expense', 'category' => 'meta_ads', 'account' => 'cash', 'amount' => 25, 'occurred_on' => '2026-11-15'])->assertOk();

        $s = $this->summary();
        $this->assertSame(1, CashMovement::count());
        $this->assertEquals(25, $s['spending']);
        $this->assertEquals(0, $s['spending_by_category']['packaging']);
        $this->assertEquals(25, $s['spending_by_category']['meta_ads']);
        $this->assertEquals(['cash' => 475.0, 'bank' => 2000.0, 'total' => 2475.0], $s['balances']);

        // Reloading the dashboard never creates records.
        $this->getJson('/api/finance');
        $this->getJson('/api/finance/spending');
        $this->assertSame(1, CashMovement::count());

        $this->deleteJson("/api/finance/movements/$id")->assertOk();
        $s = $this->summary();
        $this->assertEquals(0, $s['spending']);
        $this->assertEquals(['cash' => 500.0, 'bank' => 2000.0, 'total' => 2500.0], $s['balances']);
    }

    public function test_stock_purchase_can_add_units_to_shop_stock_and_undo_them(): void
    {
        $product = Product::create(['name' => 'Cable', 'price' => 79, 'stock' => 2, 'category' => 'batteries', 'images' => []]);
        $body = ['type' => 'expense', 'category' => 'stock', 'account' => 'cash', 'item_type' => 'product', 'item_id' => $product->id, 'quantity' => 5, 'unit_cost' => 20, 'add_to_stock' => true, 'occurred_on' => '2026-11-15'];

        $id = $this->postJson('/api/finance/movements', $body)->assertCreated()->json('id');
        $this->assertSame(7, $product->fresh()->stock);
        $this->assertSame(5, CashMovement::find($id)->stock_added);

        $this->putJson("/api/finance/movements/$id", ['quantity' => 3] + $body)->assertOk();
        $this->assertSame(5, $product->fresh()->stock); // 2 + 3, not 2 + 5 + 3
        $this->putJson("/api/finance/movements/$id", ['add_to_stock' => false] + $body)->assertOk();
        $this->assertSame(2, $product->fresh()->stock);

        $this->putJson("/api/finance/movements/$id", $body)->assertOk();
        $this->deleteJson("/api/finance/movements/$id")->assertOk();
        $this->assertSame(2, $product->fresh()->stock);
        $this->assertEquals(79, $product->fresh()->price);
    }

    public function test_existing_movements_are_migrated_into_the_ledger(): void
    {
        // Rows saved by the old tracker carried only label / direction / amount.
        $deal = $this->airpods();
        $migration = require database_path('migrations/2026_11_15_000001_extend_cash_movements_into_ledger.php');
        \DB::table('cash_movements')->insert([
            ['occurred_on' => '2026-11-09', 'label' => 'meta ads (7 days test)', 'direction' => 'out', 'amount' => 461.59],
            ['occurred_on' => '2026-11-11', 'label' => 'AirPods 4', 'direction' => 'out', 'amount' => 420],
            ['occurred_on' => '2026-11-12', 'label' => 'Packaging', 'direction' => 'out', 'amount' => 7.5],
            ['occurred_on' => '2026-11-13', 'label' => 'Dilevery (Marrakech)', 'direction' => 'out', 'amount' => 35],
            ['occurred_on' => '2026-11-04', 'label' => 'chat gpt subscription', 'direction' => 'out', 'amount' => 100],
            ['occurred_on' => '2026-11-13', 'label' => 'AirPods 4', 'direction' => 'in', 'amount' => 150],
            ['occurred_on' => '2026-11-13', 'label' => 'AirPods 4 x2', 'direction' => 'in', 'amount' => 200],
        ]);
        $migration->backfill();

        $rows = CashMovement::orderBy('id')->get();
        $this->assertSame(['meta_ads', 'stock', 'packaging', 'delivery', 'other', null, null], $rows->pluck('category')->all());
        $this->assertSame(['expense', 'expense', 'expense', 'expense', 'expense', 'income', 'income'], $rows->pluck('type')->all());
        $this->assertSame($deal->id, $rows[1]->item_id);
        $this->assertSame('Marrakech', $rows[3]->city);
        $this->assertSame(array_fill(0, 7, 'bank'), $rows->pluck('account')->all());

        $s = $this->summary();
        $this->assertEquals(350, $s['income']);
        $this->assertEquals(1024.09, $s['spending']);
        $this->assertEquals(round(2000 - 1024.09 + 350, 2), $s['balances']['bank']); // same bank balance as before the migration
    }
}
