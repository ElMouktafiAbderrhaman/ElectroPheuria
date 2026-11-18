<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Product extends Model
{
    use HasFactory;

    public $timestamps = false;

    protected $fillable = ['name', 'price', 'description', 'stock', 'category', 'images', 'reviews', 'specs', 'gallery', 'coming_soon', 'has_variants', 'active'];

    // Supplier cost data is for the finance tracker only — never in the public catalogue JSON.
    protected $hidden = ['cost_price', 'packaging_cost', 'deal_price_2'];

    protected $casts = [
        'images' => 'array',
        'description' => 'array',
        'reviews' => 'array',
        'specs' => 'array',
        'gallery' => 'array',
        'price' => 'float',
        'stock' => 'integer',
        'coming_soon' => 'boolean',
        'active' => 'boolean',
        'has_variants' => 'boolean',
        'cost_price' => 'float',
        'packaging_cost' => 'float',
        'deal_price_2' => 'float',
    ];

    /** Cable variants (Lightning / USB Type-C), in display order. */
    public function variants()
    {
        return $this->hasMany(ProductVariant::class)->orderBy('position')->orderBy('id');
    }

    /** Variants a customer can currently pick (only when variants are enabled). */
    public function activeVariants()
    {
        return $this->variants()->where('active', true);
    }
}
