<?php

namespace Tests\Feature;

use App\Models\Banner;
use App\Models\Deal;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class BannersTest extends TestCase
{
    use RefreshDatabase;

    // 1×1 transparent PNG
    private const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

    private function actingAsAdmin(): void
    {
        Sanctum::actingAs(User::factory()->create());
    }

    private function payload(array $overrides = []): array
    {
        return array_merge([
            'title' => 'Summer promo',
            'promotion_type' => 'custom',
            'layout' => 'split',
            'headline' => ['fr' => 'La 2ème presque offerte', 'en' => 'The 2nd almost free', 'ar' => 'الثانية بثمن صغير'],
            'button_text' => ['fr' => 'Commandez', 'en' => '', 'ar' => ''],
            'active' => true,
        ], $overrides);
    }

    private function deal(array $overrides = []): Deal
    {
        return Deal::create(array_merge([
            'name' => 'AirPods Pro 2',
            'old_price' => 400,
            'price' => 300,
            'discount' => 25,
            'offer_type' => 'standard',
            'stock' => 5,
            'active' => true,
            'images' => [self::PNG],
        ], $overrides));
    }

    public function test_admin_endpoints_require_authentication(): void
    {
        $this->postJson('/api/banners', $this->payload())->assertUnauthorized();
        $this->getJson('/api/admin/banners')->assertUnauthorized();
        $this->putJson('/api/banners/reorder', ['ids' => [1]])->assertUnauthorized();
        $this->putJson('/api/banners/1', $this->payload())->assertUnauthorized();
        $this->patchJson('/api/banners/1/active', ['active' => true])->assertUnauthorized();
        $this->deleteJson('/api/banners/1')->assertUnauthorized();
        $this->assertSame(0, Banner::count());
    }

    public function test_custom_banner_crud_and_public_listing(): void
    {
        $this->actingAsAdmin();

        $id = $this->postJson('/api/banners', $this->payload([
            'image' => self::PNG,
            'promotional_price' => 199,
            'original_price' => 299,
            'button_url' => '/products?category=pods',
        ]))->assertCreated()->json('id');

        $public = $this->getJson('/api/banners')->assertOk()->json();
        $this->assertCount(1, $public);
        $this->assertSame('La 2ème presque offerte', $public[0]['headline']['fr']);
        $this->assertSame(33, $public[0]['discount_percentage']);
        $this->assertSame('/products?category=pods', $public[0]['button_url']);
        $this->assertArrayNotHasKey('image', $public[0]);
        $this->assertArrayNotHasKey('status', $public[0]);
        $this->assertStringContainsString("/api/banners/$id/image", $public[0]['image_url']);

        $this->get(parse_url($public[0]['image_url'], PHP_URL_PATH))
            ->assertOk()->assertHeader('Content-Type', 'image/png');

        // Updating without an image keeps the stored one; null removes it.
        $this->putJson("/api/banners/$id", $this->payload(['headline' => ['fr' => 'Nouveau', 'en' => '', 'ar' => '']]))->assertOk();
        $banner = Banner::find($id);
        $this->assertSame('Nouveau', $banner->headline['fr']);
        $this->assertSame(self::PNG, $banner->image);

        $this->putJson("/api/banners/$id", $this->payload(['image' => null]))->assertOk();
        $this->assertNull(Banner::find($id)->image);

        $this->patchJson("/api/banners/$id/active", ['active' => false])->assertOk()->assertJson(['status' => 'inactive']);
        $this->getJson('/api/banners')->assertOk()->assertJsonCount(0);

        $this->deleteJson("/api/banners/$id")->assertOk();
        $this->assertSame(0, Banner::count());
    }

    public function test_deal_banner_uses_live_deal_data_without_copying_it(): void
    {
        $this->actingAsAdmin();
        $deal = $this->deal();

        $id = $this->postJson('/api/banners', $this->payload([
            'promotion_type' => 'deal',
            'deal_id' => $deal->id,
            'headline' => null,
        ]))->assertCreated()->json('id');

        $banner = Banner::find($id);
        $this->assertNull($banner->promotional_price);
        $this->assertNull($banner->original_price);

        $row = $this->getJson('/api/banners')->json(0);
        $this->assertSame('AirPods Pro 2', $row['name']);
        $this->assertEquals(400, $row['original_price']);
        $this->assertEquals(300, $row['promotional_price']);
        $this->assertSame(25, $row['discount_percentage']);
        $this->assertSame("/deal/{$deal->id}", $row['button_url']);
        $this->assertNotNull($row['image_url']);

        // A price change on the deal shows up in the banner immediately.
        $deal->update(['price' => 200, 'discount' => 50]);
        $this->assertEquals(200, $this->getJson('/api/banners')->json('0.promotional_price'));

        // An inactive or deleted deal hides the banner.
        $deal->update(['active' => false]);
        $this->getJson('/api/banners')->assertJsonCount(0);
        $deal->update(['active' => true]);
        $deal->delete();
        $this->getJson('/api/banners')->assertJsonCount(0);
        $this->assertTrue($this->getJson('/api/admin/banners')->json('0.source_unavailable'));
    }

    public function test_bogo_deal_banner_exposes_second_item_price(): void
    {
        $this->actingAsAdmin();
        $deal = $this->deal(['offer_type' => 'bogo_fixed', 'old_price' => 150, 'price' => 150, 'discount' => 0, 'second_item_price' => 50]);

        $this->postJson('/api/banners', $this->payload(['promotion_type' => 'deal', 'deal_id' => $deal->id]))->assertCreated();

        $row = $this->getJson('/api/banners')->json(0);
        $this->assertSame('bogo_fixed', $row['offer_type']);
        $this->assertEquals(50, $row['second_item_price']);
        $this->assertNull($row['original_price']);
        $this->assertNull($row['discount_percentage']);
    }

    public function test_product_banner_and_duo_secondary_panel(): void
    {
        $this->actingAsAdmin();
        $product = Product::create(['name' => 'Oraimo FreePods', 'price' => 289, 'images' => [self::PNG]]);
        $deal = $this->deal();

        $id = $this->postJson('/api/banners', $this->payload([
            'promotion_type' => 'product',
            'product_id' => $product->id,
            'deal_id' => $deal->id, // ignored: does not match the type
            'layout' => 'duo',
            'secondary' => ['type' => 'deal', 'deal_id' => $deal->id, 'label' => ['fr' => 'AIRPODS'], 'discount_percentage' => 50],
        ]))->assertCreated()->json('id');

        $this->assertNull(Banner::find($id)->deal_id);

        $row = $this->getJson('/api/banners')->json(0);
        $this->assertEquals(289, $row['promotional_price']);
        $this->assertSame("/product/{$product->id}", $row['button_url']);
        $this->assertSame('AIRPODS', $row['secondary']['label']['fr']);
        $this->assertSame(50, $row['secondary']['discount_percentage']); // override wins
        $this->assertSame("/deal/{$deal->id}", $row['secondary']['button_url']);
        $this->assertStringContainsString('slot=secondary', $row['secondary']['image_url']);
        $this->get(parse_url($row['secondary']['image_url'], PHP_URL_PATH) . '?slot=secondary')->assertOk();
    }

    public function test_scheduling_controls_visibility_and_status(): void
    {
        $this->actingAsAdmin();
        Carbon::setTestNow('2026-11-06 12:00:00');

        $this->postJson('/api/banners', $this->payload(['title' => 'Now', 'start_date' => '2026-11-06T10:00:00Z', 'end_date' => '2026-11-07T10:00:00Z']))->assertCreated();
        $this->postJson('/api/banners', $this->payload(['title' => 'Later', 'start_date' => '2026-11-10T00:00:00+01:00']))->assertCreated();
        $this->postJson('/api/banners', $this->payload(['title' => 'Past', 'end_date' => '2026-11-05T00:00:00Z']))->assertCreated();
        $this->postJson('/api/banners', $this->payload(['title' => 'Off', 'active' => false]))->assertCreated();

        $this->assertSame(['Now'], array_column($this->getJson('/api/banners')->json(), 'title'));

        $statuses = collect($this->getJson('/api/admin/banners')->json())->pluck('status', 'title')->all();
        $this->assertSame(['Now' => 'active', 'Later' => 'scheduled', 'Past' => 'expired', 'Off' => 'inactive'], $statuses);

        // Offsets are normalised to UTC.
        $this->assertSame('2026-11-09 23:00:00', Banner::where('title', 'Later')->first()->start_date->format('Y-m-d H:i:s'));

        Carbon::setTestNow('2026-11-10 08:00:00');
        $this->assertSame(['Later'], array_column($this->getJson('/api/banners')->json(), 'title'));
        Carbon::setTestNow();
    }

    public function test_reorder_changes_public_order(): void
    {
        $this->actingAsAdmin();
        $a = $this->postJson('/api/banners', $this->payload(['title' => 'A']))->json('id');
        $b = $this->postJson('/api/banners', $this->payload(['title' => 'B']))->json('id');
        $c = $this->postJson('/api/banners', $this->payload(['title' => 'C']))->json('id');

        $this->assertSame(['A', 'B', 'C'], array_column($this->getJson('/api/banners')->json(), 'title'));

        $this->putJson('/api/banners/reorder', ['ids' => [$c, $a, $b]])->assertOk();
        $this->assertSame(['C', 'A', 'B'], array_column($this->getJson('/api/banners')->json(), 'title'));
    }

    public function test_validation_rejects_bad_input(): void
    {
        $this->actingAsAdmin();

        $this->postJson('/api/banners', $this->payload(['headline' => ['fr' => ' ']]))
            ->assertStatus(422)->assertJsonValidationErrors('headline');
        $this->postJson('/api/banners', $this->payload(['promotion_type' => 'deal']))
            ->assertStatus(422)->assertJsonValidationErrors('deal_id');
        $this->postJson('/api/banners', $this->payload(['promotion_type' => 'product', 'product_id' => 999]))
            ->assertStatus(422)->assertJsonValidationErrors('product_id');
        $this->postJson('/api/banners', $this->payload(['button_url' => 'javascript:alert(1)']))
            ->assertStatus(422)->assertJsonValidationErrors('button_url');
        $this->postJson('/api/banners', $this->payload(['button_url' => '//evil.example']))
            ->assertStatus(422)->assertJsonValidationErrors('button_url');
        $this->postJson('/api/banners', $this->payload(['image' => 'data:text/html;base64,PGgxPg==']))
            ->assertStatus(422)->assertJsonValidationErrors('image');
        $this->postJson('/api/banners', $this->payload(['accent_color' => 'red']))
            ->assertStatus(422)->assertJsonValidationErrors('accent_color');
        $this->postJson('/api/banners', $this->payload(['original_price' => 100, 'promotional_price' => 150]))
            ->assertStatus(422)->assertJsonValidationErrors('promotional_price');
        $this->postJson('/api/banners', $this->payload(['start_date' => '2026-11-10', 'end_date' => '2026-11-09']))
            ->assertStatus(422)->assertJsonValidationErrors('end_date');
        $this->postJson('/api/banners', $this->payload(['layout' => 'giant']))
            ->assertStatus(422)->assertJsonValidationErrors('layout');

        $this->assertSame(0, Banner::count());
    }
}
