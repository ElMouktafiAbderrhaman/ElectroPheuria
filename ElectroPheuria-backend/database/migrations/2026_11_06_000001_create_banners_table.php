<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Additive only: a new table for homepage promotional banners.
     *
     * Text fields hold {fr, en, ar} translations, like products and deals.
     * Prices are optional overrides: for product/deal banners they stay null and
     * the live product/deal values are used, so nothing is duplicated.
     */
    public function up(): void
    {
        if (Schema::hasTable('banners')) {
            return;
        }

        Schema::create('banners', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            $table->string('promotion_type', 16)->default('custom'); // product | deal | custom
            $table->foreignId('product_id')->nullable()->constrained('products')->nullOnDelete();
            $table->foreignId('deal_id')->nullable()->constrained('deals')->nullOnDelete();
            $table->string('layout', 16)->default('split'); // split | centered | duo | discount
            $table->json('headline')->nullable();
            $table->json('subtitle')->nullable();
            $table->json('description')->nullable();
            $table->json('badge_text')->nullable();
            $table->json('button_text')->nullable();
            $table->string('button_url', 500)->nullable();
            $table->longText('image')->nullable(); // compressed data URL; overrides the product/deal image
            $table->json('secondary')->nullable(); // second offer panel for the "duo" layout
            $table->string('background_color', 16)->default('#0b0b0d');
            $table->string('text_color', 16)->default('#ffffff');
            $table->string('accent_color', 16)->default('#FFD447');
            $table->decimal('original_price', 10, 2)->nullable();
            $table->decimal('promotional_price', 10, 2)->nullable();
            $table->unsignedTinyInteger('discount_percentage')->nullable();
            $table->boolean('show_price')->default(true);
            $table->boolean('show_discount')->default(true);
            $table->dateTime('start_date')->nullable();
            $table->dateTime('end_date')->nullable();
            $table->boolean('active')->default(false);
            $table->unsignedInteger('display_order')->default(0);
            $table->timestamps();

            $table->index(['active', 'display_order']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('banners');
    }
};
