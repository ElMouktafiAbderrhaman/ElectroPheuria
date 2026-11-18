<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#0f0f0f;font-family:Arial,Helvetica,sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0f0f;padding:30px 0;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background:#1a1a1a;border-radius:16px;overflow:hidden;border:1px solid rgba(212,175,55,0.3);">
                    <!-- Header -->
                    <tr>
                        <td style="background:linear-gradient(135deg,#1a1a2e,#16213e);padding:30px;text-align:center;border-bottom:3px solid #D4AF37;">
                            <h1 style="margin:0;color:#D4AF37;font-size:28px;letter-spacing:2px;">ELECTROPHEURIA</h1>
                            <p style="margin:8px 0 0;color:#aaa;font-size:14px;">New Order Received</p>
                        </td>
                    </tr>

                    <!-- Order Info -->
                    <tr>
                        <td style="padding:30px;">
                            <table width="100%" cellpadding="0" cellspacing="0" style="background:#222;border-radius:12px;padding:20px;border:1px solid #333;">
                                <tr>
                                    <td style="padding:20px;">
                                        <h2 style="margin:0 0 5px;color:#D4AF37;font-size:20px;">Order #{{ $order->id }}</h2>
                                        <p style="margin:0;color:#888;font-size:13px;">{{ $order->created_at->format('M d, Y \a\t H:i') }}</p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Customer Info -->
                    <tr>
                        <td style="padding:0 30px 20px;">
                            <h3 style="color:#D4AF37;margin:0 0 12px;font-size:16px;">👤 Customer Information</h3>
                            <table width="100%" cellpadding="8" cellspacing="0" style="background:#222;border-radius:10px;border:1px solid #333;">
                                <tr>
                                    <td style="color:#aaa;font-size:13px;width:100px;padding:10px 15px;">Name</td>
                                    <td style="color:#f5f5f5;font-size:14px;font-weight:bold;padding:10px 15px;">{{ $clientData['name'] ?? 'N/A' }}</td>
                                </tr>
                                <tr>
                                    <td style="color:#aaa;font-size:13px;padding:10px 15px;border-top:1px solid #333;">Phone</td>
                                    <td style="color:#f5f5f5;font-size:14px;font-weight:bold;padding:10px 15px;border-top:1px solid #333;">{{ $clientData['phone'] ?? 'N/A' }}</td>
                                </tr>
                                <tr>
                                    <td style="color:#aaa;font-size:13px;padding:10px 15px;border-top:1px solid #333;">City</td>
                                    <td style="color:#f5f5f5;font-size:14px;font-weight:bold;padding:10px 15px;border-top:1px solid #333;">{{ $clientData['city'] ?? $clientData['address'] ?? 'N/A' }}</td>
                                </tr>
                                @if(!empty($clientData['delivery_address']))
                                <tr>
                                    <td style="color:#aaa;font-size:13px;padding:10px 15px;border-top:1px solid #333;vertical-align:top;">Address</td>
                                    <td style="color:#f5f5f5;font-size:14px;font-weight:bold;padding:10px 15px;border-top:1px solid #333;white-space:pre-line;">{{ $clientData['delivery_address'] }}</td>
                                </tr>
                                @endif
                                @if(!empty($clientData['email']))
                                <tr>
                                    <td style="color:#aaa;font-size:13px;padding:10px 15px;border-top:1px solid #333;">Email</td>
                                    <td style="color:#f5f5f5;font-size:14px;font-weight:bold;padding:10px 15px;border-top:1px solid #333;">{{ $clientData['email'] }}</td>
                                </tr>
                                @endif
                            </table>
                        </td>
                    </tr>

                    <!-- Products -->
                    <tr>
                        <td style="padding:0 30px 20px;">
                            <h3 style="color:#D4AF37;margin:0 0 12px;font-size:16px;">📦 Ordered Items</h3>
                            <table width="100%" cellpadding="0" cellspacing="0" style="background:#222;border-radius:10px;border:1px solid #333;overflow:hidden;">
                                <tr style="background:#2a2a2a;">
                                    <td style="color:#D4AF37;font-size:12px;font-weight:bold;padding:10px 15px;text-transform:uppercase;letter-spacing:1px;">Item</td>
                                    <td style="color:#D4AF37;font-size:12px;font-weight:bold;padding:10px 15px;text-align:center;text-transform:uppercase;letter-spacing:1px;">Qty</td>
                                    <td style="color:#D4AF37;font-size:12px;font-weight:bold;padding:10px 15px;text-align:right;text-transform:uppercase;letter-spacing:1px;">Price</td>
                                </tr>
                                @foreach($products as $item)
                                <tr>
                                    <td style="color:#f5f5f5;font-size:14px;padding:12px 15px;border-top:1px solid #333;">
                                        {{ $item['name'] ?? 'Unknown' }}
                                        @if (in_array($item['offer_type'] ?? null, ['bogo_half', 'bogo_fixed'], true))
                                            <br><span style="color:#D4AF37;font-size:12px;">
                                                @if (($item['offer_type'] ?? null) === 'bogo_fixed')
                                                    Buy 1, Get the 2nd for {{ number_format($item['second_item_price'] ?? 0, 2) }} MAD
                                                @else
                                                    Buy 1, Get the 2nd at 50% Off
                                                @endif
                                                @if (($item['offer_discount'] ?? 0) > 0)
                                                    (−{{ number_format($item['offer_discount'], 2) }} MAD)
                                                @endif
                                            </span>
                                        @endif
                                        @if (!empty($item['variant_label']))
                                            <br><span style="color:#D4AF37;font-size:12px;">Cable: {{ $item['variant_label'] }}</span>
                                        @endif
                                        @if (!empty($item['bundle_items']))
                                            <br><span style="color:#D4AF37;font-size:12px;">Pack:
                                                {{ collect($item['bundle_items'])->map(fn ($bi) => ($bi['name'] ?? '') . (!empty($bi['variant_label']) ? ' (Cable: ' . $bi['variant_label'] . ')' : '') . ' ×' . (($bi['quantity'] ?? 1) * ($item['quantity'] ?? 1)))->implode(' + ') }}
                                            </span>
                                        @endif
                                    </td>
                                    <td style="color:#ccc;font-size:14px;padding:12px 15px;text-align:center;border-top:1px solid #333;">x{{ $item['quantity'] ?? 1 }}</td>
                                    <td style="color:#D4AF37;font-size:14px;font-weight:bold;padding:12px 15px;text-align:right;border-top:1px solid #333;">{{ number_format($item['line_total'] ?? (($item['price'] ?? 0) * ($item['quantity'] ?? 1)), 2) }} MAD</td>
                                </tr>
                                @endforeach
                            </table>
                        </td>
                    </tr>

                    <!-- Total -->
                    <tr>
                        <td style="padding:0 30px 30px;">
                            <table width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#2a1f0a,#1a1505);border-radius:12px;border:2px solid #D4AF37;">
                                <tr>
                                    <td style="padding:20px 25px;">
                                        <table width="100%" cellpadding="0" cellspacing="0">
                                            <tr>
                                                <td style="color:#ccc;font-size:14px;padding-bottom:6px;">Products subtotal</td>
                                                <td style="color:#f5f5f5;font-size:14px;text-align:right;padding-bottom:6px;">MAD {{ number_format($order->productsSubtotal(), 2) }}</td>
                                            </tr>
                                            <tr>
                                                <td style="color:#ccc;font-size:14px;padding-bottom:10px;">Delivery fee</td>
                                                <td style="color:#f5f5f5;font-size:14px;text-align:right;padding-bottom:10px;">MAD {{ number_format((float) $order->delivery_fee, 2) }}</td>
                                            </tr>
                                            <tr>
                                                <td style="color:#D4AF37;font-size:18px;font-weight:bold;border-top:1px solid #5A4A1C;padding-top:10px;">TOTAL TO COLLECT</td>
                                                <td style="color:#FFD700;font-size:24px;font-weight:bold;text-align:right;border-top:1px solid #5A4A1C;padding-top:10px;">MAD {{ number_format($order->total_price, 2) }}</td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="background:#111;padding:20px 30px;text-align:center;border-top:1px solid #333;">
                            <p style="margin:0;color:#666;font-size:12px;">This is an automated notification from ElectroPheuria Admin System.</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
