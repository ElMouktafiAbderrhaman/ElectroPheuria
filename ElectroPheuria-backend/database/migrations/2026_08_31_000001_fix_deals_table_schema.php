<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('deals', function (Blueprint $table) {
            $table->dropForeign(['product_id']);
            $table->dropColumn([
                'product_id',
                'original_price',
                'deal_price',
                'discount_percentage',
                'start_date',
                'end_date',
                'active',
            ]);

            $table->text('description')->nullable()->after('name');
            $table->decimal('old_price', 10, 2)->default(0)->after('description');
            $table->decimal('price', 10, 2)->default(0)->after('old_price');
            $table->integer('discount')->default(0)->after('price');
            $table->integer('stock')->default(0)->after('discount');
            $table->json('categories')->nullable()->after('stock');
            $table->json('images')->nullable()->after('categories');
            $table->text('reviews')->nullable()->after('images');
        });
    }

    public function down(): void
    {
        Schema::table('deals', function (Blueprint $table) {
            $table->dropColumn([
                'description',
                'old_price',
                'price',
                'discount',
                'stock',
                'categories',
                'images',
                'reviews',
            ]);

            $table->foreignId('product_id')->constrained('products')->onDelete('cascade');
            $table->decimal('original_price', 10, 2);
            $table->decimal('deal_price', 10, 2);
            $table->integer('discount_percentage');
            $table->date('start_date');
            $table->date('end_date');
            $table->boolean('active')->default(true);
        });
    }
};
