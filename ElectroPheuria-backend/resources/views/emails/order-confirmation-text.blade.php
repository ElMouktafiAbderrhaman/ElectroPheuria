{!! __('order_confirmation.greeting', ['name' => $customerName]) !!}

{!! __('order_confirmation.headline') !!}

{!! __('order_confirmation.intro') !!}

{!! __('order_confirmation.contact') !!}

{!! __('order_confirmation.promise') !!}

{!! __('order_confirmation.closing') !!}

{!! __('order_confirmation.team') !!}
{!! __('order_confirmation.tagline') !!}

{!! __('order_confirmation.order_reference') !!}: {{ $orderRef }}
{!! __('order_confirmation.products_subtotal') !!}: {{ $amounts['subtotal'] }} {!! __('order_confirmation.currency') !!}
{!! __('order_confirmation.delivery_fee') !!}: {{ $amounts['delivery'] }} {!! __('order_confirmation.currency') !!}
{!! __('order_confirmation.total_to_pay') !!}: {{ $amounts['total'] }} {!! __('order_confirmation.currency') !!}

{!! __('order_confirmation.button') !!}: {{ $storeUrl }}
{!! __('order_confirmation.website') !!}: {{ $storeUrl }}

--
{!! __('order_confirmation.footer') !!}
