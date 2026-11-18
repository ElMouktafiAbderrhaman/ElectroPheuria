<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Orders now store the products subtotal and the delivery fee next to the total
     * (total_price = subtotal + delivery_fee).
     * Existing orders were placed with free delivery: their total stays exactly as it was,
     * delivery_fee is 0 and subtotal is copied from total_price.
     */
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->decimal('subtotal', 10, 2)->nullable()->after('products');
            $table->decimal('delivery_fee', 10, 2)->default(0)->after('subtotal');
        });

        DB::table('orders')->whereNull('subtotal')->update(['subtotal' => DB::raw('total_price')]);
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn(['subtotal', 'delivery_fee']);
        });
    }
};
