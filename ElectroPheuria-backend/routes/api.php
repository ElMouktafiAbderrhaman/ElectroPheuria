<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\OrderController;
use App\Http\Controllers\ClientController;
use App\Http\Controllers\ProductController;
use App\Http\Controllers\AuthController;

// ── Public routes (no auth required) ──
Route::post('/auth/login', [AuthController::class, 'login']);
Route::post('/auth/forgot-password', [AuthController::class, 'forgotPassword']);
Route::post('/auth/reset-password', [AuthController::class, 'resetPassword']);

Route::get('/test', function () {
    return response()->json([
        'message' => 'ElectroPheuria backend working ✅'
    ]);
});

// Public: read products, deals (storefront)
Route::get('/products.php', [ProductController::class, 'index']);
Route::get('/deals.php', [ProductController::class, 'deals']);

// Public: place an order (customer checkout)
Route::post('/orders', [OrderController::class, 'store']);
Route::post('/orders.php', [OrderController::class, 'store']);

// ── Protected routes (admin dashboard – requires Sanctum token) ──
Route::middleware('auth:sanctum')->group(function () {

    Route::post('/auth/logout', [AuthController::class, 'logout']);

    // Orders management
    Route::put('/orders/{id}/status', [OrderController::class, 'updateStatus']);
    Route::get('/orders', [OrderController::class, 'index']);
    Route::get('/orders/history', [OrderController::class, 'history']);
    Route::get('/orders.php', [OrderController::class, 'index']);
    Route::get('/sales.php', [OrderController::class, 'history']);
    Route::get('/stats.php', [OrderController::class, 'stats']);
    Route::get('/monthly-sales', [OrderController::class, 'monthlySales']);

    // Clients
    Route::get('/clients.php', [ClientController::class, 'index']);
    Route::get('/clients', [ClientController::class, 'index']);
    Route::get('/clients/{id}', [ClientController::class, 'show']);

    // Products CRUD
    Route::post('/add_product.php', [ProductController::class, 'store']);
    Route::post('/update_product.php', [ProductController::class, 'update']);
    Route::delete('/delete_product.php', [ProductController::class, 'destroy']);

    // Deals CRUD
    Route::post('/add_deal.php', [ProductController::class, 'storeDeal']);
    Route::post('/update_deal.php', [ProductController::class, 'updateDeal']);
    Route::delete('/delete_deal.php', [ProductController::class, 'destroyDeal']);
});