<?php

namespace Database\Seeders;

use App\Models\Client;
use App\Models\Order;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class ClientOrderSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $clients = [
            [
                'name' => 'John Doe',
                'email' => 'john@example.com',
                'phone' => '123-456-7890',
                'address' => '123 Main St, City, State',
            ],
            [
                'name' => 'Jane Smith',
                'email' => 'jane@example.com',
                'phone' => '098-765-4321',
                'address' => '456 Oak Ave, City, State',
            ],
        ];

        foreach ($clients as $clientData) {
            Client::create($clientData);
        }

        $orders = [
            [
                'client_id' => 1,
                'products' => [
                    ['name' => 'Product A', 'quantity' => 2],
                    ['name' => 'Product B', 'quantity' => 1],
                ],
                'total_price' => 150.00,
                'status' => 'pending',
            ],
            [
                'client_id' => 2,
                'products' => [
                    ['name' => 'Product C', 'quantity' => 1],
                ],
                'total_price' => 75.00,
                'status' => 'ongoing',
            ],
        ];

        foreach ($orders as $orderData) {
            Order::create($orderData);
        }
    }
}
