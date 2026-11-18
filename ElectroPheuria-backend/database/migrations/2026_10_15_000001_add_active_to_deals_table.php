<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Additive only: every existing deal stays active.
     */
    public function up(): void
    {
        if (!Schema::hasColumn('deals', 'active')) {
            Schema::table('deals', function (Blueprint $table) {
                $table->boolean('active')->default(true)->after('stock');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('deals', 'active')) {
            Schema::table('deals', function (Blueprint $table) {
                $table->dropColumn('active');
            });
        }
    }
};
