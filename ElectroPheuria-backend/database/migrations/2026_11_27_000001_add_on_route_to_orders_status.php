<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /** "On route": confirmed and handed to the courier, between "ongoing" (confirmed) and "shipped". */
    public function up(): void
    {
        if (DB::getDriverName() !== 'mysql') {
            // SQLite (tests): status is already a plain string column.
            return;
        }
        DB::statement("ALTER TABLE orders MODIFY COLUMN status ENUM('pending', 'ongoing', 'on_route', 'done', 'cancelled', 'shipped', 'refunded') DEFAULT 'pending'");
    }

    public function down(): void
    {
        if (DB::getDriverName() !== 'mysql') {
            return;
        }
        DB::statement("UPDATE orders SET status = 'ongoing' WHERE status = 'on_route'");
        DB::statement("ALTER TABLE orders MODIFY COLUMN status ENUM('pending', 'ongoing', 'done', 'cancelled', 'shipped', 'refunded') DEFAULT 'pending'");
    }
};
