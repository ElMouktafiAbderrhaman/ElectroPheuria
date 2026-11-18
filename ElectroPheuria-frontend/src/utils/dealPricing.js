// Shared deal price helpers. The rounding matches ProductController::validatedDealPricing
// (round to whole percent), so the storefront badge equals the saved `discount`.

const toNumber = (v) => {
  const n = typeof v === "string" ? parseFloat(v.replace(",", ".")) : Number(v);
  return Number.isFinite(n) ? n : NaN;
};

/** Whole-number discount percentage, or null when the prices can't produce one. */
export function calcDiscountPercent(originalPrice, promoPrice) {
  const oldP = toNumber(originalPrice);
  const newP = toNumber(promoPrice);
  if (!(oldP > 0) || !(newP > 0) || newP >= oldP) return null;
  return Math.round(((oldP - newP) / oldP) * 100);
}

/** Validation message for the admin form, or "" when both prices are valid. */
export function validateDealPrices(originalPrice, promoPrice) {
  const oldP = toNumber(originalPrice);
  const newP = toNumber(promoPrice);
  if (!(oldP > 0)) return "Original price must be a positive number.";
  if (!(newP > 0)) return "Promotional price must be a positive number.";
  if (newP >= oldP) return "Promotional price must be lower than the original price.";
  return "";
}

// Offer types — must match App\Support\OfferPricing on the backend.
export const OFFER_STANDARD = "standard";
export const OFFER_BOGO_HALF = "bogo_half"; // buy 1, get the 2nd at 50% off
export const OFFER_BOGO_FIXED = "bogo_fixed"; // buy 1, get the 2nd for a fixed price (second_item_price)

/** Any "buy 1, get the 2nd …" offer: no promotional price, the second unit is cheaper. */
export const isBogoDeal = (item) => item?.offer_type === OFFER_BOGO_HALF || item?.offer_type === OFFER_BOGO_FIXED;
export const isBogoFixedDeal = (item) => item?.offer_type === OFFER_BOGO_FIXED;
export const secondItemPrice = (item) => toNumber(item?.second_item_price);

/** Customer-facing offer name, e.g. "Buy 1, Get the 2nd for 50 MAD". */
export const offerLabel = (item, t) =>
  isBogoFixedDeal(item) ? t("bogoFixedOffer", { price: formatPrice(item.second_item_price) }) : t("bogoOffer");

/** Short badge for deal cards, e.g. "2nd at 50 MAD". */
export const offerBadge = (item, t) =>
  isBogoFixedDeal(item) ? t("bogoFixedBadge", { price: formatPrice(item.second_item_price) }) : t("bogoBadge");

/** Short admin label for deal lists. */
export const offerShortLabel = (item) =>
  isBogoFixedDeal(item) ? `1+1 · 2nd ${formatPrice(item.second_item_price)} MAD` : "1+1 · 2nd -50%";

/** Validation message for a fixed second-item price, or "" when valid. */
export function validateSecondItemPrice(unitPrice, secondPrice) {
  const unit = toNumber(unitPrice);
  const second = toNumber(secondPrice);
  if (!Number.isFinite(second) || second < 0) return "Price of the second item must be 0 or more.";
  if (unit > 0 && second >= unit) return "Price of the second item must be lower than the unit price.";
  return "";
}

const round2 = (n) => Math.round(n * 100) / 100;

/** Largest whole amount ending in 9 that is not above `amount` (447.50 → 439, 449 → 449). */
export function charmPrice(amount) {
  const whole = Math.floor(amount + 1e-9);
  if (whole < 9) return Math.max(whole, 0);
  return Math.floor((whole - 9) / 10) * 10 + 9;
}

/**
 * Line price for a cart item. Mirrors OfferPricing::line — every second unit of a
 * "buy 1, get the 2nd at 50% off" item is half price, then the line is rounded down
 * to a price ending in 9 (199 × 2 = 298.50 → 289). Single items are never rounded.
 * For "buy 1, get the 2nd for X MAD" every second unit costs exactly X (199 + 50 = 249).
 * The server recomputes this from database prices; this is for display only.
 */
export function lineTotal(item) {
  const unit = toNumber(item?.price) || 0;
  const qty = Math.max(1, parseInt(item?.quantity, 10) || 1);
  const subtotal = round2(unit * qty);
  const pairs = Math.floor(qty / 2);
  const second = secondItemPrice(item);
  let total = subtotal;
  if (item?.offer_type === OFFER_BOGO_HALF && pairs > 0) {
    total = charmPrice(subtotal - pairs * unit * 0.5);
  } else if (isBogoFixedDeal(item) && pairs > 0 && second >= 0 && second < unit) {
    total = subtotal - pairs * (unit - second);
  }
  return { subtotal, discount: round2(subtotal - total), total: round2(total) };
}

/** Cart-wide subtotal, 1+1 offer savings and payable total. */
export function cartTotals(cart = []) {
  return cart.reduce(
    (acc, item) => {
      const l = lineTotal(item);
      return {
        subtotal: round2(acc.subtotal + l.subtotal),
        discount: round2(acc.discount + l.discount),
        total: round2(acc.total + l.total),
      };
    },
    { subtotal: 0, discount: 0, total: 0 }
  );
}

/** Discount to show on a deal card: computed from prices, falling back to the saved value. */
export function dealDiscount(deal) {
  if (isBogoDeal(deal)) return null; // 1+1 deals have no promotional price

  const computed = calcDiscountPercent(deal?.oldPrice ?? deal?.old_price, deal?.price);
  if (computed !== null) return computed;
  const saved = Number(deal?.discount);
  return saved > 0 ? Math.round(saved) : null;
}

/** "1299" / "149.50" — matches the site's existing price display, without ".00". */
export function formatPrice(value) {
  const n = toNumber(value);
  if (!Number.isFinite(n)) return "";
  const rounded = Math.round(n * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}

export const isDealActive = (deal) => deal?.active !== false && deal?.active !== 0;

/** Hidden products stay out of the store (packs that contain them still work). */
export const isProductActive = (product) => product?.active !== false && product?.active !== 0;

/** "Coming soon" items are shown with a teaser design and cannot be added to the cart. */
export const isComingSoon = (item) => item?.coming_soon === true || item?.coming_soon === 1 || item?.coming_soon === "1";

/**
 * Fixed delivery fee per order, anywhere in Morocco (MAD). Charged once per order,
 * whatever the number of items. Must match config/shop.php `delivery_fee` on the
 * backend, which adds it to the stored order total.
 */
export const DELIVERY_FEE = 20;

/** Cart totals plus delivery: `products` = items after offers, `total` = what the customer pays. */
export function orderTotals(cart = []) {
  const t = cartTotals(cart);
  const delivery = cart.length > 0 ? DELIVERY_FEE : 0;
  const items = cart.reduce((n, item) => n + Math.max(1, parseInt(item?.quantity, 10) || 1), 0);
  return { ...t, products: t.total, delivery, items, total: round2(t.total + delivery) };
}

/**
 * Amounts of a saved order: products (revenue), delivery fee and the total the customer pays.
 * Orders placed before the delivery fee existed have no subtotal and a 0 fee.
 */
export function orderAmounts(order) {
  const total = Number(order?.total_price ?? order?.total ?? 0) || 0;
  const delivery = Number(order?.delivery_fee ?? 0) || 0;
  const products = order?.subtotal !== null && order?.subtotal !== undefined ? Number(order.subtotal) || 0 : round2(total - delivery);
  return { products, delivery, total };
}

/**
 * Storefront order: items customers can buy now first, then sold-out items,
 * then "coming soon" teasers. Array.sort is stable, so the catalog order is kept inside each group.
 * `soldOut` lets products with cable variants pass their own sold-out check.
 */
export const availabilityRank = (item, soldOut = (i) => Number(i?.stock) <= 0) =>
  isComingSoon(item) ? 2 : soldOut(item) ? 1 : 0;

export const byAvailability = (soldOut) => (a, b) => availabilityRank(a, soldOut) - availabilityRank(b, soldOut);
