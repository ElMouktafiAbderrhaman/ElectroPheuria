// Cable variants (Lightning / USB Type-C) and two-product bundle deals.
// Must match App\Models\ProductVariant and the "bundle" deal_type on the backend.
import { apiAssetUrl } from "../services/api";

export const VARIANT_TYPES = [
  { type: "lightning", label: "Lightning" },
  { type: "usb_c", label: "USB Type-C" },
];

/** Categories whose products can have cable variants ("Power Banks & Chargers"). */
export const VARIANT_CATEGORIES = ["batteries", "chargers"];

/** Variants a customer can pick from: only when the product has variants switched on. */
export const activeVariants = (product) =>
  product?.has_variants && Array.isArray(product.variants)
    ? product.variants.filter((v) => v.active !== false && v.active !== 0)
    : [];

export const hasSelectableVariants = (product) => activeVariants(product).length > 0;

/** Price of one unit of the variant (falls back to the product price). */
export const variantPrice = (product, variant) =>
  variant && variant.price !== null && variant.price !== undefined && variant.price !== ""
    ? Number(variant.price)
    : Number(product?.price);

/** Units in stock for the variant (falls back to the shared product stock). */
export const variantStock = (product, variant) =>
  variant && variant.stock !== null && variant.stock !== undefined && variant.stock !== ""
    ? Number(variant.stock)
    : Number(product?.stock ?? 0);

export const variantImage = (variant) => apiAssetUrl(variant?.image_url) || null;

export const variantLabel = (variant) =>
  variant?.label || VARIANT_TYPES.find((v) => v.type === variant?.type)?.label || variant?.type || "";

/** Product is sold out: no variant in stock (variant products) or product stock is 0. */
export const productSoldOut = (product) => {
  const variants = activeVariants(product);
  if (variants.length) return variants.every((v) => variantStock(product, v) <= 0);
  return Number(product?.stock ?? 0) <= 0;
};

/** Lowest and highest price over the active variants, for "from X MAD" displays. */
export const variantPriceRange = (product) => {
  const variants = activeVariants(product);
  if (!variants.length) return null;
  const prices = variants.map((v) => variantPrice(product, v)).filter(Number.isFinite);
  return { min: Math.min(...prices), max: Math.max(...prices) };
};

/** Cart line for a product with the chosen variant: variant price, stock and image. */
export const variantCartItem = (product, variant) => ({
  ...product,
  price: variantPrice(product, variant),
  stock: variantStock(product, variant),
  variant_id: variant.id,
  variant_type: variant.type,
  variant_label: variantLabel(variant),
  variant_image: variantImage(variant),
});

// ───────────── Bundles ─────────────

export const isBundleDeal = (deal) => deal?.deal_type === "bundle";

export const bundleProducts = (deal) => (Array.isArray(deal?.bundle_products) ? deal.bundle_products : []);

/** Image of a bundled item (base64 / absolute URL as stored on the product or deal). */
export const bundleItemImage = (item) => item?.image || null;

/** Stable React key of a pack item (a product and a deal can share the same id). */
export const bundleItemKey = (item) => item?.key || `${item?.kind || "product"}-${item?.id}`;

/** Pack items (products) whose cable type the customer must choose. */
export const bundleCableItems = (deal) =>
  bundleProducts(deal).filter((p) => (p.kind || "product") === "product" && Array.isArray(p.variants) && p.variants.length > 0);

export const bundleNeedsCableChoice = (deal) => bundleCableItems(deal).length > 0;

/** Every cable item of the pack has an in-stock cable chosen in `choices` ({productId: variantId}). */
export const bundleChoicesComplete = (deal, choices) =>
  bundleCableItems(deal).every((p) => p.variants.some((v) => String(v.id) === String(choices?.[p.id]) && Number(v.stock) > 0));

/**
 * Cart line for a pack with the chosen cables: bundle_variants is sent to the server,
 * bundle_choice_labels is only for display ([{id, name, label}]).
 */
export const bundleCartItem = (deal, choices = {}) => {
  const cableItems = bundleCableItems(deal);
  if (!cableItems.length) return { ...deal, isDeal: true };
  const bundle_variants = {};
  const bundle_choice_labels = [];
  let stock = Number(deal?.stock ?? 0);
  for (const p of cableItems) {
    const v = p.variants.find((x) => String(x.id) === String(choices[p.id]));
    if (!v) continue;
    bundle_variants[p.id] = v.id;
    bundle_choice_labels.push({ id: p.id, name: p.name, label: variantLabel(v) });
    // The chosen cable type can be scarcer than the pack as a whole.
    stock = Math.min(stock, Math.floor(Number(v.stock ?? 0) / Math.max(Number(p.quantity) || 1, 1)));
  }
  return { ...deal, isDeal: true, stock, bundle_variants, bundle_choice_labels };
};

/** Part of the cart line key for the chosen pack cables ("" when none). */
export const bundleChoiceKey = (item) => {
  const entries = Object.entries(item?.bundle_variants || {});
  return entries.sort(([a], [b]) => Number(a) - Number(b)).map(([pid, vid]) => `-b${pid}:${vid}`).join("");
};
