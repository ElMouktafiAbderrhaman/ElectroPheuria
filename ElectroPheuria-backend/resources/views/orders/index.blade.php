<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Orders - ElectroPheuria</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">
</head>
<body>
    <nav class="navbar navbar-expand-lg navbar-dark bg-dark">
        <div class="container">
            <a class="navbar-brand" href="#">ElectroPheuria</a>
            <div class="navbar-nav">
                <a class="nav-link" href="{{ route('dashboard') }}">Dashboard</a>
                <a class="nav-link" href="{{ route('clients.index') }}">Clients</a>
                <a class="nav-link active" href="{{ route('orders.index') }}">Orders</a>
                <a class="nav-link" href="{{ route('orders.history') }}">Sales History</a>
            </div>
        </div>
    </nav>

    <div class="container mt-4">
        <h1>Orders</h1>
        <table class="table table-striped">
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Client</th>
                    <th>Products</th>
                    <th>Total Price</th>
                    <th>Status</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                @foreach($orders as $order)
                <tr>
                    <td>{{ $order->id }}</td>
                    <td>{{ $order->client->name }}</td>
                    <td>
                        <ul>
                            @foreach($order->products as $product)
                            <li>{{ $product['name'] }} (Qty: {{ $product['quantity'] }})</li>
                            @endforeach
                        </ul>
                    </td>
                    <td>${{ number_format($order->total_price, 2) }}</td>
                    <td>{{ $order->status }}</td>
                    <td>
                        @if($order->status == 'pending')
                            <form method="POST" action="{{ route('orders.update', $order->id) }}" style="display: inline;">
                                @csrf
                                @method('PUT')
                                <input type="hidden" name="status" value="ongoing">
                                <button type="submit" class="btn btn-sm btn-success">Accept</button>
                            </form>
                        @elseif($order->status == 'ongoing')
                            <form method="POST" action="{{ route('orders.update', $order->id) }}" style="display: inline;">
                                @csrf
                                @method('PUT')
                                <input type="hidden" name="status" value="done">
                                <button type="submit" class="btn btn-sm btn-primary">Done</button>
                            </form>
                            <form method="POST" action="{{ route('orders.update', $order->id) }}" style="display: inline;">
                                @csrf
                                @method('PUT')
                                <input type="hidden" name="status" value="cancelled">
                                <button type="submit" class="btn btn-sm btn-danger">Cancel</button>
                            </form>
                            <form method="POST" action="{{ route('orders.update', $order->id) }}" style="display: inline;">
                                @csrf
                                @method('PUT')
                                <input type="hidden" name="status" value="shipped">
                                <button type="submit" class="btn btn-sm btn-info">Shipped</button>
                            </form>
                        @endif
                    </td>
                </tr>
                @endforeach
            </tbody>
        </table>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>