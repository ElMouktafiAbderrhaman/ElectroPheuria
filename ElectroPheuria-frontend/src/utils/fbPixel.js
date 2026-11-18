// Meta Pixel helpers. All values are real selling prices in MAD (after deal / 1+1 offers),
// computed with the same lineTotal() the cart and the server use.
import { lineTotal } from "./dealPricing";

export const PIXEL_CURRENCY = "MAD";

const round2 = (n) => Math.round(n * 100) / 100;

/** Thin wrapper around the Meta Pixel global so call sites don't need the "is fbq loaded" check. */
export function fbTrack(event, params, eventId) {
  if (typeof window !== "undefined" && typeof window.fbq === "function") {
    if (eventId) window.fbq("track", event, params, { eventID: eventId });
    else window.fbq("track", event, params);
  }
}

export const isDealItem = (item) =>
  !!(item?.isDeal || item?.oldPrice !== undefined || item?.old_price !== undefined);

/** Catalog id sent to Meta. Products and deals have separate id ranges, so deals are prefixed. */
export const pixelContentId = (item) => (isDealItem(item) ? `deal-${item.id}` : String(item.id));

/** Real price of one unit when bought alone: `price` is what the server charges (deal promo price included). */
export const unitSellingPrice = (item) => Number(item?.price) || 0;

/** Pixel `contents` for cart lines, with item_price = effective unit price after offers. */
export function pixelContents(lines) {
  return lines.map((item) => {
    const quantity = Math.max(1, parseInt(item.quantity, 10) || 1);
    return {
      id: pixelContentId(item),
      quantity,
      item_price: round2(lineTotal({ ...item, quantity }).total / quantity),
    };
  });
}

/** Standard e-commerce payload for a set of cart lines. */
export function cartPayload(lines, value) {
  const contents = pixelContents(lines);
  return {
    value: round2(value ?? lines.reduce((s, item) => s + lineTotal(item).total, 0)),
    currency: PIXEL_CURRENCY,
    content_ids: contents.map((c) => c.id),
    content_type: "product",
    contents,
    num_items: contents.reduce((s, c) => s + c.quantity, 0),
  };
}

/**
 * AddToCart for `addedQty` more units of `item` when the cart already holds `qtyBefore`.
 * The value is what those units actually add to the cart total, so a "2nd at 50 MAD"
 * unit reports 50, not the full 149.
 */
export function trackAddToCart(item, addedQty = 1, qtyBefore = 0) {
  const qty = Number(addedQty);
  const prevQty = Number(qtyBefore) || 0;
  // Never send a malformed event: no product, no real price or a bad quantity -> log and skip.
  if (!item || item.id === undefined || item.id === null || item.id === "" || !Number.isInteger(qty) || qty < 1
      || !(Number(item.price) > 0)) {
    console.warn("[Meta Pixel] AddToCart not sent: invalid item, price or quantity", { id: item?.id, price: item?.price, qty });
    return;
  }
  const before = prevQty > 0 ? lineTotal({ ...item, quantity: prevQty }).total : 0;
  const after = lineTotal({ ...item, quantity: prevQty + qty }).total;
  const value = round2(after - before);
  if (!Number.isFinite(value) || value < 0) {
    console.warn("[Meta Pixel] AddToCart not sent: could not compute the value", { id: item.id, value });
    return;
  }
  const id = pixelContentId(item);
  fbTrack(
    "AddToCart",
    {
      value,
      currency: PIXEL_CURRENCY,
      content_ids: [id],
      content_name: item.name,
      content_type: "product",
      contents: [{ id, quantity: qty, item_price: round2(value / qty) }],
    },
    // Unique per click, so a future Conversions API event can be deduplicated against it.
    `atc-${id}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  );
}

export function trackViewContent(item) {
  const id = pixelContentId(item);
  const price = unitSellingPrice(item);
  fbTrack("ViewContent", {
    value: price,
    currency: PIXEL_CURRENCY,
    content_ids: [id],
    content_name: item.name,
    content_type: "product",
    contents: [{ id, quantity: 1, item_price: price }],
  });
}

/**
 * Purchase from the order the server saved: value = stored total_price, contents from the
 * stored lines (line_total includes offers). eventID = "purchase-<order id>" so the same
 * order can never be counted twice (also ready for Conversions API deduplication).
 */
export function trackPurchase(order, fallbackLines = []) {
  if (!order?.id) return;
  const key = `fb_purchase_${order.id}`;
  try {
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, "1");
  } catch {
    /* storage unavailable: the submit guard still prevents double firing */
  }

  const stored = Array.isArray(order.products) && order.products.length ? order.products : null;
  const contents = stored
    ? stored.map((line) => {
        const quantity = Math.max(1, parseInt(line.quantity, 10) || 1);
        const total = Number(line.line_total ?? (Number(line.price) || 0) * quantity);
        return { id: pixelContentId(line), quantity, item_price: round2(total / quantity) };
      })
    : pixelContents(fallbackLines);

  fbTrack(
    "Purchase",
    {
      value: round2(Number(order.total_price) || 0),
      currency: PIXEL_CURRENCY,
      content_ids: contents.map((c) => c.id),
      content_type: "product",
      contents,
      num_items: contents.reduce((s, c) => s + c.quantity, 0),
      order_id: String(order.id),
    },
    `purchase-${order.id}`
  );
}
