<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * A bundle item can now be an existing deal as well as a product.
     * Existing rows keep their product_id and are unchanged.
     */
    public function up(): void
    {
        Schema::table('deal_bundle_items', function (Blueprint $table) {
            $table->foreignId('bundled_deal_id')->nullable()->after('product_id')
                ->constrained('deals')->cascadeOnDelete();
            $table->unique(['deal_id', 'bundled_deal_id']);
        });

        Schema::table('deal_bundle_items', function (Blueprint $table) {
            $table->unsignedBigInteger('product_id')->nullable()->change();
        });
    }

    public function down(): void
    {
        // Deal items cannot exist without the new column.
        \Illuminate\Support\Facades\DB::table('deal_bundle_items')->whereNull('product_id')->delete();

        Schema::table('deal_bundle_items', function (Blueprint $table) {
            $table->unsignedBigInteger('product_id')->nullable(false)->change();
        });

        Schema::table('deal_bundle_items', function (Blueprint $table) {
            $table->dropUnique(['deal_id', 'bundled_deal_id']);
            $table->dropConstrainedForeignId('bundled_deal_id');
        });
    }
};
