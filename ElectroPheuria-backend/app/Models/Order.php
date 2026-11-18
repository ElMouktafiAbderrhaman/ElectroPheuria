<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Order extends Model
{
    use HasFactory;

    protected $fillable = ['client_id', 'products', 'subtotal', 'delivery_fee', 'total_price', 'status', 'client_data', 'locale', 'delivery_address'];

    protected $casts = [
        'products' => 'array',
        'client_data' => 'array',
        'confirmation_sent_at' => 'datetime',
        'subtotal' => 'float',
        'delivery_fee' => 'float',
        'total_price' => 'float',
    ];

    /** Product revenue of the order (what the items sold for), delivery fee excluded. */
    public function productsSubtotal(): float
    {
        return round($this->subtotal ?? ((float) $this->total_price - (float) $this->delivery_fee), 2);
    }

    public function client()
    {
        return $this->belongsTo(Client::class);
    }
}