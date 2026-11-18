<?php

return [

    'paths' => ['api/*'],

    'allowed_methods' => ['*'],

    'allowed_origins' => [
        'http://localhost:5173',           // Local development
        'http://localhost:3000',           // Alternative dev port
        'http://127.0.0.1:5173',           // Local dev (IP)
        env('FRONTEND_URL', 'https://electropheuria.com'),  // Custom domain
        'https://electropheuria.com',      // Production domain
    ],

    'allowed_origins_patterns' => [
        '#https?://[a-z0-9-]+\.electropheuria\.com#i',  // Subdomains
    ],

    'allowed_headers' => ['*'],

    'exposed_headers' => ['*'],

    'max_age' => 3600,

    'supports_credentials' => true,

];
