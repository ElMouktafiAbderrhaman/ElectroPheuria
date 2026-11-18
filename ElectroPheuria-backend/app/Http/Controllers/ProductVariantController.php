<?php

namespace App\Http\Controllers;

use App\Models\ProductVariant;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Cable variant images are real files on Laravel's "public" disk
 * (storage/app/public/product-variants), never base64 in the database.
 * They are served through the API so no nginx /storage rule is needed.
 */
class ProductVariantController extends Controller
{
    public const MAX_KB = 5120;

    // POST /api/product-variants/images (admin) — multipart field "image".
    public function upload(Request $request)
    {
        $request->validate([
            'image' => 'required|file|image|mimes:jpg,jpeg,png,webp|max:' . self::MAX_KB,
        ], [
            'image.required' => 'Please choose an image.',
            'image.image' => 'The file must be an image.',
            'image.mimes' => 'The image must be a JPG, PNG or WEBP.',
            'image.max' => 'The image must be 5 MB or smaller.',
        ]);

        $file = $request->file('image');
        $ext = strtolower($file->extension() ?: 'jpg');
        if ($ext === 'jpeg') {
            $ext = 'jpg';
        }
        $name = Str::lower(Str::random(32)) . '.' . $ext;
        $path = $file->storeAs(ProductVariant::IMAGE_DIR, $name, 'public');

        if (!$path) {
            return response()->json(['message' => 'The image could not be saved.'], 500);
        }

        return response()->json([
            'path' => $path,
            'url' => ProductVariant::imageUrlFor($path),
        ], 201);
    }

    // GET /api/product-variants/images/{file} — public, cacheable (file names are random and never reused).
    public function image(string $file)
    {
        if (!preg_match('/^[a-z0-9]{32}\.(jpg|png|webp)$/', $file)) {
            abort(404);
        }
        $path = ProductVariant::IMAGE_DIR . '/' . $file;
        $disk = Storage::disk('public');
        if (!$disk->exists($path)) {
            abort(404);
        }

        return $disk->response($path, $file, [
            'Cache-Control' => 'public, max-age=31536000, immutable',
        ]);
    }

    /** True when $path is a variant image produced by upload() that still exists. */
    public static function isStoredImage(?string $path): bool
    {
        return is_string($path)
            && preg_match('#^' . ProductVariant::IMAGE_DIR . '/[a-z0-9]{32}\.(jpg|png|webp)$#', $path) === 1
            && Storage::disk('public')->exists($path);
    }
}
