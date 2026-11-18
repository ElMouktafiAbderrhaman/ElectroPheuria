<?php

return [
    /*
     * Fixed delivery fee charged on every order, anywhere in Morocco (MAD).
     * Added by the server to the products subtotal; the customer cannot remove it.
     * Must match DELIVERY_FEE in the frontend (src/utils/dealPricing.js).
     */
    'delivery_fee' => (float) env('DELIVERY_FEE', 20),
];
