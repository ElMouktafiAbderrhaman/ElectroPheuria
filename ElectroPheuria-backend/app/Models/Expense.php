<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Expense extends Model
{
    public const CATEGORIES = ['goods', 'fixed', 'variable'];

    protected $fillable = ['category', 'label', 'amount', 'period', 'note', 'verified', 'position'];

    // amount stays null when unknown — the float cast keeps null as null.
    protected $casts = [
        'amount' => 'float',
        'verified' => 'boolean',
        'position' => 'integer',
    ];
}
