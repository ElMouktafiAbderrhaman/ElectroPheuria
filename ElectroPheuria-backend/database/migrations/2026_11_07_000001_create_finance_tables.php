<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Additive only: tables behind the dashboard finance tracker.
     * Starting figures are loaded separately by FinanceSeeder.
     */
    public function up(): void
    {
        if (!Schema::hasTable('finance_settings')) {
            Schema::create('finance_settings', function (Blueprint $table) {
                $table->id();
                $table->decimal('opening_balance', 10, 2)->default(0); // declared bank balance
                $table->date('opening_date')->nullable(); // date that balance was read
                $table->date('reconciled_on')->nullable(); // last check against a real statement
                $table->decimal('delivery_per_order', 10, 2)->default(20); // per order, not per unit
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('cash_movements')) {
            Schema::create('cash_movements', function (Blueprint $table) {
                $table->id();
                $table->date('occurred_on');
                $table->string('label');
                $table->enum('direction', ['in', 'out']);
                $table->decimal('amount', 10, 2); // positive; direction carries the sign
                $table->timestamps();
                $table->index('occurred_on');
            });
        }

        if (!Schema::hasTable('expenses')) {
            Schema::create('expenses', function (Blueprint $table) {
                $table->id();
                $table->enum('category', ['goods', 'fixed', 'variable']);
                $table->string('label');
                $table->decimal('amount', 10, 2)->nullable(); // NULL = not known yet, distinct from 0
                $table->string('period')->nullable();
                $table->string('note')->nullable();
                $table->boolean('verified')->default(false);
                $table->unsignedInteger('position')->default(0);
                $table->timestamps();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('expenses');
        Schema::dropIfExists('cash_movements');
        Schema::dropIfExists('finance_settings');
    }
};
