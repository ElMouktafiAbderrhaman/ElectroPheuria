<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * A selectable cable type (Lightning / USB Type-C) of a product or of a single deal.
 * price / stock are optional overrides: null means "same as the product / deal".
 * Deal variants always use the deal's price and stock.
 */
class ProductVariant extends Model
{
    public const LIGHTNING = 'lightning';
    public const USB_C = 'usb_c';

    public const TYPES = [self::LIGHTNING, self::USB_C];

    public const LABELS = [
        self::LIGHTNING => 'Lightning',
        self::USB_C => 'USB Type-C',
    ];

    /** Folder on the "public" disk that holds variant images. */
    public const IMAGE_DIR = 'product-variants';

    protected $fillable = ['product_id', 'deal_id', 'type', 'image_path', 'price', 'stock', 'active', 'position'];

    protected $hidden = ['created_at', 'updated_at'];

    protected $appends = ['label', 'image_url'];

    protected $casts = [
        'price' => 'float',
        'stock' => 'integer',
        'active' => 'boolean',
        'position' => 'integer',
    ];

    public function product()
    {
        return $this->belongsTo(Product::class);
    }

    public function deal()
    {
        return $this->belongsTo(Deal::class);
    }

    public function getLabelAttribute(): string
    {
        return self::LABELS[$this->type] ?? (string) $this->type;
    }

    /** Public URL path of the image, served by ProductVariantController::image. */
    public function getImageUrlAttribute(): ?string
    {
        return self::imageUrlFor($this->image_path);
    }

    public static function imageUrlFor(?string $path): ?string
    {
        return $path ? '/api/product-variants/images/' . basename($path) : null;
    }

    /** Price the customer pays for one unit of this variant. */
    public function unitPrice(Product|Deal $item): float
    {
        return $this->price !== null ? (float) $this->price : (float) $item->price;
    }

    /** Units available: the variant's own stock, or the product's when none is set. */
    public function availableStock(Product|Deal $item): int
    {
        return $this->stock !== null ? (int) $this->stock : (int) $item->stock;
    }
}
