<?php

namespace App\Http\Controllers;

use App\Models\Client;
use App\Models\Order;
use App\Models\Product;
use App\Models\Deal;
use App\Models\User;
use App\Mail\NewOrderNotification;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;

class OrderController extends Controller
{
    public function store(Request $request)
    {
        $request->validate([
            'client' => 'required|array',
            'client.name' => 'required|string',
            'client.email' => 'nullable|email',
            'client.phone' => 'required|string',
            'client.address' => 'nullable|string',
            'products' => 'required|array',
            'total_price' => 'required|numeric',
        ]);

        return DB::transaction(function () use ($request) {
            $clientData = $request->input('client');
            $client = Client::updateOrCreate(
                ['phone' => $clientData['phone']],
                [
                    'name' => $clientData['name'],
                    'email' => $clientData['email'] ?? null,
                    'address' => $clientData['address'] ?? null,
                ]
            );

            // Decrement stock for each ordered product/deal
            foreach ($request->products as $item) {
                $quantity = $item['quantity'] ?? 1;
                $isDeal = !empty($item['isDeal']) || !empty($item['oldPrice']) || !empty($item['old_price']);

                if ($isDeal) {
                    $deal = Deal::find($item['id']);
                    if ($deal) {
                        $deal->decrement('stock', $quantity);
                        if ($deal->stock < 0) {
                            $deal->update(['stock' => 0]);
                        }
                    }
                } else {
                    $product = Product::find($item['id']);
                    if ($product) {
                        $product->decrement('stock', $quantity);
                        if ($product->stock < 0) {
                            $product->update(['stock' => 0]);
                        }
                    }
                }
            }

            $order = Order::create([
                'client_id' => $client->id,
                'client_data' => $request->input('client'),
                'products' => $request->products,
                'total_price' => $request->total_price,
                'status' => 'pending',
            ]);

            // Send email notification to admin + all users
            try {
                $clientData = $request->input('client');
                $products = is_array($request->products) ? $request->products : json_decode($request->products, true);

                $recipients = User::whereNotNull('email')->pluck('email')->toArray();
                $adminEmail = config('mail.from.address');
                if (!in_array($adminEmail, $recipients)) {
                    $recipients[] = $adminEmail;
                }

                Mail::to($recipients)->send(new NewOrderNotification($order, $clientData, $products));
            } catch (\Throwable $e) {
                \Log::error('Failed to send order email: ' . $e->getMessage());
            }

            return response()->json($order->load('client'), 201);
        });
    }

    public function updateStatus(Request $request, $id)
    {
        $request->validate([
            'status' => 'required|in:ongoing,done,cancelled,shipped,refunded',
        ]);

        $order = Order::findOrFail($id);
        $oldStatus = $order->status;

        // Restore stock if order is being cancelled or refunded (and wasn't already)
        if (in_array($request->status, ['cancelled', 'refunded']) && !in_array($oldStatus, ['cancelled', 'refunded'])) {
            $products = is_array($order->products) ? $order->products : json_decode($order->products, true);
            if ($products) {
                foreach ($products as $item) {
                    $quantity = $item['quantity'] ?? 1;
                    $isDeal = !empty($item['isDeal']) || !empty($item['oldPrice']) || !empty($item['old_price']);

                    if ($isDeal) {
                        $deal = Deal::find($item['id']);
                        if ($deal) {
                            $deal->increment('stock', $quantity);
                        }
                    } else {
                        $product = Product::find($item['id']);
                        if ($product) {
                            $product->increment('stock', $quantity);
                        }
                    }
                }
            }
        }

        $order->update(['status' => $request->status]);

        return response()->json($order->load('client'));
    }

    public function index()
    {
        $orders = Order::with('client')->get();
        return response()->json($orders);
    }

    public function webIndex()
    {
        $orders = Order::with('client')->get();
        return view('orders.index', compact('orders'));
    }

    public function history()
    {
        $orders = Order::with('client')->whereIn('status', ['done', 'cancelled', 'shipped', 'refunded'])->get();
        return response()->json($orders);
    }

    public function webHistory()
    {
        $orders = Order::with('client')->whereIn('status', ['done', 'cancelled', 'shipped', 'refunded'])->get();
        return view('orders.history', compact('orders'));
    }

    public function stats()
    {
        $total = Order::count();
        $pending = Order::where('status', 'pending')->count();
        $ongoing = Order::where('status', 'ongoing')->count();
        $done = Order::where('status', 'done')->count();
        $shipped = Order::where('status', 'shipped')->count();
        $cancelled = Order::where('status', 'cancelled')->count();
        $refunded = Order::where('status', 'refunded')->count();
        $totalSales = Order::where('status', 'shipped')->sum('total_price');
        $monthSales = Order::where('status', 'shipped')
            ->whereMonth('created_at', now()->month)
            ->whereYear('created_at', now()->year)
            ->sum('total_price');
        $totalCustomers = Client::count();
        $totalProducts = Product::count() + Deal::count();
        $totalDeals = Deal::count();

        return response()->json([
            'total' => $total,
            'pending' => $pending,
            'ongoing' => $ongoing,
            'done' => $done,
            'shipped' => $shipped,
            'cancelled' => $cancelled,
            'refunded' => $refunded,
            'total_sales' => $totalSales,
            'month_sales' => $monthSales,
            'total_orders' => $total,
            'total_customers' => $totalCustomers,
            'total_products' => $totalProducts,
            'total_deals' => $totalDeals,
        ]);
    }

    public function monthlySales(Request $request)
    {
        $year = $request->query('year', now()->year);

        $months = [];
        for ($m = 1; $m <= 12; $m++) {
            $sales = Order::where('status', 'shipped')
                ->whereMonth('created_at', $m)
                ->whereYear('created_at', $year)
                ->sum('total_price');
            $count = Order::where('status', 'shipped')
                ->whereMonth('created_at', $m)
                ->whereYear('created_at', $year)
                ->count();
            $months[] = [
                'month' => $m,
                'sales' => (float) $sales,
                'orders' => $count,
            ];
        }

        return response()->json([
            'year' => (int) $year,
            'months' => $months,
        ]);
    }
}
