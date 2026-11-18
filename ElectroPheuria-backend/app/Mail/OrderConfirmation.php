<?php

namespace App\Mail;

use App\Models\Order;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Validator;

/**
 * Customer-facing "thank you for your order" email, in the language the
 * customer was browsing in (en / fr / ar). Sent by SendOrderConfirmationEmail.
 */
class OrderConfirmation extends Mailable
{
    use Queueable, SerializesModels;

    public const LOCALES = ['en', 'fr', 'ar'];
    public const DEFAULT_LOCALE = 'fr';
    public const STORE_URL = 'https://electropheuria.com';

    public string $customerName;

    public function __construct(public Order $order)
    {
        $this->locale(self::normalizeLocale($order->locale));
        $this->customerName = trim((string) ($order->client_data['name'] ?? $order->client?->name ?? ''));
    }

    /** "fr", "FR", "fr-FR" → "fr"; anything unsupported or missing → French. */
    public static function normalizeLocale(mixed $locale): string
    {
        $code = strtolower(substr(trim((string) $locale), 0, 2));

        return in_array($code, self::LOCALES, true) ? $code : self::DEFAULT_LOCALE;
    }

    /** The trimmed address if it is a syntactically valid email, otherwise null. */
    public static function deliverableEmail(mixed $email): ?string
    {
        if (!is_string($email)) {
            return null;
        }
        $email = trim($email);
        if ($email === '' || strlen($email) > 254) {
            return null;
        }

        return Validator::make(['email' => $email], ['email' => 'email:rfc,filter'])->passes() ? $email : null;
    }

    /** 318 → "318", 149.5 → "149.50" (same format as the website). */
    private static function money(float $value): string
    {
        $value = round($value, 2);

        return floor($value) == $value ? number_format($value, 0, '.', '') : number_format($value, 2, '.', '');
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: __('order_confirmation.subject'),
        );
    }

    public function content(): Content
    {
        $isRtl = $this->locale === 'ar';

        return new Content(
            view: 'emails.order-confirmation',
            text: 'emails.order-confirmation-text',
            with: [
                'locale' => $this->locale,
                'dir' => $isRtl ? 'rtl' : 'ltr',
                'align' => $isRtl ? 'right' : 'left',
                'orderRef' => '#' . $this->order->id,
                'storeUrl' => self::STORE_URL,
                'logoPath' => resource_path('images/email-logo.png'),
                'amounts' => [
                    'subtotal' => self::money($this->order->productsSubtotal()),
                    'delivery' => self::money((float) $this->order->delivery_fee),
                    'total' => self::money((float) $this->order->total_price),
                ],
            ],
        );
    }

    public function attachments(): array
    {
        return [];
    }
}
