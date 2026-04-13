<?php

namespace App\Http\Controllers;

use App\Models\Product;
use App\Models\Deal;
use Illuminate\Http\Request;

class ProductController extends Controller
{
    // GET /api/products.php
    public function index()
    {
        $products = Product::orderBy('id', 'desc')->get();
        return response()->json($products);
    }

    // POST /api/add_product.php
    public function store(Request $request)
    {
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
        ]);

        return response()->json(['success' => true, 'id' => $product->id], 201);
    }

    // POST /api/update_product.php
    public function update(Request $request)
    {
        $product = Product::findOrFail($request->id);
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
        ]);

        return response()->json(['success' => true, 'id' => $product->id]);
    }

    // DELETE /api/delete_product.php?id=X
    public function destroy(Request $request)
    {
        $id = $request->query('id');
        Product::where('id', $id)->delete();
        return response()->json(['success' => true]);
    }

    // =================== DEALS ===================

    // GET /api/deals.php
    public function deals()
    {
        $deals = Deal::orderBy('created_at', 'desc')->get()->map(function ($deal) {
            $deal->oldPrice = $deal->old_price;
            unset($deal->old_price);
            return $deal;
        });
        return response()->json($deals);
    }

    // POST /api/add_deal.php
    public function storeDeal(Request $request)
    {
        $deal = Deal::create([
            'name' => $request->name,
            'description' => $request->description ?? '',
            'old_price' => $request->oldPrice ?? 0,
            'price' => $request->price ?? 0,
            'discount' => $request->discount ?? 0,
            'stock' => $request->stock ?? 0,
            'categories' => $request->categories ?? [],
            'images' => $request->images ?? [],
            'reviews' => $request->reviews ?? '',
        ]);

        return response()->json(['success' => true, 'id' => $deal->id], 201);
    }

    // POST /api/update_deal.php
    public function updateDeal(Request $request)
    {
        $deal = Deal::findOrFail($request->id);
        $deal->update([
            'name' => $request->name,
            'description' => $request->description ?? '',
            'old_price' => $request->oldPrice ?? $request->old_price ?? 0,
            'price' => $request->price ?? 0,
            'discount' => $request->discount ?? 0,
            'stock' => $request->stock ?? 0,
            'categories' => $request->categories ?? [],
            'images' => $request->images ?? [],
            'reviews' => $request->reviews ?? '',
        ]);

        return response()->json(['success' => true, 'id' => $deal->id]);
    }

    // DELETE /api/delete_deal.php?id=X
    public function destroyDeal(Request $request)
    {
        $id = $request->query('id');
        Deal::where('id', $id)->delete();
        return response()->json(['success' => true]);
    }
}
