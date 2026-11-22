<?php

namespace App\Exceptions;

use RuntimeException;

/** An order line cannot be sold as asked (unavailable item, missing cable choice…). */
class OrderRejected extends RuntimeException
{
}
