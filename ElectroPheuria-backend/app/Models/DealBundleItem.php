<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * One item of a two-item bundle deal: either a product (product_id) or another
 * single deal (bundled_deal_id). Items with cable variants let the customer choose the cable.
 */
class DealBundleItem extends Model
{
    public const KIND_PRODUCT = 'product';
    public const KIND_DEAL = 'deal';

    protected $fillable = ['deal_id', 'product_id', 'bundled_deal_id', 'position', 'quantity'];

    protected $casts = [
        'position' => 'integer',
        'quantity' => 'integer',
    ];

    public function deal()
    {
        return $this->belongsTo(Deal::class);
    }

    public function product()
    {
        return $this->belongsTo(Product::class);
    }

    public function bundledDeal()
    {
        return $this->belongsTo(Deal::class, 'bundled_deal_id');
    }

    public function kind(): string
    {
        return $this->bundled_deal_id ? self::KIND_DEAL : self::KIND_PRODUCT;
    }

    /** The product or deal this row points to (null when it was deleted). */
    public function item(): Product|Deal|null
    {
        return $this->bundled_deal_id ? $this->bundledDeal : $this->product;
    }

    /** Key of this item in an order's bundle_variants map: product id, or "deal-<id>". */
    public function choiceKey(): int|string
    {
        return $this->bundled_deal_id ? 'deal-' . $this->bundled_deal_id : (int) $this->product_id;
    }

    public function units(): int
    {
        return max((int) ($this->quantity ?? 1), 1);
    }

    /** Active cable variants the customer chooses from (a product or a single deal). */
    public function selectableVariants()
    {
        $item = $this->item();
        if (!$item || !$item->has_variants || ($item instanceof Deal && $item->isBundle())) {
            return collect();
        }
        return $item->variants->where('active', true)->values();
    }

    /** Regular price of one unit, used for the "original" combined price. */
    public function unitPrice(): float
    {
        return (float) ($this->item()?->price ?? 0);
    }

    /** Units the shop can still ship (all cable types together for a variant product). */
    public function availableStock(): int
    {
        $item = $this->item();
        if (!$item) {
            return 0;
        }
        $variants = $this->selectableVariants();
        if ($variants->isEmpty()) {
            return max((int) $item->stock, 0);
        }
        $tracked = $variants->whereNotNull('stock')->sum(fn ($v) => max((int) $v->stock, 0));
        $shared = $variants->contains(fn ($v) => $v->stock === null) ? max((int) $item->stock, 0) : 0;
        return (int) ($tracked + $shared);
    }

    /** Still orderable: exists and is not a "coming soon" teaser. */
    public function isAvailable(): bool
    {
        $item = $this->item();
        return $item !== null && !$item->coming_soon && !($item instanceof Deal && $item->isBundle());
    }
}
