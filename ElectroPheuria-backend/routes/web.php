<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\ClientController;
use App\Http\Controllers\OrderController;

Route::get('/', function () {
    return view('welcome');
});

Route::get('/dashboard', function () {
    return view('dashboard');
})->name('dashboard');

Route::get('/clients', [ClientController::class, 'webIndex'])->name('clients.index');
Route::get('/clients/{id}', [ClientController::class, 'webShow'])->name('clients.show');

Route::get('/orders', [OrderController::class, 'webIndex'])->name('orders.index');
Route::put('/orders/{id}', [OrderController::class, 'webUpdateStatus'])->name('orders.update');
Route::get('/orders/history', [OrderController::class, 'webHistory'])->name('orders.history');
