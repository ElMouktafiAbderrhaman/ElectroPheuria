<?php

namespace Database\Seeders;

use App\Models\Deal;
use App\Models\Expense;
use App\Models\FinanceSetting;
use App\Models\Product;
use Illuminate\Database\Seeder;

/**
 * Starting figures for the finance tracker (published 2 November 2026).
 * Safe to run more than once: it only fills empty tables and unknown costs, never overwrites.
 *
 *   php artisan db:seed --class=FinanceSeeder --force
 */
class FinanceSeeder extends Seeder
{
    public function run(): void
    {
        if (FinanceSetting::count() === 0) {
            FinanceSetting::create([
                'opening_balance' => 4151.88,
                'opening_date' => '2026-11-02',
                'reconciled_on' => '2026-11-02',
                'delivery_per_order' => 20,
            ]);
        }

        if (Expense::count() === 0) {
            $rows = [
                ['goods', 'Stock purchased', 0, null, 'no stock bought yet — buying starts with the ad tests', true],
                ['fixed', 'Website — domain + hosting', 120, 'monthly', '120 DH a month', false],
                ['fixed', 'Claude subscription', 187, 'monthly', '$20 a month · converted at about 9.35 DH to the dollar', false],
                ['fixed', 'Merlin AI subscription', 0, null, 'cancelled — not being counted', true],
                ['fixed', 'Kling AI credits', 0, null, 'cancelled — not being counted', true],
                ['variable', 'Meta ads', 0, null, 'account checked — no campaign running so far', true],
                ['variable', 'TikTok ads', 0, null, 'no campaign launched', true],
                ['variable', 'Delivery / courier', 0, null, '20 DH per order shipped — nothing shipped yet', true],
                ['variable', 'Packaging', null, null, 'cost not known yet', false],
            ];
            foreach ($rows as $i => [$category, $label, $amount, $period, $note, $verified]) {
                Expense::create(compact('category', 'label', 'amount', 'period', 'note', 'verified') + ['position' => $i + 1]);
            }
        }

        // Supplier costs from the published sheet, matched by name; only where still unknown.
        $costs = [
            'AirPods Pro 2' => 50,
            'AirPods 4' => 50,
            'oraimo SpaceBuds Air' => 120,
            'SYLO LS-527' => 85,
            'oraimo SpaceBuds Neo+' => 150,
            'SYLO ENC LS-509' => 115,
        ];
        foreach ($costs as $name => $cost) {
            foreach ([Deal::class, Product::class] as $model) {
                $model::whereRaw('LOWER(name) = ?', [mb_strtolower($name)])
                    ->whereNull('cost_price')
                    ->update(['cost_price' => $cost]);
            }
        }
    }
}
