<?php

namespace App\Http\Controllers;

use App\Models\Banner;
use App\Models\Deal;
use App\Models\Product;
use App\Support\OfferPricing;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class BannerController extends Controller
{
    private const TEXT_FIELDS = ['headline', 'subtitle', 'description', 'badge_text', 'button_text'];
    private const MAX_IMAGE_BYTES = 4 * 1024 * 1024; // length of the data URL
    // A bundle deal's two items are loaded too: its banner shows both item pictures.
    private const WITH = ['product', 'deal.bundleItems.product', 'deal.bundleItems.bundledDeal'];

    // =================== PUBLIC ===================

    // GET /api/banners — live banners only, with product/deal data resolved.
    public function index()
    {
        $banners = Banner::live()->ordered()->with(self::WITH)->get()
            ->reject(fn (Banner $b) => $b->sourceUnavailable())
            ->values();

        return response()->json($this->present($banners));
    }

    // GET /api/banners/{id}/image?slot=main|secondary&v=hash — the binary banner image, cacheable.
    public function image(Request $request, $id)
    {
        $banner = Banner::with(self::WITH)->findOrFail($id);
        $slot = (string) $request->query('slot', 'main');
        $source = match (true) {
            $slot === 'secondary' => $this->secondaryImageSource($banner),
            (bool) preg_match('/^item([01])$/', $slot, $m) => $this->bundleImageSources($banner)[(int) $m[1]]['image'] ?? null,
            default => $this->mainImageSource($banner),
        };

        if (!$source) {
            abort(404);
        }

        if (!str_starts_with($source, 'data:')) {
            // Remote / relative image URL stored on the product.
            return redirect()->away($source);
        }

        if (!preg_match('/^data:(image\/[a-z0-9.+-]+);base64,(.*)$/s', $source, $m)) {
            abort(404);
        }
        $binary = base64_decode($m[2], true);
        if ($binary === false) {
            abort(404);
        }

        return response($binary, 200, [
            'Content-Type' => $m[1],
            'Cache-Control' => 'public, max-age=31536000, immutable',
            'ETag' => '"' . md5($source) . '"',
        ]);
    }

    // =================== ADMIN ===================

    // GET /api/admin/banners — every banner with its status.
    public function adminIndex()
    {
        $banners = Banner::ordered()->with(self::WITH)->get();

        return response()->json($this->present($banners, true));
    }

    // GET /api/admin/banners/{id} — raw editable fields, including the custom image.
    public function show($id)
    {
        $banner = Banner::with(self::WITH)->findOrFail($id);

        return response()->json([
            ...$this->present(collect([$banner]), true)[0],
            'raw' => [
                ...$banner->only($banner->getFillable()),
                'image' => $banner->image,
                'start_date' => $banner->start_date?->toIso8601String(),
                'end_date' => $banner->end_date?->toIso8601String(),
            ],
        ]);
    }

    // POST /api/banners
    public function store(Request $request)
    {
        $data = $this->validated($request);
        $data['display_order'] ??= (int) Banner::max('display_order') + 1;

        $banner = Banner::create($data);

        return response()->json(['success' => true, 'id' => $banner->id], 201);
    }

    // PUT /api/banners/{id}
    public function update(Request $request, $id)
    {
        $banner = Banner::findOrFail($id);
        $banner->update($this->validated($request, $banner));

        return response()->json(['success' => true, 'id' => $banner->id]);
    }

    // PATCH /api/banners/{id}/active
    public function toggle(Request $request, $id)
    {
        $banner = Banner::findOrFail($id);
        $data = $request->validate(['active' => 'required|boolean']);
        $banner->update(['active' => $data['active']]);

        return response()->json(['success' => true, 'id' => $banner->id, 'active' => $banner->active, 'status' => $banner->status()]);
    }

    // PUT /api/banners/reorder — body: { ids: [3, 1, 2] }
    public function reorder(Request $request)
    {
        $data = $request->validate([
            'ids' => 'required|array|min:1',
            'ids.*' => 'integer|distinct|exists:banners,id',
        ]);

        DB::transaction(function () use ($data) {
            foreach ($data['ids'] as $position => $id) {
                Banner::whereKey($id)->update(['display_order' => $position + 1]);
            }
        });

        return response()->json(['success' => true]);
    }

    // DELETE /api/banners/{id}
    public function destroy($id)
    {
        Banner::whereKey($id)->delete();

        return response()->json(['success' => true]);
    }

    // =================== HELPERS ===================

    private function validated(Request $request, ?Banner $existing = null): array
    {
        $translations = [];
        foreach (self::TEXT_FIELDS as $field) {
            $max = $field === 'description' ? 400 : ($field === 'headline' ? 120 : 80);
            $translations[$field] = 'nullable|array';
            $translations["$field.fr"] = "nullable|string|max:$max";
            $translations["$field.en"] = "nullable|string|max:$max";
            $translations["$field.ar"] = "nullable|string|max:$max";
        }

        $color = ['nullable', 'string', 'regex:/^#[0-9a-fA-F]{6}$/'];
        $url = ['nullable', 'string', 'max:500', $this->urlRule()];

        $data = $request->validate([
            'title' => 'required|string|max:255',
            'promotion_type' => ['required', Rule::in(Banner::TYPES)],
            'product_id' => 'nullable|required_if:promotion_type,product|integer|exists:products,id',
            'deal_id' => 'nullable|required_if:promotion_type,deal|integer|exists:deals,id',
            'layout' => ['required', Rule::in(Banner::LAYOUTS)],
            ...$translations,
            'button_url' => $url,
            'image' => ['nullable', 'string', 'max:' . self::MAX_IMAGE_BYTES, 'regex:/^data:image\/(png|jpe?g|webp|gif);base64,/'],
            'background_color' => $color,
            'text_color' => $color,
            'accent_color' => $color,
            'original_price' => 'nullable|numeric|gt:0',
            'promotional_price' => 'nullable|numeric|min:0',
            'discount_percentage' => 'nullable|integer|min:1|max:99',
            'show_price' => 'boolean',
            'show_discount' => 'boolean',
            'start_date' => 'nullable|date',
            'end_date' => array_values(array_filter(['nullable', 'date', $request->filled('start_date') ? 'after:start_date' : null])),
            'active' => 'boolean',
            'display_order' => 'nullable|integer|min:0',

            'secondary' => 'nullable|array',
            'secondary.type' => ['required_with:secondary', Rule::in(Banner::TYPES)],
            'secondary.product_id' => 'nullable|required_if:secondary.type,product|integer|exists:products,id',
            'secondary.deal_id' => 'nullable|required_if:secondary.type,deal|integer|exists:deals,id',
            'secondary.label' => 'nullable|array',
            'secondary.label.*' => 'nullable|string|max:80',
            'secondary.headline' => 'nullable|array',
            'secondary.headline.*' => 'nullable|string|max:80',
            'secondary.note' => 'nullable|array',
            'secondary.note.*' => 'nullable|string|max:120',
            'secondary.badge_text' => 'nullable|array',
            'secondary.badge_text.*' => 'nullable|string|max:60',
            'secondary.original_price' => 'nullable|numeric|gt:0',
            'secondary.promotional_price' => 'nullable|numeric|min:0',
            'secondary.discount_percentage' => 'nullable|integer|min:1|max:99',
            'secondary.url' => $url,
        ], [
            'end_date.after' => 'The end date must be after the start date.',
            'image.regex' => 'The image must be a PNG, JPEG, WEBP or GIF.',
            'image.max' => 'The image is too large.',
        ]);

        if (isset($data['original_price'], $data['promotional_price']) && $data['promotional_price'] >= $data['original_price']) {
            throw ValidationException::withMessages(['promotional_price' => 'The promotional price must be lower than the original price.']);
        }
        if ($data['promotion_type'] === 'custom' && !$this->hasText($data['headline'] ?? null)) {
            throw ValidationException::withMessages(['headline' => 'A custom banner needs a headline in at least one language.']);
        }

        // Only keep the link that matches the promotion type.
        if ($data['promotion_type'] !== 'product') {
            $data['product_id'] = null;
        }
        if ($data['promotion_type'] !== 'deal') {
            $data['deal_id'] = null;
        }

        foreach (self::TEXT_FIELDS as $field) {
            if (array_key_exists($field, $data)) {
                $data[$field] = $this->cleanText($data[$field]);
            }
        }

        if (array_key_exists('secondary', $data) && $data['secondary'] !== null) {
            $s = $data['secondary'];
            $data['secondary'] = [
                'type' => $s['type'],
                'product_id' => $s['type'] === 'product' ? (int) $s['product_id'] : null,
                'deal_id' => $s['type'] === 'deal' ? (int) $s['deal_id'] : null,
                'label' => $this->cleanText($s['label'] ?? null),
                'headline' => $this->cleanText($s['headline'] ?? null),
                'note' => $this->cleanText($s['note'] ?? null),
                'badge_text' => $this->cleanText($s['badge_text'] ?? null),
                'original_price' => isset($s['original_price']) ? round((float) $s['original_price'], 2) : null,
                'promotional_price' => isset($s['promotional_price']) ? round((float) $s['promotional_price'], 2) : null,
                'discount_percentage' => $s['discount_percentage'] ?? null,
                'url' => $s['url'] ?? null,
            ];
        }

        foreach (['start_date', 'end_date'] as $field) {
            if (array_key_exists($field, $data)) {
                // Dates arrive as ISO strings from the browser; store them in UTC like now().
                $data[$field] = $data[$field] ? Carbon::parse($data[$field])->utc() : null;
            }
        }

        foreach (['background_color' => '#0b0b0d', 'text_color' => '#ffffff', 'accent_color' => '#FFD447'] as $field => $default) {
            if (array_key_exists($field, $data) && !$data[$field]) {
                $data[$field] = $default;
            }
        }

        // An omitted image keeps the stored one; an explicit null removes it.
        if (!$request->has('image')) {
            unset($data['image']);
        }

        return $data;
    }

    /** Relative paths ("/deal/3") or http(s) links only — never javascript: or protocol-relative URLs. */
    private function urlRule(): \Closure
    {
        return function (string $attribute, mixed $value, \Closure $fail) {
            if ($value === null || $value === '') {
                return;
            }
            $isPath = str_starts_with($value, '/') && !str_starts_with($value, '//');
            $isHttp = (bool) preg_match('#^https?://[^\s]+$#i', $value);
            if (!$isPath && !$isHttp) {
                $fail('The button link must start with / or https://');
            }
        };
    }

    private function cleanText(?array $value): ?array
    {
        if (!$value) {
            return null;
        }
        $clean = [];
        foreach (['fr', 'en', 'ar'] as $lang) {
            $clean[$lang] = trim((string) ($value[$lang] ?? ''));
        }

        return $this->hasText($clean) ? $clean : null;
    }

    private function hasText(?array $value): bool
    {
        return $value && collect($value)->contains(fn ($v) => is_string($v) && trim($v) !== '');
    }

    private function mainImageSource(Banner $banner): ?string
    {
        return $banner->image ?: $this->firstImage($banner->deal ?? $banner->product);
    }

    private function secondaryImageSource(Banner $banner): ?string
    {
        $s = $banner->secondary;
        if (!$s) {
            return null;
        }

        return $this->firstImage(match ($s['type'] ?? null) {
            'product' => Product::find($s['product_id'] ?? 0),
            'deal' => Deal::find($s['deal_id'] ?? 0),
            default => null,
        });
    }

    /**
     * The two items of a bundle deal banner, each with its first picture — only when the
     * banner has no custom image and both items have a picture (otherwise one image is shown).
     */
    private function bundleImageSources(Banner $banner): array
    {
        $deal = $banner->promotion_type === 'deal' ? $banner->deal : null;
        if (!$deal || !$deal->isBundle() || $banner->image) {
            return [];
        }
        $items = $deal->bundleItems
            ->map(fn ($row) => $row->item())
            ->filter()
            ->map(fn ($item) => ['name' => $item->name, 'image' => $this->firstImage($item)])
            ->values();

        return $items->count() === 2 && $items->every(fn ($i) => $i['image']) ? $items->all() : [];
    }

    private function firstImage($model): ?string
    {
        $images = $model?->images;
        $first = is_array($images) ? ($images[0] ?? null) : null;

        return is_string($first) && $first !== '' ? $first : null;
    }

    private function imageUrl(Banner $banner, ?string $source, string $slot = 'main'): ?string
    {
        if (!$source) {
            return null;
        }
        $query = http_build_query(array_filter([
            'slot' => $slot === 'main' ? null : $slot,
            'v' => substr(md5($source), 0, 12),
        ]));

        return "/api/banners/{$banner->id}/image?{$query}";
    }

    /**
     * Banner payload with prices, links and images resolved from the linked product/deal.
     * Stored overrides always win over the live product/deal values.
     */
    private function present($banners, bool $admin = false): array
    {
        $secondaryProducts = Product::whereIn('id', $banners->pluck('secondary.product_id')->filter()->unique())->get()->keyBy('id');
        $secondaryDeals = Deal::whereIn('id', $banners->pluck('secondary.deal_id')->filter()->unique())->get()->keyBy('id');

        return $banners->map(function (Banner $banner) use ($admin, $secondaryProducts, $secondaryDeals) {
            $source = match ($banner->promotion_type) {
                'product' => $banner->product,
                'deal' => $banner->deal,
                default => null,
            };

            $item = [
                'id' => $banner->id,
                'title' => $banner->title,
                'promotion_type' => $banner->promotion_type,
                'product_id' => $banner->product_id,
                'deal_id' => $banner->deal_id,
                'layout' => $banner->layout,
                'headline' => $banner->headline,
                'subtitle' => $banner->subtitle,
                'description' => $banner->description,
                'badge_text' => $banner->badge_text,
                'button_text' => $banner->button_text,
                'background_color' => $banner->background_color,
                'text_color' => $banner->text_color,
                'accent_color' => $banner->accent_color,
                'show_price' => $banner->show_price,
                'show_discount' => $banner->show_discount,
                ...$this->resolveOffer(
                    $banner->promotion_type,
                    $source,
                    $banner->original_price,
                    $banner->promotional_price,
                    $banner->discount_percentage,
                    $banner->button_url,
                ),
                'image_url' => $this->imageUrl($banner, $this->mainImageSource($banner)),
                'bundle_images' => collect($this->bundleImageSources($banner))->map(fn ($i, $n) => [
                    'name' => $i['name'],
                    'image_url' => $this->imageUrl($banner, $i['image'], "item$n"),
                ])->all(),
                'secondary' => null,
                'start_date' => $banner->start_date?->toIso8601String(),
                'end_date' => $banner->end_date?->toIso8601String(),
                'display_order' => $banner->display_order,
            ];

            if ($banner->layout === 'duo' && ($s = $banner->secondary)) {
                $secondarySource = match ($s['type'] ?? null) {
                    'product' => $secondaryProducts->get($s['product_id'] ?? 0),
                    'deal' => $secondaryDeals->get($s['deal_id'] ?? 0),
                    default => null,
                };
                $item['secondary'] = [
                    'type' => $s['type'],
                    'product_id' => $s['product_id'] ?? null,
                    'deal_id' => $s['deal_id'] ?? null,
                    'label' => $s['label'] ?? null,
                    'headline' => $s['headline'] ?? null,
                    'note' => $s['note'] ?? null,
                    'badge_text' => $s['badge_text'] ?? null,
                    ...$this->resolveOffer(
                        $s['type'],
                        $secondarySource,
                        $s['original_price'] ?? null,
                        $s['promotional_price'] ?? null,
                        $s['discount_percentage'] ?? null,
                        $s['url'] ?? null,
                    ),
                    'image_url' => $this->imageUrl($banner, $this->firstImage($secondarySource), 'secondary'),
                ];
            }

            if ($admin) {
                $item['active'] = $banner->active;
                $item['status'] = $banner->status();
                $item['source_unavailable'] = $banner->sourceUnavailable();
                $item['overrides'] = [
                    'original_price' => $banner->original_price,
                    'promotional_price' => $banner->promotional_price,
                    'discount_percentage' => $banner->discount_percentage,
                    'button_url' => $banner->button_url,
                ];
                $item['updated_at'] = $banner->updated_at?->toIso8601String();
            }

            return $item;
        })->all();
    }

    private function resolveOffer(string $type, $source, $originalOverride, $promoOverride, $discountOverride, ?string $urlOverride): array
    {
        $original = $originalOverride;
        $promo = $promoOverride;
        $discount = $discountOverride;
        $offerType = null;
        $secondItemPrice = null;

        if ($source instanceof Deal) {
            $offerType = $source->offer_type ?: OfferPricing::STANDARD;
            $secondItemPrice = $source->second_item_price;
            $promo ??= $source->price;
            if ($offerType === OfferPricing::STANDARD) {
                $original ??= $source->old_price > $source->price ? $source->old_price : null;
                $discount ??= $source->discount > 0 ? $source->discount : null;
            }
        } elseif ($source instanceof Product) {
            $promo ??= $source->price;
        }

        if ($discount === null && $original && $promo !== null && $promo < $original) {
            $discount = (int) round(($original - $promo) / $original * 100);
        }

        $defaultUrl = match (true) {
            $source instanceof Deal => "/deal/{$source->id}",
            $source instanceof Product => "/product/{$source->id}",
            default => '/products',
        };

        return [
            'name' => $source?->name,
            'source_description' => $source?->description,
            'original_price' => $original !== null ? (float) $original : null,
            'promotional_price' => $promo !== null ? (float) $promo : null,
            'discount_percentage' => $discount !== null ? (int) $discount : null,
            'offer_type' => $offerType,
            'second_item_price' => $secondItemPrice !== null ? (float) $secondItemPrice : null,
            'button_url' => $urlOverride ?: $defaultUrl,
        ];
    }
}
