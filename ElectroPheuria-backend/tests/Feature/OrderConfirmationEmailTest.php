<?php

namespace Tests\Feature;

use App\Jobs\SendOrderConfirmationEmail;
use App\Mail\NewOrderNotification;
use App\Mail\OrderConfirmation;
use App\Models\Deal;
use App\Models\Order;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Queue;
use Laravel\Sanctum\Sanctum;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class OrderConfirmationEmailTest extends TestCase
{
    use RefreshDatabase;

    private function deal(): Deal
    {
        return Deal::create([
            'name' => 'Deal', 'description' => '', 'old_price' => 200, 'price' => 200, 'discount' => 0,
            'offer_type' => 'standard', 'stock' => 50, 'categories' => [], 'images' => [], 'reviews' => '',
            'specs' => [], 'gallery' => [], 'active' => true,
        ]);
    }

    private function placeOrder(array $client = [], array $extra = [])
    {
        return $this->postJson('/api/orders', array_merge([
            'client' => array_merge([
                'name' => 'Amina Test', 'email' => 'amina@example.com',
                'phone' => '0611111111', 'address' => 'Rabat', 'city' => 'Rabat', 'delivery_address' => '12 Rue Test, Apt 3',
            ], $client),
            'products' => [['id' => $this->deal()->id, 'quantity' => 1, 'isDeal' => true]],
            'total_price' => 200,
        ], $extra));
    }

    public static function locales(): array
    {
        return [
            'english' => ['en', 'Thank You for Your Order – ElectroPheuria ⚡', 'Hello Amina Test,', 'Visit Our Store', 'Order Reference', 'ltr'],
            'french' => ['fr', 'Merci pour votre commande – ElectroPheuria ⚡', 'Bonjour Amina Test,', 'Visitez notre boutique', 'Référence de commande', 'ltr'],
            'arabic' => ['ar', 'شكراً لطلبكم من ElectroPheuria ⚡', 'مرحباً Amina Test،', 'تسوقوا من متجرنا', 'رقم الطلب', 'rtl'],
        ];
    }

    #[DataProvider('locales')]
    public function test_confirmation_is_sent_in_the_customers_language($locale, $subject, $greeting, $button, $refLabel, $dir): void
    {
        Mail::fake();

        $id = $this->placeOrder([], ['locale' => $locale])->assertCreated()->json('id');
        $order = Order::find($id);
        $this->assertSame($locale, $order->locale);
        $this->assertNotNull($order->confirmation_sent_at);

        Mail::assertSent(OrderConfirmation::class, 1);
        Mail::assertSent(OrderConfirmation::class, function (OrderConfirmation $mail) use ($id, $locale, $subject, $greeting, $button, $refLabel, $dir) {
            $this->assertTrue($mail->hasTo('amina@example.com'));
            $this->assertSame($locale, $mail->locale);
            $mail->assertHasSubject($subject);
            $mail->assertSeeInHtml($greeting, false);
            $mail->assertSeeInHtml('#' . $id);
            $mail->assertSeeInHtml($button, false);
            $mail->assertSeeInHtml('dir="' . $dir . '"', false);
            $mail->assertSeeInHtml('https://electropheuria.com', false);
            $mail->assertSeeInText($greeting, false);
            $mail->assertSeeInText($refLabel . ': #' . $id, false);
            return true;
        });

        // The admin notification is unchanged.
        Mail::assertSent(NewOrderNotification::class);
    }

    public function test_arabic_email_is_rtl_with_arabic_typography(): void
    {
        Mail::fake();
        $this->placeOrder([], ['locale' => 'ar'])->assertCreated();

        Mail::assertSent(OrderConfirmation::class, function (OrderConfirmation $mail) {
            $html = $mail->render();
            $this->assertStringContainsString('<html lang="ar" dir="rtl"', $html);
            $this->assertStringContainsString('text-align:right', $html);
            $this->assertStringContainsString('Tajawal', $html);
            $this->assertStringNotContainsString('text-align:left', $html);
            return true;
        });
    }

    public function test_missing_or_invalid_locale_defaults_to_french(): void
    {
        Mail::fake();

        foreach ([null, 'de', 'xx-YY', ''] as $i => $locale) {
            $extra = $locale === null ? [] : ['locale' => $locale];
            $id = $this->placeOrder(['phone' => '060000000' . $i], $extra)->assertCreated()->json('id');
            $this->assertSame('fr', Order::find($id)->locale);
        }
        $this->placeOrder(['phone' => '0699999999'], ['locale' => 'en-US'])->assertCreated();

        Mail::assertSent(OrderConfirmation::class, 5);
        $this->assertSame(['fr', 'fr', 'fr', 'fr', 'en'], Mail::sent(OrderConfirmation::class)->pluck('locale')->all());
    }

    public function test_orders_without_a_valid_email_still_succeed_and_send_nothing(): void
    {
        Mail::fake();

        $this->placeOrder(['email' => null, 'phone' => '0620000001'])->assertCreated();
        $this->placeOrder(['email' => '', 'phone' => '0620000002'])->assertCreated();
        $id = $this->placeOrder(['email' => 'not-an-email', 'phone' => '0620000003'])->assertCreated()->json('id');

        $this->assertSame(3, Order::count());
        $this->assertNull(Order::find($id)->client_data['email']);
        Mail::assertNotSent(OrderConfirmation::class);
        Mail::assertSent(NewOrderNotification::class, 3);
    }

    public function test_job_is_queued_after_commit_and_only_for_created_orders(): void
    {
        Queue::fake();
        Mail::fake();

        $id = $this->placeOrder()->assertCreated()->json('id');
        Queue::assertPushed(SendOrderConfirmationEmail::class, function ($job) use ($id) {
            return $job->orderId === $id && $job->afterCommit === true;
        });

        // A rejected checkout (unavailable item) queues nothing.
        $this->postJson('/api/orders', [
            'client' => ['name' => 'X', 'email' => 'x@example.com', 'phone' => '0630000000', 'address' => 'Fès', 'city' => 'Fès', 'delivery_address' => '12 Rue Test, Apt 3'],
            'products' => [['id' => 999999, 'quantity' => 1, 'isDeal' => true]],
        ])->assertStatus(422);
        Queue::assertPushed(SendOrderConfirmationEmail::class, 1);
    }

    public function test_no_duplicate_email_on_status_updates_or_repeated_jobs(): void
    {
        Mail::fake();
        $id = $this->placeOrder()->assertCreated()->json('id');
        Mail::assertSent(OrderConfirmation::class, 1);

        Sanctum::actingAs(User::factory()->create());
        foreach (['ongoing', 'shipped', 'done'] as $status) {
            $this->putJson("/api/orders/{$id}/status", ['status' => $status])->assertOk();
        }

        // Even a duplicated/retried job must not email the customer again.
        (new SendOrderConfirmationEmail($id))->handle();
        SendOrderConfirmationEmail::dispatch($id);

        Mail::assertSent(OrderConfirmation::class, 1);
    }

    public function test_delivery_failure_keeps_the_order_and_is_logged(): void
    {
        Log::spy();
        Mail::shouldReceive('to')->andThrow(new \RuntimeException('SMTP down'));

        $id = $this->placeOrder()->assertCreated()->json('id');

        $order = Order::find($id);
        $this->assertNotNull($order);
        $this->assertSame('pending', $order->status);
        // Claim released, so a later retry can still send it.
        $this->assertNull($order->confirmation_sent_at);

        Log::shouldHaveReceived('error')->withArgs(
            fn ($msg, $ctx = []) => str_contains($msg, 'Order confirmation email FAILED') && ($ctx['error'] ?? null) === 'SMTP down'
        )->once();
    }

    public function test_email_is_sent_by_the_database_queue_worker_not_the_request(): void
    {
        config(['queue.default' => 'database']);
        Mail::fake();

        $id = $this->placeOrder()->assertCreated()->json('id');
        $this->assertDatabaseCount('jobs', 1);
        Mail::assertNotSent(OrderConfirmation::class); // not sent during the request

        $this->artisan('queue:work', ['--once' => true, '--queue' => 'default'])->assertSuccessful();

        $this->assertDatabaseCount('jobs', 0);
        Mail::assertSent(OrderConfirmation::class, fn ($mail) => $mail->order->id === $id);
        $this->assertNotNull(Order::find($id)->confirmation_sent_at);
    }
}
