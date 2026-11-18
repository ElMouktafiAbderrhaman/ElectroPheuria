<?php

namespace App\Jobs;

use App\Mail\OrderConfirmation;
use App\Models\Order;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Throwable;

/**
 * Sends the customer's order confirmation email in the background.
 *
 * - Dispatched only after the order's DB transaction has committed.
 * - Idempotent: orders.confirmation_sent_at is claimed atomically before
 *   sending, so a retried or duplicated job never emails the customer twice.
 * - A delivery failure never touches the order itself; it is retried and
 *   finally logged (and kept in failed_jobs).
 */
class SendOrderConfirmationEmail implements ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    /** Seconds to wait before retry 1 and retry 2. */
    public array $backoff = [60, 300];

    public int $timeout = 60;

    public function __construct(public int $orderId)
    {
        $this->afterCommit();
    }

    public function handle(): void
    {
        $order = Order::with('client')->find($this->orderId);
        if (!$order) {
            Log::warning('Order confirmation email skipped: order not found', ['order_id' => $this->orderId]);
            return;
        }

        $email = OrderConfirmation::deliverableEmail($order->client_data['email'] ?? null);
        if (!$email) {
            Log::info('Order confirmation email skipped: no valid customer email', ['order_id' => $order->id]);
            return;
        }

        // Atomically claim the send (without touching updated_at). If another
        // attempt already sent or is sending it, stop here.
        $claimed = Order::whereKey($order->id)
            ->whereNull('confirmation_sent_at')
            ->toBase()
            ->update(['confirmation_sent_at' => now()]);
        if ($claimed === 0) {
            Log::info('Order confirmation email skipped: already sent', ['order_id' => $order->id]);
            return;
        }

        try {
            Mail::to($email, $order->client_data['name'] ?? null)->send(new OrderConfirmation($order));
        } catch (Throwable $e) {
            // Release the claim so the retry can send it.
            Order::whereKey($order->id)->toBase()->update(['confirmation_sent_at' => null]);
            Log::warning('Order confirmation email attempt failed', [
                'order_id' => $order->id,
                'attempt' => $this->attempts(),
                'error' => $e->getMessage(),
            ]);
            throw $e;
        }

        Log::info('Order confirmation email sent', [
            'order_id' => $order->id,
            'locale' => OrderConfirmation::normalizeLocale($order->locale),
        ]);
    }

    /** Called once all retries are exhausted. The order is left untouched. */
    public function failed(?Throwable $e): void
    {
        Log::error('Order confirmation email FAILED after all retries', [
            'order_id' => $this->orderId,
            'error' => $e?->getMessage(),
        ]);
    }
}
