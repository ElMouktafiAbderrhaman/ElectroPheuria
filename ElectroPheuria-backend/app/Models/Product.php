<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Product extends Model
{
    use HasFactory;

    public $timestamps = false;

    protected $fillable = ['name', 'price', 'description', 'stock', 'category', 'images', 'reviews', 'specs', 'gallery'];

    protected $casts = [
        'images' => 'array',
        'description' => 'array',
        'reviews' => 'array',
        'specs' => 'array',
        'gallery' => 'array',
        'price' => 'float',
        'stock' => 'integer',
    ];
}
