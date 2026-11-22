<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() !== 'mysql') {
            // SQLite (tests): ENUM is a CHECK constraint, so store the status as a plain string.
            Schema::table('orders', fn (Blueprint $table) => $table->string('status')->default('pending')->change());
            return;
        }
        DB::statement("ALTER TABLE orders MODIFY COLUMN status ENUM('pending', 'ongoing', 'done', 'cancelled', 'shipped', 'refunded') DEFAULT 'pending'");
    }

    public function down(): void
    {
        if (DB::getDriverName() !== 'mysql') {
            return;
        }
        DB::statement("ALTER TABLE orders MODIFY COLUMN status ENUM('pending', 'ongoing', 'done', 'cancelled', 'shipped') DEFAULT 'pending'");
    }
};
