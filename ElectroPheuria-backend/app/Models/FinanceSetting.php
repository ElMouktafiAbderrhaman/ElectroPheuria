<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** Single-row table: declared starting bank + cash balances and delivery cost. */
class FinanceSetting extends Model
{
    protected $fillable = ['opening_balance', 'opening_date', 'reconciled_on', 'delivery_per_order', 'opening_cash'];

    protected $casts = [
        'opening_balance' => 'float',
        'opening_date' => 'date:Y-m-d',
        'reconciled_on' => 'date:Y-m-d',
        'delivery_per_order' => 'float',
        'opening_cash' => 'float',
    ];

    public static function current(): self
    {
        return static::query()->orderBy('id')->first()
            ?? static::create(['opening_balance' => 0, 'delivery_per_order' => 20]);
    }
}
