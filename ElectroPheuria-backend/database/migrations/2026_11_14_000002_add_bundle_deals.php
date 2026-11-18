<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Two-product bundle deals: a deal of type "bundle" sells two existing products
     * together for one promotional price. Existing deals become "single".
     * Deleting a bundle removes only its pivot rows, never the products.
     */
    public function up(): void
    {
        Schema::table('deals', function (Blueprint $table) {
            $table->string('deal_type', 20)->default('single');
        });

        Schema::create('deal_bundle_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('deal_id')->constrained('deals')->cascadeOnDelete();
            $table->foreignId('product_id')->constrained('products')->cascadeOnDelete();
            $table->unsignedTinyInteger('position')->default(0);
            $table->unsignedSmallInteger('quantity')->default(1);
            $table->timestamps();
            $table->unique(['deal_id', 'product_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('deal_bundle_items');
        Schema::table('deals', function (Blueprint $table) {
            $table->dropColumn('deal_type');
        });
    }
};
