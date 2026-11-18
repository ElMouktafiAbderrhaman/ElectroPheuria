<?php

namespace App\Http\Controllers;

use App\Models\Client;
use Illuminate\Http\Request;

class ClientController extends Controller
{
    public function index()
    {
        $clients = Client::with('orders')->get();
        return response()->json($clients);
    }

    public function show($id)
    {
        $client = Client::with('orders')->findOrFail($id);
        return response()->json($client);
    }

    public function orders($id)
    {
        $client = Client::findOrFail($id);
        return response()->json($client->orders()->get());
    }

    public function webIndex()
    {
        $clients = Client::with('orders')->get();
        return view('clients.index', compact('clients'));
    }

    public function webShow($id)
    {
        $client = Client::with('orders')->findOrFail($id);
        return view('clients.show', compact('client'));
    }
}
