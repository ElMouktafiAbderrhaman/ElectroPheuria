<?php

namespace App\Http\Controllers;

use App\Models\Product;
use App\Models\Deal;
use App\Models\DealBundleItem;
use App\Models\ProductVariant;
use App\Support\OfferPricing;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class ProductController extends Controller
{
    // GET /api/products.php
    public function index()
    {
        // Hidden products are only listed for authenticated admins (dashboard).
        $products = Product::with('variants')
            ->when(!auth('sanctum')->check(), fn ($q) => $q->where('active', true))
            ->orderBy('id', 'desc')->get();
        return response()->json($products);
    }

    // POST /api/add_product.php
    public function store(Request $request)
    {
        $variants = $this->validatedVariants($request);

        $product = DB::transaction(function () use ($request, $variants) {
        $product = Product::create([
            'name' => $request->name,
            'price' => $request->price,
            'description' => $request->description ?? '',
            'stock' => $request->stock ?? 0,
            'category' => $request->category ?? '',
            'images' => $request->images ?? [],
            'reviews' => $request->reviews ?? '',
            'specs' => $request->specs ?? [],
            'gallery' => $request->gallery ?? [],
            'coming_soon' => $request->boolean('coming_soon'),
            'active' => $request->boolean('active', true),
            'has_variants' => $variants['enabled'],
        ]);
        if ($variants['rows'] !== null) {
            $this->syncVariants($product, $variants['rows']);
        }
        return $product;
        });

        return response()->json(['success' => true, 'id' => $product->id], 201);
    }

    // POST /api/update_product.php
    public function update(Request $request)
    {
        $product = Product::findOrFail($request->route('id') ?? $request->id);
        $variants = $this->validatedVariants($request, $product);

        DB::transaction(function () use ($request, $product, $variants) {
        $product->update([
            'name' => $request->name,
            'price' => $request->price,
            'description' => $request->description ?? '',
            'stock' => $request->stock ?? 0,
            'category' => $request->category ?? '',
            'images' => $request->images ?? [],
            'reviews' => $request->reviews ?? '',
            'specs' => $request->specs ?? [],
            'gallery' => $request->gallery ?? [],
            'coming_soon' => $request->boolean('coming_soon', (bool) $product->coming_soon),
            'active' => $request->boolean('active', (bool) $product->active),
            'has_variants' => $variants['enabled'],
        ]);
        if ($variants['rows'] !== null) {
            $this->syncVariants($product, $variants['rows']);
        }
        });

        return response()->json(['success' => true, 'id' => $product->id]);
    }

    // GET /api/products/{id}
    public function show($id)
    {
        $product = Product::with('variants')->findOrFail($id);
        // Hidden products are only visible to authenticated admins (packs that contain them still work).
        if (!$product->active && !auth('sanctum')->check()) {
            abort(404);
        }
        return response()->json($product);
    }

    // DELETE /api/products/{id}
    public function destroy($id)
    {
        $product = Product::with('variants')->find($id);
        if ($product) {
            $paths = $product->variants->pluck('image_path')->filter()->all();
            // Variants and bundle rows go with the product (FK cascade); a bundle that
            // loses a product becomes unavailable instead of being deleted.
            $product->delete();
            $this->deleteVariantImages($paths);
        }
        return response()->json(['success' => true]);
    }

    // =================== CABLE VARIANTS ===================

    /**
     * Validate the optional cable variants of a product.
     * rows = null when the request does not send variants (older dashboard builds): nothing changes.
     *
     * @return array{enabled: bool, rows: ?array}
     */
    private function validatedVariants(Request $request, ?Product $existing = null): array
    {
        if (!$request->has('variants')) {
            return ['enabled' => (bool) ($existing->has_variants ?? false), 'rows' => null];
        }

        $data = validator($request->only(['has_variants', 'variants']), [
            'has_variants' => 'nullable|boolean',
            'variants' => 'nullable|array|max:' . count(ProductVariant::TYPES),
            'variants.*.type' => ['required', 'string', 'distinct', Rule::in(ProductVariant::TYPES)],
            'variants.*.image_path' => 'required|string|max:255',
            'variants.*.price' => 'nullable|numeric|gt:0|max:9999999',
            'variants.*.stock' => 'nullable|integer|min:0|max:1000000',
            'variants.*.active' => 'nullable|boolean',
        ], [
            'variants.*.type.in' => 'Unknown cable type.',
            'variants.*.type.distinct' => 'Each cable type can only be added once.',
            'variants.*.image_path.required' => 'Upload an image for every cable variant.',
            'variants.*.price.gt' => 'A variant price must be greater than 0.',
            'variants.*.stock.min' => 'A variant stock cannot be negative.',
        ])->validate();

        $enabled = (bool) ($data['has_variants'] ?? false);
        $rows = [];
        $errors = [];
        foreach (array_values($data['variants'] ?? []) as $i => $v) {
            if (!ProductVariantController::isStoredImage($v['image_path'])) {
                $errors["variants.$i.image_path"] = 'The image for ' . ProductVariant::LABELS[$v['type']] . ' was not found. Please upload it again.';
            }
            $rows[] = [
                'type' => $v['type'],
                'image_path' => $v['image_path'],
                'price' => isset($v['price']) && $v['price'] !== '' ? round((float) $v['price'], 2) : null,
                'stock' => isset($v['stock']) && $v['stock'] !== '' ? (int) $v['stock'] : null,
                'active' => array_key_exists('active', $v) && $v['active'] !== null ? (bool) $v['active'] : true,
            ];
        }

        if ($enabled && !collect($rows)->contains('active', true)) {
            $errors['variants'] = 'Enable at least one cable variant, or turn cable variants off.';
        }
        if ($errors) {
            throw ValidationException::withMessages($errors);
        }

        return ['enabled' => $enabled, 'rows' => $rows];
    }

    /** Replace the product's variants with $rows (matched by type) and delete images no longer used. */
    private function syncVariants(Product $product, array $rows): void
    {
        $previousImages = $product->variants()->pluck('image_path')->filter()->all();
        $keep = [];
        $usedImages = [];

        foreach (ProductVariant::TYPES as $position => $type) {
            $row = collect($rows)->firstWhere('type', $type);
            if (!$row) {
                continue;
            }
            $keep[] = $type;
            $usedImages[] = $row['image_path'];
            $product->variants()->updateOrCreate(['type' => $type], [
                'image_path' => $row['image_path'],
                'price' => $row['price'],
                'stock' => $row['stock'],
                'active' => $row['active'],
                'position' => $position,
            ]);
        }

        $product->variants()->whereNotIn('type', $keep)->delete();

        $orphans = array_values(array_diff($previousImages, $usedImages));
        DB::afterCommit(fn () => $this->deleteVariantImages($orphans));
    }

    private function deleteVariantImages(array $paths): void
    {
        foreach ($paths as $path) {
            if (is_string($path) && str_starts_with($path, ProductVariant::IMAGE_DIR . '/')) {
                Storage::disk('public')->delete($path);
            }
        }
    }

    // =================== DEALS ===================

    /**
     * Validate the manually entered deal prices and derive the discount from them,
     * so the stored percentage always matches the stored prices.
     *
     * "Buy 1, get the 2nd at 50% off / for X MAD" deals carry no promotional price (old_price = price,
     * discount = 0) so the two offers never stack on the same item.
     */
    private function validatedDealPricing(Request $request, ?Deal $existing = null): array
    {
        if ($this->requestedDealType($request, $existing) === Deal::TYPE_BUNDLE) {
            return $this->validatedBundlePricing($request, $existing);
        }

        $offerType = $request->input('offer_type', $existing->offer_type ?? OfferPricing::STANDARD);
        validator(['offer_type' => $offerType], [
            'offer_type' => ['required', Rule::in(OfferPricing::TYPES)],
        ])->validate();

        if ($offerType === OfferPricing::BOGO_HALF) {
            $data = validator(['name' => $request->name, 'price' => $request->price], [
                'name' => 'required|string|max:255',
                'price' => 'required|numeric|gt:0',
            ], [
                'price.required' => 'Unit price is required.',
                'price.gt' => 'Unit price must be greater than 0.',
            ])->validate();

            $price = round((float) $data['price'], 2);

            return [
                'offer_type' => OfferPricing::BOGO_HALF,
                'old_price' => $price,
                'price' => $price,
                'discount' => 0,
                'second_item_price' => null,
            ];
        }

        if ($offerType === OfferPricing::BOGO_FIXED) {
            $data = validator([
                'name' => $request->name,
                'price' => $request->price,
                'second_item_price' => $request->input('second_item_price', $existing->second_item_price ?? null),
            ], [
                'name' => 'required|string|max:255',
                'price' => 'required|numeric|gt:0',
                'second_item_price' => 'required|numeric|min:0|lt:price',
            ], [
                'price.required' => 'Unit price is required.',
                'price.gt' => 'Unit price must be greater than 0.',
                'second_item_price.required' => 'Price of the second item is required.',
                'second_item_price.min' => 'Price of the second item cannot be negative.',
                'second_item_price.lt' => 'Price of the second item must be lower than the unit price.',
            ])->validate();

            $price = round((float) $data['price'], 2);

            return [
                'offer_type' => OfferPricing::BOGO_FIXED,
                'old_price' => $price,
                'price' => $price,
                'discount' => 0,
                'second_item_price' => round((float) $data['second_item_price'], 2),
            ];
        }

        $input = [
            'name' => $request->name,
            'old_price' => $request->oldPrice ?? $request->old_price,
            'price' => $request->price,
        ];

        $data = validator($input, [
            'name' => 'required|string|max:255',
            'old_price' => 'required|numeric|gt:0',
            'price' => 'required|numeric|gt:0|lt:old_price',
        ], [
            'old_price.required' => 'Original price is required.',
            'old_price.gt' => 'Original price must be greater than 0.',
            'price.required' => 'Promotional price is required.',
            'price.gt' => 'Promotional price must be greater than 0.',
            'price.lt' => 'Promotional price must be lower than the original price.',
        ])->validate();

        $oldPrice = round((float) $data['old_price'], 2);
        $price = round((float) $data['price'], 2);

        return [
            'offer_type' => OfferPricing::STANDARD,
            'old_price' => $oldPrice,
            'price' => $price,
            'discount' => (int) round(($oldPrice - $price) / $oldPrice * 100),
            'second_item_price' => null,
        ];
    }

    // =================== BUNDLE DEALS ===================

    private function requestedDealType(Request $request, ?Deal $existing = null): string
    {
        $type = $request->input('deal_type', $existing->deal_type ?? Deal::TYPE_SINGLE);

        validator(['deal_type' => $type], [
            'deal_type' => ['required', Rule::in([Deal::TYPE_SINGLE, Deal::TYPE_BUNDLE])],
        ])->validate();

        return $type;
    }

    /**
     * Two different existing items (products and/or single deals) sold together for one
     * promotional price. The original price is always the sum of the two items' current prices.
     *
     * Input: bundle_items = [{type: product|deal, id}, …]. Older dashboard builds send
     * bundle_product_ids = [productId, productId], which is still accepted.
     */
    private function validatedBundlePricing(Request $request, ?Deal $existing = null): array
    {
        validator(['price' => $request->price, 'name' => $request->name], [
            'price' => 'required|numeric|gt:0',
            'name' => 'nullable|string|max:255',
        ], [
            'price.required' => 'Bundle price is required.',
            'price.gt' => 'Bundle price must be greater than 0.',
        ])->validate();

        $refs = $request->has('bundle_items')
            ? $this->validatedBundleRefs($request, $existing)
            : $this->legacyBundleRefs($request);

        $products = Product::whereIn('id', $this->refIds($refs, DealBundleItem::KIND_PRODUCT))->get()->keyBy('id');
        $deals = Deal::whereIn('id', $this->refIds($refs, DealBundleItem::KIND_DEAL))->get()->keyBy('id');

        $items = [];
        foreach ($refs as $i => $ref) {
            $model = $ref['type'] === DealBundleItem::KIND_DEAL ? ($deals[$ref['id']] ?? null) : ($products[$ref['id']] ?? null);
            if (!$model) {
                throw ValidationException::withMessages([
                    "bundle_items.$i" => 'One of the selected items no longer exists.',
                ]);
            }
            if ($model instanceof Deal && $model->isBundle()) {
                throw ValidationException::withMessages([
                    "bundle_items.$i" => "\"{$model->name}\" is already a pack and cannot be put inside another pack.",
                ]);
            }
            $items[] = $model;
        }

        $oldPrice = round(array_sum(array_map(fn ($m) => (float) $m->price, $items)), 2);
        $price = round((float) $request->price, 2);
        if (!($oldPrice > 0) || $price >= $oldPrice) {
            throw ValidationException::withMessages([
                'price' => 'The bundle price must be lower than the combined price of the two items (' . number_format($oldPrice, 2) . ' MAD).',
            ]);
        }

        $name = trim((string) ($request->name ?? ''));

        return [
            'deal_type' => Deal::TYPE_BUNDLE,
            'offer_type' => OfferPricing::STANDARD,
            'old_price' => $oldPrice,
            'price' => $price,
            'discount' => (int) round(($oldPrice - $price) / $oldPrice * 100),
            'second_item_price' => null,
            '_name' => $name !== '' ? $name : $items[0]->name . ' + ' . $items[1]->name,
            '_bundle_refs' => $refs,
        ];
    }

    private function refIds(array $refs, string $type): array
    {
        return array_values(array_map(fn ($r) => $r['id'], array_filter($refs, fn ($r) => $r['type'] === $type)));
    }

    /** @return array<int, array{type: string, id: int}> */
    private function validatedBundleRefs(Request $request, ?Deal $existing): array
    {
        $data = validator(['bundle_items' => $request->input('bundle_items')], [
            'bundle_items' => 'required|array|size:2',
            'bundle_items.*' => 'required|array',
            'bundle_items.*.type' => ['required', Rule::in([DealBundleItem::KIND_PRODUCT, DealBundleItem::KIND_DEAL])],
            'bundle_items.*.id' => 'required|integer|min:1',
        ], [
            'bundle_items.required' => 'Select the two items of the bundle.',
            'bundle_items.size' => 'A bundle must contain exactly two items.',
            'bundle_items.*.required' => 'Select the two items of the bundle.',
            'bundle_items.*.type.*' => 'Select the two items of the bundle.',
            'bundle_items.*.id.*' => 'Select the two items of the bundle.',
        ])->validate();

        $refs = array_map(fn ($r) => ['type' => $r['type'], 'id' => (int) $r['id']], array_values($data['bundle_items']));

        if ($refs[0] === $refs[1]) {
            throw ValidationException::withMessages(['bundle_items.1' => 'Select two different items.']);
        }
        foreach ($refs as $i => $ref) {
            if ($existing && $ref['type'] === DealBundleItem::KIND_DEAL && $ref['id'] === (int) $existing->id) {
                throw ValidationException::withMessages(["bundle_items.$i" => 'A pack cannot contain itself.']);
            }
        }

        return $refs;
    }

    /** Older dashboard builds: two product ids. */
    private function legacyBundleRefs(Request $request): array
    {
        $data = validator(['bundle_product_ids' => $request->input('bundle_product_ids')], [
            'bundle_product_ids' => 'required|array|size:2',
            'bundle_product_ids.*' => 'required|integer|distinct|exists:products,id',
        ], [
            'bundle_product_ids.required' => 'Select the two products of the bundle.',
            'bundle_product_ids.size' => 'A bundle must contain exactly two products.',
            'bundle_product_ids.*.distinct' => 'Select two different products.',
            'bundle_product_ids.*.exists' => 'One of the selected products no longer exists.',
        ])->validate();

        return array_map(fn ($id) => ['type' => DealBundleItem::KIND_PRODUCT, 'id' => (int) $id], array_values($data['bundle_product_ids']));
    }

    /** Replace a deal's bundle rows with $refs (null = not a bundle any more). */
    private function syncBundleItems(Deal $deal, ?array $refs): void
    {
        $deal->bundleItems()->delete();
        foreach (array_values($refs ?? []) as $position => $ref) {
            DealBundleItem::create([
                'deal_id' => $deal->id,
                'product_id' => $ref['type'] === DealBundleItem::KIND_PRODUCT ? $ref['id'] : null,
                'bundled_deal_id' => $ref['type'] === DealBundleItem::KIND_DEAL ? $ref['id'] : null,
                'position' => $position,
                'quantity' => 1,
            ]);
        }
    }

    /** Storefront JSON for one bundle item (null when the product / deal was deleted). */
    private function bundleItemPayload(DealBundleItem $row): ?array
    {
        $item = $row->item();
        if (!$item) {
            return null;
        }
        $kind = $row->kind();
        $images = is_array($item->images) ? $item->images : [];

        return [
            'kind' => $kind,
            'id' => $item->id,
            'key' => $kind . '-' . $item->id,
            'name' => $item->name,
            'price' => (float) $item->price,
            'stock' => $row->availableStock(),
            'quantity' => $row->units(),
            'category' => $item instanceof Deal ? (($item->categories ?? [])[0] ?? null) : $item->category,
            'image' => $images[0] ?? null,
            'coming_soon' => (bool) $item->coming_soon,
            'available' => $row->isAvailable(),
            // Cable types the customer chooses from inside the pack.
            'variants' => $row->selectableVariants()->map(fn (ProductVariant $v) => [
                'id' => $v->id,
                'type' => $v->type,
                'label' => $v->label,
                'image_url' => $v->image_url,
                'stock' => $v->availableStock($item),
            ])->values()->all(),
        ];
    }

    /**
     * Storefront JSON for a deal. Bundles get their items, a live combined price,
     * the matching discount and a stock limited by the scarcer item.
     */
    private function dealPayload(Deal $deal): Deal
    {
        $deal->oldPrice = $deal->old_price;

        if ($deal->isBundle()) {
            $items = $deal->bundleItems->map(fn (DealBundleItem $row) => $this->bundleItemPayload($row))->filter()->values();

            $complete = $items->count() === 2 && $items->every(fn ($i) => $i['available']);
            $combined = round($items->sum(fn ($i) => $i['price'] * $i['quantity']), 2);
            if ($combined > 0) {
                $deal->oldPrice = $combined;
                $deal->discount = $combined > $deal->price ? (int) round(($combined - $deal->price) / $combined * 100) : 0;
            }
            $deal->stock = $complete ? (int) $items->min(fn ($i) => intdiv(max($i['stock'], 0), max($i['quantity'], 1))) : 0;
            $deal->bundle_products = $items->all();
            $deal->bundle_complete = $complete;
            if (empty($deal->images)) {
                $deal->images = $items->pluck('image')->filter()->values()->all();
                // Tells the dashboard not to save these item images back onto the deal.
                $deal->images_from_products = true;
            }
        }

        $deal->unsetRelation('bundleItems');
        unset($deal->old_price);
        return $deal;
    }

    // GET /api/deals.php
    public function deals()
    {
        $deals = Deal::with(Deal::BUNDLE_WITH)->orderBy('created_at', 'desc')->get()
            ->map(fn ($deal) => $this->dealPayload($deal));
        return response()->json($deals);
    }

    /** Split the internal bundle keys off the validated pricing. */
    private function splitPricing(array $pricing, Request $request): array
    {
        $bundleIds = $pricing['_bundle_refs'] ?? null;
        $name = $pricing['_name'] ?? $request->name;
        unset($pricing['_bundle_refs'], $pricing['_name']);
        $pricing['deal_type'] = $pricing['deal_type'] ?? Deal::TYPE_SINGLE;

        return [$pricing, $bundleIds, $name];
    }

    // POST /api/add_deal.php
    public function storeDeal(Request $request)
    {
        [$pricing, $bundleIds, $name] = $this->splitPricing($this->validatedDealPricing($request), $request);

        $deal = DB::transaction(function () use ($request, $pricing, $bundleIds, $name) {
            $deal = Deal::create([
                'name' => $name,
                'description' => $request->description ?? '',
                ...$pricing,
                // A bundle's stock comes from its two products.
                'stock' => $bundleIds ? 0 : ($request->stock ?? 0),
                'active' => $request->boolean('active', true),
                'coming_soon' => $request->boolean('coming_soon'),
                'categories' => $request->categories ?? [],
                'images' => $request->images ?? [],
                'reviews' => $request->reviews ?? '',
                'specs' => $request->specs ?? [],
                'gallery' => $request->gallery ?? [],
            ]);
            if ($bundleIds) {
                $this->syncBundleItems($deal, $bundleIds);
            }
            return $deal;
        });

        return response()->json(['success' => true, 'id' => $deal->id], 201);
    }

    // POST /api/update_deal.php
    public function updateDeal(Request $request)
    {
        $deal = Deal::findOrFail($request->route('id') ?? $request->id);
        [$pricing, $bundleIds, $name] = $this->splitPricing($this->validatedDealPricing($request, $deal), $request);

        DB::transaction(function () use ($request, $deal, $pricing, $bundleIds, $name) {
            $deal->update([
                'name' => $name,
                'description' => $request->description ?? '',
                ...$pricing,
                'stock' => $bundleIds ? 0 : ($request->stock ?? 0),
                'active' => $request->boolean('active', $deal->active ?? true),
                'coming_soon' => $request->boolean('coming_soon', (bool) $deal->coming_soon),
                'categories' => $request->categories ?? [],
                'images' => $request->images ?? [],
                'reviews' => $request->reviews ?? '',
                'specs' => $request->specs ?? [],
                'gallery' => $request->gallery ?? [],
            ]);
            $this->syncBundleItems($deal, $bundleIds);
        });

        return response()->json(['success' => true, 'id' => $deal->id]);
    }

    // GET /api/deals/{id}
    public function showDeal($id)
    {
        $deal = Deal::with(Deal::BUNDLE_WITH)->findOrFail($id);
        // Inactive deals are only visible to authenticated admins.
        if (!$deal->active && !auth('sanctum')->check()) {
            abort(404);
        }
        return response()->json($this->dealPayload($deal));
    }

    // DELETE /api/deals/{id}
    public function destroyDeal($id)
    {
        // Bundle rows cascade with the deal; the bundled products are never touched.
        Deal::where('id', $id)->delete();
        return response()->json(['success' => true]);
    }
}
