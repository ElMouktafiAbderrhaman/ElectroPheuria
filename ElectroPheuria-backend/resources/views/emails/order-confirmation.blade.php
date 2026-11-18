@php
    $rtl = $dir === 'rtl';
    $opposite = $rtl ? 'left' : 'right';
    // Arabic needs its own font stack, no letter-spacing (it breaks letter joining) and no italics.
    $bodyFont = $rtl
        ? "'Tajawal','Segoe UI',Tahoma,'Geeza Pro','Arabic Typesetting',Arial,sans-serif"
        : "'Helvetica Neue',Helvetica,Arial,sans-serif";
    $headFont = $rtl ? $bodyFont : "'Playfair Display',Georgia,'Times New Roman',serif";
    $tracking = $rtl ? '0' : '3px';
    $lineHeight = $rtl ? '1.95' : '1.7';
    $gold = '#D4AF37';
    $goldLight = '#F1D78A';
    $text = '#E8E4DA';
    $muted = '#A29C8E';
@endphp
<!DOCTYPE html>
<html lang="{{ $locale }}" dir="{{ $dir }}" xmlns="http://www.w3.org/1999/xhtml">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="color-scheme" content="dark">
    <meta name="supported-color-schemes" content="dark">
    <meta name="x-apple-disable-message-reformatting">
    <title>{{ __('order_confirmation.subject') }}</title>
    @if ($rtl)
        <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700&display=swap" rel="stylesheet">
    @else
        <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600&display=swap" rel="stylesheet">
    @endif
    <style>
        body { margin: 0 !important; padding: 0 !important; width: 100% !important; background: #0A0A0A; }
        table, td { border-collapse: collapse; mso-table-lspace: 0; mso-table-rspace: 0; }
        img { border: 0; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic; }
        a { color: {{ $gold }}; }
        @media only screen and (max-width: 620px) {
            .container { width: 100% !important; }
            .px { padding-left: 22px !important; padding-right: 22px !important; }
            .headline { font-size: 23px !important; line-height: 1.35 !important; }
            .ref-value { font-size: 26px !important; }
            .btn a { display: block !important; }
        }
    </style>
</head>
<body dir="{{ $dir }}" style="margin:0;padding:0;background:#0A0A0A;">
    {{-- Inbox preview text --}}
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;font-size:1px;line-height:1px;color:#0A0A0A;">
        {{ __('order_confirmation.preheader', ['order' => $orderRef]) }}&#8204;&nbsp;&#8204;&nbsp;&#8204;&nbsp;&#8204;&nbsp;&#8204;&nbsp;&#8204;&nbsp;
    </div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0A0A0A;">
        <tr>
            <td align="center" style="padding:32px 12px;">
                <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0" dir="{{ $dir }}"
                       style="width:100%;max-width:600px;background:#121212;border:1px solid #2E2714;border-radius:14px;overflow:hidden;">

                    {{-- Gold top rule --}}
                    <tr>
                        <td height="4" style="height:4px;line-height:4px;font-size:0;background:{{ $gold }};background-image:linear-gradient(90deg,#8C6D1F,{{ $goldLight }},#8C6D1F);">&nbsp;</td>
                    </tr>

                    {{-- Header: logo --}}
                    <tr>
                        <td align="center" style="background:#000000;padding:34px 24px 26px;">
                            <a href="{{ $storeUrl }}" style="text-decoration:none;">
                                <img src="{{ $message->embed($logoPath) }}" width="104" alt="ElectroPheuria"
                                     style="display:block;width:104px;max-width:104px;height:auto;margin:0 auto;color:{{ $gold }};font-family:{{ $headFont }};font-size:22px;">
                            </a>
                        </td>
                    </tr>
                    <tr>
                        <td align="center" style="background:#000000;padding:0 24px 30px;">
                            <span style="display:inline-block;border:1px solid #5A4A1C;border-radius:999px;padding:7px 18px;font-family:{{ $bodyFont }};font-size:11px;font-weight:700;letter-spacing:{{ $tracking }};text-transform:uppercase;color:{{ $gold }};">
                                &#10003;&nbsp; {{ __('order_confirmation.eyebrow') }}
                            </span>
                        </td>
                    </tr>

                    {{-- Message --}}
                    <tr>
                        <td class="px" dir="{{ $dir }}" align="{{ $align }}" style="padding:40px 48px 8px;text-align:{{ $align }};font-family:{{ $bodyFont }};">
                            <p style="margin:0 0 10px;font-size:17px;font-weight:700;color:{{ $gold }};">
                                {{ __('order_confirmation.greeting', ['name' => $customerName]) }}
                            </p>
                            <h1 class="headline" style="margin:0 0 22px;font-family:{{ $headFont }};font-size:27px;line-height:1.3;font-weight:600;color:#FFFFFF;">
                                {{ __('order_confirmation.headline') }}
                            </h1>
                            <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="{{ $align }}" style="margin:0 0 24px;">
                                <tr><td width="56" height="2" style="width:56px;height:2px;line-height:2px;font-size:0;background:{{ $gold }};">&nbsp;</td></tr>
                            </table>
                            <div style="clear:both;"></div>
                            <p style="margin:0 0 16px;font-size:15px;line-height:{{ $lineHeight }};color:{{ $text }};">{{ __('order_confirmation.intro') }}</p>
                            <p style="margin:0 0 16px;font-size:15px;line-height:{{ $lineHeight }};color:{{ $text }};">{{ __('order_confirmation.contact') }}</p>
                            <p style="margin:0;font-size:15px;line-height:{{ $lineHeight }};color:{{ $text }};">{{ __('order_confirmation.promise') }}</p>
                        </td>
                    </tr>

                    {{-- Order reference --}}
                    <tr>
                        <td class="px" style="padding:30px 48px 6px;">
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                                   style="background:#17140C;background-image:linear-gradient(135deg,#1E1A0E,#110F09);border:1px solid {{ $gold }};border-radius:12px;">
                                <tr>
                                    <td align="center" style="padding:22px 20px;font-family:{{ $bodyFont }};text-align:center;">
                                        <p style="margin:0 0 6px;font-size:12px;font-weight:700;letter-spacing:{{ $tracking }};text-transform:uppercase;color:{{ $muted }};">
                                            {{ __('order_confirmation.order_reference') }}
                                        </p>
                                        <p class="ref-value" dir="ltr" style="margin:0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:30px;font-weight:700;letter-spacing:2px;color:{{ $goldLight }};">
                                            {{ $orderRef }}
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    {{-- Amount to pay: products + delivery = total --}}
                    <tr>
                        <td class="px" style="padding:18px 48px 6px;">
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" dir="{{ $dir }}"
                                   style="background:#141414;border:1px solid #2E2714;border-radius:12px;font-family:{{ $bodyFont }};">
                                <tr>
                                    <td style="padding:16px 20px 6px;font-size:14px;color:{{ $muted }};text-align:{{ $align }};">{{ __('order_confirmation.products_subtotal') }}</td>
                                    <td align="{{ $opposite }}" style="padding:16px 20px 6px;font-size:14px;color:{{ $text }};white-space:nowrap;"><span dir="ltr">{{ $amounts['subtotal'] }}</span> {{ __('order_confirmation.currency') }}</td>
                                </tr>
                                <tr>
                                    <td style="padding:6px 20px 14px;font-size:14px;color:{{ $muted }};text-align:{{ $align }};">{{ __('order_confirmation.delivery_fee') }}</td>
                                    <td align="{{ $opposite }}" style="padding:6px 20px 14px;font-size:14px;color:{{ $text }};white-space:nowrap;"><span dir="ltr">{{ $amounts['delivery'] }}</span> {{ __('order_confirmation.currency') }}</td>
                                </tr>
                                <tr>
                                    <td style="padding:14px 20px 16px;border-top:1px solid #5A4A1C;font-size:15px;font-weight:700;color:{{ $gold }};text-align:{{ $align }};">{{ __('order_confirmation.total_to_pay') }}</td>
                                    <td align="{{ $opposite }}" style="padding:14px 20px 16px;border-top:1px solid #5A4A1C;font-size:22px;font-weight:700;color:{{ $goldLight }};white-space:nowrap;"><span dir="ltr">{{ $amounts['total'] }}</span> {{ __('order_confirmation.currency') }}</td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    {{-- Button --}}
                    <tr>
                        <td class="px" align="center" style="padding:30px 48px 8px;">
                            <table role="presentation" class="btn" cellpadding="0" cellspacing="0" border="0" align="center">
                                <tr>
                                    <td align="center" bgcolor="{{ $gold }}" style="border-radius:999px;background:{{ $gold }};background-image:linear-gradient(135deg,{{ $goldLight }},{{ $gold }} 55%,#B08A26);">
                                        <a href="{{ $storeUrl }}" target="_blank"
                                           style="display:inline-block;padding:15px 40px;font-family:{{ $bodyFont }};font-size:15px;font-weight:700;letter-spacing:{{ $rtl ? '0' : '1px' }};color:#0A0A0A;text-decoration:none;border-radius:999px;">
                                            {{ __('order_confirmation.button') }}
                                        </a>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    {{-- Signature --}}
                    <tr>
                        <td class="px" dir="{{ $dir }}" align="{{ $align }}" style="padding:34px 48px 40px;text-align:{{ $align }};font-family:{{ $bodyFont }};">
                            <p style="margin:0 0 18px;font-size:15px;line-height:{{ $lineHeight }};color:{{ $text }};font-weight:700;">{{ __('order_confirmation.closing') }}</p>
                            <p style="margin:0;font-size:16px;font-weight:700;color:{{ $gold }};">{{ __('order_confirmation.team') }}</p>
                            <p style="margin:4px 0 0;font-size:13px;color:{{ $muted }};{{ $rtl ? '' : 'font-style:italic;letter-spacing:0.5px;' }}">{{ __('order_confirmation.tagline') }}</p>
                        </td>
                    </tr>

                    {{-- Footer --}}
                    <tr>
                        <td class="px" align="center" style="background:#0C0C0C;border-top:1px solid #2E2714;padding:24px 48px 28px;text-align:center;font-family:{{ $bodyFont }};">
                            <p style="margin:0 0 8px;font-size:13px;color:{{ $muted }};">
                                {{ __('order_confirmation.website') }}:
                                <a href="{{ $storeUrl }}" dir="ltr" style="color:{{ $gold }};text-decoration:none;font-weight:700;">electropheuria.com</a>
                            </p>
                            <p style="margin:0 0 6px;font-size:11px;line-height:1.6;color:#6F6A5F;">{{ __('order_confirmation.footer') }}</p>
                            <p style="margin:0;font-size:11px;color:#6F6A5F;" dir="ltr">&copy; {{ date('Y') }} ElectroPheuria</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
