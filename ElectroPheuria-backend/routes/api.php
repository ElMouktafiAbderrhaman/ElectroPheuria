<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\OrderController;
use App\Http\Controllers\ClientController;
use App\Http\Controllers\ProductController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\BannerController;
use App\Http\Controllers\FinanceController;
use App\Http\Controllers\ProductVariantController;

// ── Public routes (no auth required) ──
Route::post('/auth/login', [AuthController::class, 'login']);
Route::post('/auth/forgot-password', [AuthController::class, 'forgotPassword']);
Route::post('/auth/reset-password', [AuthController::class, 'resetPassword']);

Route::get('/test', function () {
    return response()->json([
        'message' => 'ElectroPheuria backend working ✅'
    ]);
});

// Public: read products, deals (storefront) - CLEAN REST ROUTES
Route::get('/products', [ProductController::class, 'index']);
Route::get('/products/{id}', [ProductController::class, 'show']);
Route::get('/deals', [ProductController::class, 'deals']);
Route::get('/deals/{id}', [ProductController::class, 'showDeal']);

// Public: cable variant images (files on the public disk)
Route::get('/product-variants/images/{file}', [ProductVariantController::class, 'image'])->where('file', '[a-z0-9]{32}\.(jpg|png|webp)');

// Public: live homepage banners and their images
Route::get('/banners', [BannerController::class, 'index']);
Route::get('/banners/{id}/image', [BannerController::class, 'image'])->whereNumber('id');

// Backward compatibility with old .php-style routes
Route::get('/products.php', [ProductController::class, 'index']);
Route::get('/deals.php', [ProductController::class, 'deals']);

// Public: place an order (customer checkout)
Route::post('/orders', [OrderController::class, 'store']);
// Public: exact checkout amounts (offers + delivery) and stock check — nothing is saved
Route::post('/orders/quote', [OrderController::class, 'quote'])->middleware('throttle:120,1');
Route::post('/orders.php', [OrderController::class, 'store']);

// ── Protected routes (admin dashboard – requires Sanctum token) ──
Route::middleware('auth:sanctum')->group(function () {

    Route::post('/auth/logout', [AuthController::class, 'logout']);

    // Orders management - CLEAN REST ROUTES
    Route::put('/orders/{id}/status', [OrderController::class, 'updateStatus']);
    Route::get('/orders', [OrderController::class, 'index']);
    Route::get('/orders/history', [OrderController::class, 'history']);
    // Units to prepare per product over pending + confirmed orders
    Route::get('/orders/merchandise', [OrderController::class, 'merchandise']);
    Route::get('/stats', [OrderController::class, 'stats']);
    Route::get('/monthly-sales', [OrderController::class, 'monthlySales']);

    // Backward compatibility with old routes
    Route::get('/orders.php', [OrderController::class, 'index']);
    Route::get('/sales.php', [OrderController::class, 'history']);

    // Clients - CLEAN REST ROUTES
    Route::get('/clients', [ClientController::class, 'index']);
    Route::get('/clients/{id}', [ClientController::class, 'show']);
    Route::get('/clients/{id}/orders', [ClientController::class, 'orders']);

    // Backward compatibility
    Route::get('/clients.php', [ClientController::class, 'index']);

    // Products CRUD - CLEAN REST ROUTES
    Route::post('/products', [ProductController::class, 'store']);
    Route::put('/products/{id}', [ProductController::class, 'update']);
    Route::delete('/products/{id}', [ProductController::class, 'destroy']);

    // Backward compatibility with old routes
    Route::post('/add_product.php', [ProductController::class, 'store']);
    Route::post('/update_product.php', [ProductController::class, 'update']);
    Route::delete('/delete_product.php', [ProductController::class, 'destroy']);

    // Cable variant image upload (returns the stored path to save with the product)
    Route::post('/product-variants/images', [ProductVariantController::class, 'upload']);

    // Deals CRUD - CLEAN REST ROUTES
    Route::post('/deals', [ProductController::class, 'storeDeal']);
    Route::put('/deals/{id}', [ProductController::class, 'updateDeal']);
    Route::delete('/deals/{id}', [ProductController::class, 'destroyDeal']);

    // Backward compatibility with old routes
    Route::post('/add_deal.php', [ProductController::class, 'storeDeal']);
    Route::post('/update_deal.php', [ProductController::class, 'updateDeal']);
    Route::delete('/delete_deal.php', [ProductController::class, 'destroyDeal']);

    // Homepage banners management
    Route::get('/admin/banners', [BannerController::class, 'adminIndex']);
    Route::get('/admin/banners/{id}', [BannerController::class, 'show'])->whereNumber('id');
    Route::post('/banners', [BannerController::class, 'store']);
    Route::put('/banners/reorder', [BannerController::class, 'reorder']);
    Route::put('/banners/{id}', [BannerController::class, 'update'])->whereNumber('id');
    Route::patch('/banners/{id}/active', [BannerController::class, 'toggle'])->whereNumber('id');
    Route::delete('/banners/{id}', [BannerController::class, 'destroy'])->whereNumber('id');

    // Finance tracker (bank balance + supplier costs: admin only)
    Route::get('/finance', [FinanceController::class, 'index']);
    Route::put('/finance/settings', [FinanceController::class, 'updateSettings']);
    Route::post('/finance/movements', [FinanceController::class, 'storeMovement']);
    Route::put('/finance/movements/{id}', [FinanceController::class, 'updateMovement'])->whereNumber('id');
    Route::delete('/finance/movements/{id}', [FinanceController::class, 'destroyMovement'])->whereNumber('id');
    Route::get('/finance/spending', [FinanceController::class, 'spending']);
    Route::post('/finance/expenses', [FinanceController::class, 'storeExpense']);
    Route::put('/finance/expenses/{id}', [FinanceController::class, 'updateExpense'])->whereNumber('id');
    Route::delete('/finance/expenses/{id}', [FinanceController::class, 'destroyExpense'])->whereNumber('id');
    Route::put('/finance/items/{type}/{id}', [FinanceController::class, 'updateItem'])->whereIn('type', ['product', 'deal'])->whereNumber('id');
});