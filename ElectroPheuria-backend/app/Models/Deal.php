<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Deal extends Model
{
    use HasFactory;

    protected $fillable = ['name', 'description', 'old_price', 'price', 'discount', 'stock', 'categories', 'images', 'reviews'];

    protected $casts = [
        'images' => 'array',
        'categories' => 'array',
        'description' => 'array',
        'reviews' => 'array',
        'price' => 'float',
        'old_price' => 'float',
        'discount' => 'integer',
        'stock' => 'integer',
    ];
}
