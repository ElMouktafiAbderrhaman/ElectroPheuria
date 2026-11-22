// "Purchase Now": product page → checkout with exactly one item and its quantity.
// Everything lives in the URL (/checkout?product=12&qty=5&variant=7), so the
// selection survives a refresh, works in Instagram / Facebook / TikTok in-app
// browsers (where storage can be wiped) and can be used as an ad deep link.
import api from "../services/api";
import { isComingSoon, isDealActive, isProductActive } from "./dealPricing";
import { activeVariants, variantCartItem, isBundleDeal, bundleCartItem, bundleChoicesComplete } from "./variants";
import { parseQuantity } from "./quantity";

const isDeal = (item) => !!(item?.isDeal || item?.oldPrice !== undefined || item?.old_price !== undefined);

/** Checkout URL for one item (a cart line: product, deal, chosen cable or pack cables) and a quantity. */
export function buyNowUrl(item, quantity) {
  const params = new URLSearchParams();
  params.set(isDeal(item) ? "deal" : "product", String(item.id));
  params.set("qty", String(Math.max(1, Math.floor(Number(quantity) || 1))));
  if (item.variant_id) params.set("variant", String(item.variant_id));
  const cables = Object.entries(item.bundle_variants || {});
  if (cables.length) params.set("cables", cables.map(([k, v]) => `${k}:${v}`).join(","));
  return `/checkout?${params.toString()}`;
}

/** The checkout page was opened with a "Purchase Now" item. */
export const isBuyNowSearch = (searchParams) => searchParams.has("product") || searchParams.has("deal");

/** Page to send the customer back to when the item needs a choice or is unavailable. */
export function buyNowItemPath(searchParams) {
  const product = searchParams.get("product");
  if (product) return `/product/${encodeURIComponent(product)}`;
  return `/deal/${encodeURIComponent(searchParams.get("deal") || "")}`;
}

class BuyNowError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

/**
 * Load the item from the live catalogue and build the checkout line.
 * Returns { line }. Throws BuyNowError: "unavailable" | "needsChoice". Stock never blocks.
 */
export async function loadBuyNowLine(searchParams) {
  const productId = searchParams.get("product");
  const dealId = searchParams.get("deal");
  const wantedQty = parseQuantity(searchParams.get("qty")) || 1;
  const variantId = searchParams.get("variant");

  let item;
  if (productId) {
    const product = await api.getProduct(productId).catch(() => null);
    if (!product?.id || !isProductActive(product) || isComingSoon(product)) throw new BuyNowError("unavailable");
    const variants = activeVariants(product);
    if (variants.length) {
      const variant = variants.find((v) => String(v.id) === String(variantId));
      if (!variant) throw new BuyNowError("needsChoice");
      item = variantCartItem(product, variant);
    } else {
      item = { ...product };
    }
  } else {
    const deal = await api.getDeal(dealId).catch(() => null);
    if (!deal?.id || !isDealActive(deal) || isComingSoon(deal) || deal.bundle_complete === false) throw new BuyNowError("unavailable");
    if (isBundleDeal(deal)) {
      const choices = Object.fromEntries(
        (searchParams.get("cables") || "").split(",").filter(Boolean).map((pair) => pair.split(":"))
      );
      if (!bundleChoicesComplete(deal, choices)) throw new BuyNowError("needsChoice");
      item = bundleCartItem(deal, choices);
    } else {
      const variants = activeVariants(deal);
      if (variants.length) {
        const variant = variants.find((v) => String(v.id) === String(variantId));
        if (!variant) throw new BuyNowError("needsChoice");
        item = variantCartItem({ ...deal, isDeal: true }, variant);
      } else {
        item = { ...deal, isDeal: true };
      }
    }
  }

  return { line: { ...item, quantity: wantedQty } };
}
