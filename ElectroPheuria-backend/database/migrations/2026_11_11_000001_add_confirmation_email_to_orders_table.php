<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Stores the language the customer browsed in when ordering, and when the
     * customer's confirmation email was delivered (used to prevent duplicates).
     */
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->string('locale', 5)->nullable()->after('status');
            $table->timestamp('confirmation_sent_at')->nullable()->after('locale');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn(['locale', 'confirmation_sent_at']);
        });
    }
};
