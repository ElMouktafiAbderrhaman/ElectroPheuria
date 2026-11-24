<?php

namespace App\Support;

/**
 * Line pricing for deal offer types. Mirrored by src/utils/dealPricing.js (lineTotal);
 * the backend result is authoritative for the saved order total.
 */
class OfferPricing
{
    public const STANDARD = 'standard';
    public const BOGO_HALF = 'bogo_half'; // buy 1, get the 2nd at 50% off
    public const BOGO_FIXED = 'bogo_fixed'; // buy 1, get the 2nd for a fixed price (second_item_price)

    public const TYPES = [self::STANDARD, self::BOGO_HALF, self::BOGO_FIXED];

    /**
     * @return array{line_subtotal: float, offer_discount: float, line_total: float}
     */
    public static function line(float $unitPrice, int $quantity, ?string $offerType, ?float $secondItemPrice = null): array
    {
        $subtotal = round($unitPrice * $quantity, 2);
        $total = $subtotal;

        if ($offerType === self::BOGO_HALF && $quantity >= 2) {
            // Only the 2nd unit is half price (once per item, whatever the quantity); every other
            // unit is full price. The line is rounded down to a price ending in 9 (199 × 2 = 298.50 → 289).
            $total = self::charmPrice($subtotal - $unitPrice * 0.5);
        } elseif ($offerType === self::BOGO_FIXED && $quantity >= 2 && $secondItemPrice !== null && $secondItemPrice < $unitPrice) {
            // Only the 2nd unit costs the price the admin entered (100 + 50 = 150; 6 units = 550),
            // once per item whatever the quantity; no rounding.
            $total = $subtotal - ($unitPrice - $secondItemPrice);
        }

        return [
            'line_subtotal' => $subtotal,
            'offer_discount' => round($subtotal - $total, 2),
            'line_total' => round($total, 2),
        ];
    }

    /** Largest whole amount ending in 9 that is not above $amount (447.50 → 439, 449 → 449). */
    public static function charmPrice(float $amount): float
    {
        $whole = (int) floor($amount + 1e-9);
        if ($whole < 9) {
            return (float) max($whole, 0);
        }

        return (float) (intdiv($whole - 9, 10) * 10 + 9);
    }
}
