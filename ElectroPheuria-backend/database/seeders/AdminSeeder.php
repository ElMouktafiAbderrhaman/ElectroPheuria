<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class AdminSeeder extends Seeder
{
    public function run(): void
    {
        $admins = [
            [
                'name' => 'Admin',
                'email' => 'aelmouktafi65@gmail.com',
                'password' => Hash::make('AbdouM03'),
            ],
            [
                'name' => 'Saber',
                'email' => 'Saberyouness03@gmail.com',
                'password' => Hash::make('Maroc@123'),
            ],
            [
                'name' => 'Hamza',
                'email' => 'hamzamania644@gmail.com',
                'password' => Hash::make('Hamzamania110403'),
            ],
        ];

        foreach ($admins as $admin) {
            User::updateOrCreate(
                ['email' => $admin['email']],
                $admin
            );
        }
    }
}
