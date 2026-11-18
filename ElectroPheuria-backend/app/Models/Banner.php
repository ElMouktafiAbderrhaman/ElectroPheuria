<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

class Banner extends Model
{
    public const TYPES = ['product', 'deal', 'custom'];
    public const LAYOUTS = ['split', 'centered', 'duo', 'discount'];

    protected $fillable = [
        'title', 'promotion_type', 'product_id', 'deal_id', 'layout',
        'headline', 'subtitle', 'description', 'badge_text', 'button_text', 'button_url',
        'image', 'secondary', 'background_color', 'text_color', 'accent_color',
        'original_price', 'promotional_price', 'discount_percentage', 'show_price', 'show_discount',
        'start_date', 'end_date', 'active', 'display_order',
    ];

    // The image is a data URL; it is served by BannerController::image, never inlined in lists.
    protected $hidden = ['image'];

    protected $casts = [
        'headline' => 'array',
        'subtitle' => 'array',
        'description' => 'array',
        'badge_text' => 'array',
        'button_text' => 'array',
        'secondary' => 'array',
        'original_price' => 'float',
        'promotional_price' => 'float',
        'discount_percentage' => 'integer',
        'show_price' => 'boolean',
        'show_discount' => 'boolean',
        'start_date' => 'datetime',
        'end_date' => 'datetime',
        'active' => 'boolean',
        'display_order' => 'integer',
    ];

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function deal(): BelongsTo
    {
        return $this->belongsTo(Deal::class);
    }

    /** Active banners inside their schedule window. */
    public function scopeLive(Builder $query): Builder
    {
        $now = Carbon::now();

        return $query->where('active', true)
            ->where(fn ($q) => $q->whereNull('start_date')->orWhere('start_date', '<=', $now))
            ->where(fn ($q) => $q->whereNull('end_date')->orWhere('end_date', '>', $now));
    }

    public function scopeOrdered(Builder $query): Builder
    {
        return $query->orderBy('display_order')->orderBy('id');
    }

    /** active | inactive | scheduled | expired */
    public function status(): string
    {
        $now = Carbon::now();
        if ($this->end_date && $this->end_date->lte($now)) {
            return 'expired';
        }
        if (!$this->active) {
            return 'inactive';
        }
        if ($this->start_date && $this->start_date->gt($now)) {
            return 'scheduled';
        }

        return 'active';
    }

    /** The linked product or deal has been deleted or the deal is switched off. */
    public function sourceUnavailable(): bool
    {
        return match ($this->promotion_type) {
            'product' => !$this->product,
            'deal' => !$this->deal || !$this->deal->active,
            default => false,
        };
    }
}
