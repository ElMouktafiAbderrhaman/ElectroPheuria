// Quantity rules shared by the product pages, the cart and the checkout.
// Customers can order any positive whole number: stock never limits an order
// (the dashboard's "Products to prepare" shows what has to be sourced).

/** Positive whole number typed by the customer, or null ("", "0", "-3", "2.5", "abc"). */
export function parseQuantity(value) {
  const s = String(value ?? "").trim();
  if (!/^\d+$/.test(s)) return null;
  const n = parseInt(s, 10);
  return n >= 1 ? n : null;
}

/** Whole number, at least 1. */
export function clampQuantity(qty) {
  return Math.max(1, Math.floor(Number(qty) || 1));
}
