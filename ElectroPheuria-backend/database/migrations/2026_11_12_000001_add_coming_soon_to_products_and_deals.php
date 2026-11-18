<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * "Coming soon" items are shown in the store with a teaser design but cannot be ordered.
     */
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->boolean('coming_soon')->default(false);
        });
        Schema::table('deals', function (Blueprint $table) {
            $table->boolean('coming_soon')->default(false);
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn('coming_soon');
        });
        Schema::table('deals', function (Blueprint $table) {
            $table->dropColumn('coming_soon');
        });
    }
};
