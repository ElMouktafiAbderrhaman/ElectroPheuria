<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Deal extends Model
{
    use HasFactory;

    protected $fillable = ['name', 'description', 'old_price', 'price', 'discount', 'offer_type', 'second_item_price', 'stock', 'active', 'categories', 'images', 'reviews', 'specs', 'gallery', 'coming_soon', 'deal_type', 'has_variants'];

    // Supplier cost data is for the finance tracker only — never in the public catalogue JSON.
    protected $hidden = ['cost_price', 'packaging_cost'];

    protected $casts = [
        'images' => 'array',
        'categories' => 'array',
        'description' => 'array',
        'reviews' => 'array',
        'specs' => 'array',
        'gallery' => 'array',
        'price' => 'float',
        'old_price' => 'float',
        'discount' => 'integer',
        'second_item_price' => 'float',
        'stock' => 'integer',
        'active' => 'boolean',
        'coming_soon' => 'boolean',
        'has_variants' => 'boolean',
        'cost_price' => 'float',
        'packaging_cost' => 'float',
    ];

    public const TYPE_SINGLE = 'single';
    public const TYPE_BUNDLE = 'bundle';

    public function isBundle(): bool
    {
        return $this->deal_type === self::TYPE_BUNDLE;
    }

    /** The two items (products or deals) of a bundle deal. */
    public function bundleItems()
    {
        return $this->hasMany(DealBundleItem::class)->orderBy('position')->orderBy('id');
    }

    /** Relations to eager load before reading a bundle's items. */
    public const BUNDLE_WITH = ['variants', 'bundleItems.product.variants', 'bundleItems.bundledDeal.variants'];

    /** Cable variants of a single deal (they share the deal's price and stock). */
    public function variants()
    {
        return $this->hasMany(ProductVariant::class)->orderBy('position')->orderBy('id');
    }

    public function bundleProducts()
    {
        return $this->belongsToMany(Product::class, 'deal_bundle_items')
            ->withPivot(['position', 'quantity'])
            ->withTimestamps()
            ->orderBy('deal_bundle_items.position');
    }
}
