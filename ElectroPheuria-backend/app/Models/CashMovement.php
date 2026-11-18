<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * One line of the money ledger. `amount` is always positive; `type` says what it does:
 *  income      +amount on `account`
 *  expense     −amount on `account` (with a spending `category`)
 *  withdrawal  bank → cash (internal transfer, not income or spending)
 *  deposit     cash → bank (internal transfer, not income or spending)
 * `direction` is kept for older code: in for income, out for everything else.
 */
class CashMovement extends Model
{
    public const INCOME = 'income';
    public const EXPENSE = 'expense';
    public const WITHDRAWAL = 'withdrawal';
    public const DEPOSIT = 'deposit';
    public const TYPES = [self::INCOME, self::EXPENSE, self::WITHDRAWAL, self::DEPOSIT];
    public const TRANSFERS = [self::WITHDRAWAL, self::DEPOSIT];

    public const CASH = 'cash';
    public const BANK = 'bank';
    public const ACCOUNTS = [self::CASH, self::BANK];

    public const CATEGORIES = ['packaging', 'tiktok_ads', 'meta_ads', 'stock', 'delivery', 'other'];
    public const AD_CATEGORIES = ['tiktok_ads', 'meta_ads'];

    protected $fillable = [
        'occurred_on', 'label', 'direction', 'amount', 'type', 'account', 'category', 'source', 'order_id',
        'item_type', 'item_id', 'item_name', 'quantity', 'unit_cost', 'stock_added', 'city', 'carrier', 'order_ref', 'notes',
    ];

    protected $casts = [
        'occurred_on' => 'date:Y-m-d',
        'amount' => 'float',
        'unit_cost' => 'float',
        'quantity' => 'integer',
        'stock_added' => 'integer',
        'order_id' => 'integer',
        'item_id' => 'integer',
    ];

    /** Change this movement makes to each balance. */
    public function effect(): array
    {
        $a = (float) $this->amount;

        return match ($this->type) {
            self::INCOME => [$this->account === self::CASH ? 'cash' : 'bank' => $a] + ['cash' => 0.0, 'bank' => 0.0],
            self::EXPENSE => [$this->account === self::CASH ? 'cash' : 'bank' => -$a] + ['cash' => 0.0, 'bank' => 0.0],
            self::WITHDRAWAL => ['cash' => $a, 'bank' => -$a],
            self::DEPOSIT => ['cash' => -$a, 'bank' => $a],
            default => ['cash' => 0.0, 'bank' => 0.0],
        };
    }
}
