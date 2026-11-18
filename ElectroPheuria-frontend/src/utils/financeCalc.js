// Finance tracker calculations — ported from electropheuria-money-tracker.html.
//
// Rules that are easy to get wrong:
//  1. Delivery is charged once per order, whatever the quantity.
//  2. Advertising and packaging are paid once per order too, so they cancel out when
//     comparing a two-unit order against a one-unit order.
//  3. A two-unit deal is only worth offering when deal_price_2 > price + cost_price.
// NULL means "not known yet" and is never silently treated as 0: callers get `known` flags.

export const CATS = {
  goods: { name: "Goods", desc: "what you pay the supplier — follows sales", color: "#7b7871" },
  fixed: { name: "Fixed costs", desc: "payable even in a month where you sell nothing", color: "#e0a92e" },
  variable: { name: "Variable costs", desc: "ads, packaging, delivery — these rise with volume", color: "#5a86b8" },
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const isKnown = (v) => v !== null && v !== undefined && v !== "" && Number.isFinite(Number(v));

export const fmt = (n) =>
  (Math.abs(n % 1) > 0.005
    ? n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : Math.round(n).toLocaleString("en-GB")) + " DH";
export const fmtDate = (s) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ""));
  return m ? `${+m[3]} ${MONTHS[+m[2] - 1]} ${m[1]}` : s || "—";
};
export const fmtMonth = (k) => `${MONTHS[+k.slice(5, 7) - 1]} ${k.slice(0, 4)}`;
export const pct = (n) => (n >= 0 ? "" : "−") + Math.abs(Math.round(n)) + "%";
export const pctSigned = (n) => (n >= 0 ? "+" : "−") + Math.abs(Math.round(n)) + "%";
export const signed = (n) => (n >= 0 ? "+ " : "− ") + fmt(Math.abs(n));

// Balances, money in, spending and monthly / yearly reports are computed by the server
// (App\Support\FinanceLedger) from the saved movements — never recalculated here.

/** Totals per category over known amounts only, plus how many amounts are still missing. */
export function expenseSummary(expenses) {
  const totals = {};
  const known = {};
  let filled = 0;
  let missing = 0;
  let spendKnown = 0;
  Object.keys(CATS).forEach((c) => { totals[c] = 0; known[c] = false; });
  expenses.forEach((e) => {
    if (!isKnown(e.amount)) { missing++; return; }
    filled++;
    totals[e.category] += e.amount;
    spendKnown += e.amount;
    known[e.category] = true;
  });
  const fixedTotal = totals.fixed;
  return { totals, known, filled, missing, spendKnown, fixedTotal, fixedKnown: known.fixed && fixedTotal > 0 };
}

/**
 * Unit economics for one item. Requires a known cost_price; unknown packaging is
 * reported (packagingKnown=false) and left out of the sums rather than guessed.
 */
export function itemEconomics(item, delivery) {
  const price = Number(item.price);
  const cost = Number(item.cost_price);
  const packagingKnown = isKnown(item.packaging_cost);
  const pack = packagingKnown ? Number(item.packaging_cost) : 0;
  const perOrder = delivery + pack; // delivery and packaging: once per order

  const margin = price - cost;
  const contribution = margin - perOrder;
  const hasDeal = isKnown(item.deal_price_2);
  const deal2 = hasDeal ? Number(item.deal_price_2) : null;
  const contribution2 = hasDeal ? deal2 - cost * 2 - perOrder : null;
  const gain = hasDeal ? contribution2 - contribution : null;

  return {
    price, cost, pack, packagingKnown, perOrder, margin, contribution,
    deal2, contribution2, gain,
    floor: price + cost, // two-unit break-even: per-order costs cancel out
  };
}

/** Per sale model: per_order_net = contribution × delivery_rate − ad_cost_per_order */
export function perSale(item, qty, delivery, ad, ratePct) {
  const e = itemEconomics(item, delivery);
  const two = qty === 2 && e.deal2 !== null;
  const price = two ? e.deal2 : e.price;
  const cost = e.cost * (two ? 2 : 1);
  const margin = price - cost;
  const contrib = margin - e.perOrder;
  const net = contrib - ad;
  const perPlaced = contrib * (ratePct / 100) - ad;
  return { ...e, two, price, cost, margin, contrib, net, perPlaced, single: e.contribution, saleGain: contrib - e.contribution };
}

/** breakeven_qty = ceil(monthly_fixed_costs / per_order_net) */
export const breakevenQty = (fixedTotal, perOrderNet) => (perOrderNet > 0 ? Math.ceil(fixedTotal / perOrderNet) : null);
