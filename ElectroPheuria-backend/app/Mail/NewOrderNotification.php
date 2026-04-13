<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class NewOrderNotification extends Mailable
{
    use Queueable, SerializesModels;

    public $order;
    public $clientData;
    public $products;

    public function __construct($order, $clientData, $products)
    {
        $this->order = $order;
        $this->clientData = $clientData;
        $this->products = $products;
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: '🛒 New Order #' . $this->order->id . ' - ElectroPheuria',
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.new-order',
        );
    }

    public function attachments(): array
    {
        return [];
    }
}
