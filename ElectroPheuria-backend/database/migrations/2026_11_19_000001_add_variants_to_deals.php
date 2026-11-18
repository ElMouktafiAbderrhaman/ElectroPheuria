<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Single deals can have cable variants (Lightning / USB Type-C) too. A variant row belongs
     * to either a product (product_id) or a deal (deal_id). Deal variants use the deal's own
     * price and stock; they only carry the cable type, its image and an on/off switch.
     */
    public function up(): void
    {
        Schema::table('deals', function (Blueprint $table) {
            $table->boolean('has_variants')->default(false);
        });

        Schema::table('product_variants', function (Blueprint $table) {
            $table->foreignId('deal_id')->nullable()->after('product_id')
                ->constrained('deals')->cascadeOnDelete();
            $table->unique(['deal_id', 'type']);
        });

        Schema::table('product_variants', function (Blueprint $table) {
            $table->unsignedBigInteger('product_id')->nullable()->change();
        });
    }

    public function down(): void
    {
        DB::table('product_variants')->whereNull('product_id')->delete();

        Schema::table('product_variants', function (Blueprint $table) {
            $table->unsignedBigInteger('product_id')->nullable(false)->change();
        });

        Schema::table('product_variants', function (Blueprint $table) {
            // The foreign key uses the unique index, so it must go first.
            $table->dropForeign(['deal_id']);
            $table->dropUnique(['deal_id', 'type']);
            $table->dropColumn('deal_id');
        });

        Schema::table('deals', function (Blueprint $table) {
            $table->dropColumn('has_variants');
        });
    }
};
