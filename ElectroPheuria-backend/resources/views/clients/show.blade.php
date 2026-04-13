<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Client Details - ElectroPheuria</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">
</head>
<body>
    <nav class="navbar navbar-expand-lg navbar-dark bg-dark">
        <div class="container">
            <a class="navbar-brand" href="#">ElectroPheuria</a>
            <div class="navbar-nav">
                <a class="nav-link" href="{{ route('dashboard') }}">Dashboard</a>
                <a class="nav-link" href="{{ route('clients.index') }}">Clients</a>
                <a class="nav-link" href="{{ route('orders.index') }}">Orders</a>
                <a class="nav-link" href="{{ route('orders.history') }}">Sales History</a>
            </div>
        </div>
    </nav>

    <div class="container mt-4">
        <h1>Client Information</h1>
        <div class="card">
            <div class="card-body">
                <h5 class="card-title">{{ $client->name }}</h5>
                <p class="card-text"><strong>Email:</strong> {{ $client->email }}</p>
                <p class="card-text"><strong>Phone:</strong> {{ $client->phone }}</p>
                <p class="card-text"><strong>Address:</strong> {{ $client->address }}</p>
            </div>
        </div>

        <h2 class="mt-4">Orders</h2>
        <table class="table table-striped">
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Products</th>
                    <th>Total Price</th>
                    <th>Status</th>
                    <th>Created At</th>
                </tr>
            </thead>
            <tbody>
                @foreach($client->orders as $order)
                <tr>
                    <td>{{ $order->id }}</td>
                    <td>
                        <ul>
                            @foreach($order->products as $product)
                            <li>{{ $product['name'] }} (Qty: {{ $product['quantity'] }})</li>
                            @endforeach
                        </ul>
                    </td>
                    <td>${{ number_format($order->total_price, 2) }}</td>
                    <td>{{ $order->status }}</td>
                    <td>{{ $order->created_at->format('Y-m-d H:i') }}</td>
                </tr>
                @endforeach
            </tbody>
        </table>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>