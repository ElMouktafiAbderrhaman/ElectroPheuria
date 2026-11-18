<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Turns cash_movements into the single money ledger (additive only, no row is deleted):
     *  - type: income | expense | withdrawal (bank → cash) | deposit (cash → bank)
     *  - account: cash | bank (income/expense only; transfers move between both)
     *  - category for expenses: packaging, tiktok_ads, meta_ads, stock, delivery, other
     *  - stock purchases link a catalogue item (product or deal), delivery records the city.
     * finance_settings gets a starting cash balance next to the existing bank balance.
     *
     * Existing rows were all recorded against the bank balance: they become bank income/expenses,
     * and their expense category is guessed from the label (editable afterwards).
     */
    public function up(): void
    {
        Schema::table('cash_movements', function (Blueprint $table) {
            $table->string('type', 20)->default('expense')->index();
            $table->string('account', 10)->nullable();
            $table->string('category', 30)->nullable()->index();
            $table->string('source')->nullable(); // income: where the money came from
            $table->unsignedBigInteger('order_id')->nullable()->index(); // income received for this order
            $table->string('item_type', 10)->nullable(); // stock: product | deal
            $table->unsignedBigInteger('item_id')->nullable();
            $table->string('item_name')->nullable(); // snapshot, survives the item being deleted
            $table->unsignedInteger('quantity')->nullable();
            $table->decimal('unit_cost', 10, 2)->nullable();
            $table->unsignedInteger('stock_added')->default(0); // units added to the shop stock by this purchase
            $table->string('city', 100)->nullable(); // delivery destination
            $table->string('carrier', 100)->nullable();
            $table->string('order_ref', 50)->nullable();
            $table->text('notes')->nullable();
        });

        Schema::table('finance_settings', function (Blueprint $table) {
            $table->decimal('opening_cash', 10, 2)->default(0);
        });

        $this->backfill();
    }

    /** Classify rows saved by the old tracker (only label / direction / amount). Public for the test. */
    public function backfill(): void
    {
        $catalogue = [];
        foreach (DB::table('deals')->select('id', 'name')->get() as $d) {
            $catalogue[mb_strtolower(trim($d->name))] ??= ['deal', $d->id, $d->name];
        }
        foreach (DB::table('products')->select('id', 'name')->get() as $p) {
            $catalogue[mb_strtolower(trim($p->name))] ??= ['product', $p->id, $p->name];
        }

        foreach (DB::table('cash_movements')->whereNull('account')->get() as $m) {
            $label = (string) $m->label;
            $lower = mb_strtolower($label);
            $row = ['account' => 'bank'];

            if ($m->direction === 'in') {
                $row += ['type' => 'income', 'source' => $label];
            } else {
                $row['type'] = 'expense';
                $item = $catalogue[mb_strtolower(trim($label))] ?? null;
                if ($item) {
                    $row += ['category' => 'stock', 'item_type' => $item[0], 'item_id' => $item[1], 'item_name' => $item[2]];
                } elseif (preg_match('/packag|emballage/u', $lower)) {
                    $row['category'] = 'packaging';
                } elseif (preg_match('/tik ?tok/u', $lower)) {
                    $row['category'] = 'tiktok_ads';
                } elseif (preg_match('/\bmeta\b|facebook|instagram/u', $lower)) {
                    $row['category'] = 'meta_ads';
                } elseif (preg_match('/deliv|dilev|livraison|courier|shipping/u', $lower)) {
                    $row['category'] = 'delivery';
                    if (preg_match('/\(([^)]+)\)/u', $label, $c)) {
                        $row['city'] = trim($c[1]);
                    }
                } else {
                    $row['category'] = 'other';
                }
            }

            DB::table('cash_movements')->where('id', $m->id)->update($row);
        }
    }

    public function down(): void
    {
        Schema::table('cash_movements', function (Blueprint $table) {
            $table->dropIndex(['type']);
            $table->dropIndex(['category']);
            $table->dropIndex(['order_id']);
            $table->dropColumn(['type', 'account', 'category', 'source', 'order_id', 'item_type', 'item_id', 'item_name',
                'quantity', 'unit_cost', 'stock_added', 'city', 'carrier', 'order_ref', 'notes']);
        });
        Schema::table('finance_settings', function (Blueprint $table) {
            $table->dropColumn('opening_cash');
        });
    }
};
