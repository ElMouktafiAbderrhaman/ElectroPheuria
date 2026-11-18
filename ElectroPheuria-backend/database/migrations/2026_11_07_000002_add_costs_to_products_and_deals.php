<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Additive only: supplier cost and packaging for the finance tracker.
     * Every column is nullable — NULL means "not known yet", never 0.
     * Deals get no deal_price_2: their two-unit price follows from offer_type / second_item_price.
     */
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            if (!Schema::hasColumn('products', 'cost_price')) {
                $table->decimal('cost_price', 10, 2)->nullable()->after('price');
            }
            if (!Schema::hasColumn('products', 'packaging_cost')) {
                $table->decimal('packaging_cost', 10, 2)->nullable()->after('cost_price'); // once per order
            }
            if (!Schema::hasColumn('products', 'deal_price_2')) {
                $table->decimal('deal_price_2', 10, 2)->nullable()->after('packaging_cost'); // price for two units
            }
        });

        Schema::table('deals', function (Blueprint $table) {
            if (!Schema::hasColumn('deals', 'cost_price')) {
                $table->decimal('cost_price', 10, 2)->nullable()->after('price');
            }
            if (!Schema::hasColumn('deals', 'packaging_cost')) {
                $table->decimal('packaging_cost', 10, 2)->nullable()->after('cost_price');
            }
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn(['cost_price', 'packaging_cost', 'deal_price_2']);
        });
        Schema::table('deals', function (Blueprint $table) {
            $table->dropColumn(['cost_price', 'packaging_cost']);
        });
    }
};
