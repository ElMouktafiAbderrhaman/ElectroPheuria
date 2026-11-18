<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Additive only: the fixed price of every second unit for 'bogo_fixed' deals
     * (buy 1, get the 2nd for X MAD). Null for every other offer type.
     */
    public function up(): void
    {
        if (!Schema::hasColumn('deals', 'second_item_price')) {
            Schema::table('deals', function (Blueprint $table) {
                $table->decimal('second_item_price', 10, 2)->nullable()->after('offer_type');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('deals', 'second_item_price')) {
            Schema::table('deals', function (Blueprint $table) {
                $table->dropColumn('second_item_price');
            });
        }
    }
};
