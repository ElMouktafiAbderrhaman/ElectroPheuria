<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Additive only: every existing deal keeps its standard promotional-price behaviour.
     * Values: 'standard' | 'bogo_half' (buy 1, get the 2nd at 50% off).
     */
    public function up(): void
    {
        if (!Schema::hasColumn('deals', 'offer_type')) {
            Schema::table('deals', function (Blueprint $table) {
                $table->string('offer_type', 32)->default('standard')->after('discount');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('deals', 'offer_type')) {
            Schema::table('deals', function (Blueprint $table) {
                $table->dropColumn('offer_type');
            });
        }
    }
};
