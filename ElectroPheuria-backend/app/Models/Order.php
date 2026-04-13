<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Order extends Model
{
    use HasFactory;

    protected $fillable = ['client_id', 'products', 'total_price', 'status', 'client_data'];

    protected $casts = [
        'products' => 'array',
        'client_data' => 'array',
    ];

    public function client()
    {
        return $this->belongsTo(Client::class);
    }
}