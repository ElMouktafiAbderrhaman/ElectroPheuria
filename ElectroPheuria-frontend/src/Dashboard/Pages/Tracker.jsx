// src/Dashboard/Pages/Tracker.jsx — finance tracker ("Where the money goes").
// Every money figure (balances, money in, spending, reports) is computed by the server from the
// saved ledger movements (GET /api/finance, App\Support\FinanceLedger) and only displayed here.
// "Per sale" and "Products" are client-side unit-economics models on the catalogue costs.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../../services/api.js";
import { useTranslation } from "react-i18next";
import {
  CATS, breakevenQty, expenseSummary, fmt, fmtDate, fmtMonth, isKnown,
  itemEconomics, pct, pctSigned, perSale, signed,
} from "../../utils/financeCalc";
import MovementForm, { kindOf } from "../components/MovementForm";
import { DELIVERY_FEE } from "../../utils/dealPricing";
import "./Tracker.css";

const TABS = [
  ["cash", "Cash"], ["months", "Month by month"], ["products", "Products"], ["sale", "Per sale"],
  ["profit", "Profit"], ["spend", "Spending"], ["edit", "Edit figures"],
];

const Wait = ({ children = "to be filled in" }) => <span className="wait">{children}</span>;

function Ring({ filled, total }) {
  const c = 2 * Math.PI * 31;
  const ratio = total ? filled / total : 0;
  return (
    <div className="ring">
      <svg width="72" height="72" viewBox="0 0 76 76" aria-hidden="true">
        <circle cx="38" cy="38" r="31" fill="none" stroke="#2a2a31" strokeWidth="6" />
        <circle cx="38" cy="38" r="31" fill="none" stroke="#f5c518" strokeWidth="6" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - ratio)} transform="rotate(-90 38 38)" />
        <text x="38" y="43" textAnchor="middle" fill="#f4f3f0" fontSize="17" fontWeight="620">{Math.round(ratio * 100)}%</text>
      </svg>
      <div className="a">{filled} / {total}</div>
      <div className="b">amounts filled in</div>
    </div>
  );
}

/* ═══════════ views ═══════════ */

const ACCOUNT_LABEL = { cash: "Cash", bank: "Bank" };
const KIND_COLOR = { income: "var(--profit)", withdrawal: "var(--var)", deposit: "var(--var)" };
const CAT_COLOR = { packaging: "#a07cc5", tiktok_ads: "#e0a92e", meta_ads: "#d98b2b", stock: "#7b7871", delivery: "#5a86b8", other: "#9f9c95" };

/** One-line description of a movement: what, and for stock / delivery the product or city. */
function MovementWhat({ m, t }) {
  const kind = kindOf(m);
  const detail = m.category === "stock" && m.item_name
    ? `${m.item_name}${m.quantity ? ` · ${m.quantity} × ${fmt(m.unit_cost ?? 0)}` : ""}${m.stock_added ? " · added to stock" : ""}`
    : m.category === "delivery"
      ? [m.city, m.carrier, m.order_ref].filter(Boolean).join(" · ")
      : m.type === "income" && m.order_id ? `order #${m.order_id}` : "";
  return (
    <>
      {m.label}
      <span className="tag" style={{ borderColor: CAT_COLOR[m.category] || KIND_COLOR[m.type], color: CAT_COLOR[m.category] || KIND_COLOR[m.type] }}>{t(`fin_kind_${kind}`)}</span>
      {(detail || m.notes) && <div className="rh">{[detail, m.notes].filter(Boolean).join(" — ")}</div>}
    </>
  );
}

function MovementAmount({ m }) {
  if (m.type === "withdrawal") return <span style={{ color: "var(--var)" }}>{fmt(m.amount)}<div className="rh">bank → cash</div></span>;
  if (m.type === "deposit") return <span style={{ color: "var(--var)" }}>{fmt(m.amount)}<div className="rh">cash → bank</div></span>;
  const isIn = m.type === "income";
  return (
    <span style={{ color: isIn ? "var(--profit)" : "var(--ads)" }}>{isIn ? "+ " : "− "}{fmt(m.amount)}
      <div className="rh">{ACCOUNT_LABEL[m.account] || ""}</div></span>
  );
}

function CashView({ data }) {
  const { t } = useTranslation();
  const s = data.summary;
  const b = s.balances;
  const sorted = [...data.movements].sort((a, c) => (a.occurred_on === c.occurred_on ? c.id - a.id : a.occurred_on < c.occurred_on ? 1 : -1));
  const exp = data.orders.expected;
  return (
    <>
      <div className="vhead"><h2>Cash position</h2>
        <p>Two accounts — cash in hand and the bank. Every balance is calculated from the saved movements: starting figure + money in − spending, with withdrawals and deposits moving money between the two.</p></div>
      <div className="block">
        <div className="hero">
          <div className="hl">Total money (cash + bank)</div>
          <div className={`hv num ${b.total >= 0 ? "pos" : "neg"}`}>{fmt(b.total)}</div>
          <div className="hd">{data.settings.reconciled_on
            ? `Bank last reconciled with the statement on ${fmtDate(data.settings.reconciled_on)}`
            : "Never reconciled with the bank statement — treat as an estimate"}</div>
        </div>
        <div className="trio">
          <div className="tc"><div className="tl">Cash in hand</div><div className="tv num" data-testid="bal-cash">{fmt(b.cash)}</div>
            <div className="tsub">received, not deposited yet · started at {fmt(s.opening.cash)}</div></div>
          <div className="tc"><div className="tl">Bank</div><div className="tv num" data-testid="bal-bank">{fmt(b.bank)}</div>
            <div className="tsub">started at {fmt(s.opening.bank)}{data.settings.opening_date ? ` on ${fmtDate(data.settings.opening_date)}` : ""}</div></div>
          <div className="tc"><div className="tl">Transfers</div><div className="tv num">{fmt(s.withdrawals + s.deposits)}</div>
            <div className="tsub">{fmt(s.withdrawals)} withdrawn · {fmt(s.deposits)} deposited — not income, not spending</div></div>
        </div>
        <div className="trio">
          <div className="tc in"><div className="tl">Money in (received)</div><div className="tv num" data-testid="money-in">{fmt(s.income)}</div>
            <div className="tsub">{fmt(s.income_by_account.cash)} cash · {fmt(s.income_by_account.bank)} bank</div></div>
          <div className="tc out"><div className="tl">Spending</div><div className="tv num">{fmt(s.spending)}</div>
            <div className="tsub">{fmt(s.spending_by_account.cash)} cash · {fmt(s.spending_by_account.bank)} bank</div></div>
          <div className="tc"><div className="tl">Expected from orders</div><div className="tv num" style={{ color: "var(--brand)" }}>{fmt(exp.total)}</div>
            <div className="tsub">{exp.count} shipped order{exp.count === 1 ? "" : "s"} not yet recorded as received · {fmt(data.orders.pipeline.total)} more in {data.orders.pipeline.count} unshipped</div></div>
        </div>
      </div>
      {exp.count > 0 && (
        <div className="notice"><span>ⓘ</span><div><b>{fmt(exp.total)} is expected but not counted as money in yet</b> ({exp.orders.map((o) => `#${o.id}`).join(", ")}).
          When the money arrives, add a <b>Money in</b> movement under Edit figures and link it to the order.</div></div>
      )}
      {sorted.length > 0 && (
        <div className="block">
          <div className="capt">Movements</div>
          <table>
            <thead><tr><th>Movement</th><th>Date</th><th className="r">Amount</th></tr></thead>
            <tbody>
              {sorted.map((m) => (
                <tr key={m.id}><td><MovementWhat m={m} t={t} /></td><td className="m">{fmtDate(m.occurred_on)}</td>
                  <td className="r"><MovementAmount m={m} /></td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function MonthsView({ data }) {
  const { t } = useTranslation();
  const [period, setPeriod] = useState("month");
  const rows = period === "year" ? data.yearly : data.monthly;
  const max = Math.max(1, ...rows.map((r) => Math.max(r.income, r.spending)));
  const label = (k) => (period === "year" ? k : fmtMonth(k));
  const total = data.summary;
  return (
    <>
      <div className="vhead"><h2>{period === "year" ? "Year by year" : "Month by month"}</h2>
        <p>Money received and money spent per {period}, from the saved movements. Withdrawals and deposits are left out: they only move money between cash and bank.</p></div>
      <div className="picker">
        <button type="button" className={`pick ${period === "month" ? "on" : ""}`} onClick={() => setPeriod("month")}>Monthly</button>
        <button type="button" className={`pick ${period === "year" ? "on" : ""}`} onClick={() => setPeriod("year")}>Yearly</button>
      </div>
      <div className="block">
        <div className="mhead"><span>{period === "year" ? "Year" : "Month"}</span>
          <span className="mleg"><i style={{ background: "var(--profit)" }} />In<i style={{ background: "var(--ads)", marginLeft: 16 }} />Spent</span>
          <span className="mr">Result · margin</span></div>
        {rows.length === 0 && <div className="none" style={{ marginTop: 18 }}>No movements recorded yet.</div>}
        {rows.map((r, i) => {
          const prev = rows[i - 1];
          const delta = prev ? (prev.income > 0 ? `${pctSigned(((r.income - prev.income) / prev.income) * 100)} in vs prev. ${period}` : r.income > 0 ? "first money in" : "") : "";
          const margin = r.income > 0 ? (r.net / r.income) * 100 : null;
          const cats = Object.entries(r.spending_by_category).filter(([, v]) => v > 0);
          return (
            <div className="mrow" key={r.period}>
              <div className="mm">{label(r.period)}{delta && <small>{delta}</small>}</div>
              <div className="mbars">
                <div className="mbar"><div className="t"><div className="f" style={{ width: `${(r.income / max) * 100}%`, background: "var(--profit)" }} /></div><span className="v">+ {fmt(r.income)}</span></div>
                <div className="mbar"><div className="t"><div className="f" style={{ width: `${(r.spending / max) * 100}%`, background: "var(--ads)" }} /></div><span className="v">− {fmt(r.spending)}</span></div>
                {cats.length > 0 && <div className="rh">{cats.map(([c, v]) => `${t(`fin_kind_${c}`)} ${fmt(v)}`).join(" · ")}</div>}
              </div>
              <div className="mres"><div className={`rv ${r.net >= 0 ? "pos" : "neg"}`}>{signed(r.net)}</div>
                <div className="rp">{margin === null ? `no money in this ${period}` : `margin ${pct(margin)}`}</div></div>
            </div>
          );
        })}
        {rows.length > 0 && (
          <div className="mtot"><div className="l">Total</div>
            <div className="m">+ {fmt(total.income)} in · − {fmt(total.spending)} spent</div>
            <div className="mres"><div className={`rv ${total.net >= 0 ? "pos" : "neg"}`}>{signed(total.net)}</div>
              <div className="rp">{total.income > 0 ? `margin ${pct((total.net / total.income) * 100)}` : "—"}</div></div></div>
        )}
      </div>
      <p className="explain">A month where stock is bought looks terrible even when nothing is wrong — inventory is paid upfront while the sales arrive over the following weeks. Read a single month against the total, not on its own.</p>
    </>
  );
}

function ProductsView({ costed, uncosted, delivery }) {
  const rows = costed.map((it) => ({ it, e: itemEconomics(it, delivery) })).sort((a, b) => b.e.contribution - a.e.contribution);
  const afters = rows.map((r) => r.e.contribution);
  const best = Math.max(...afters);
  const worst = Math.min(...afters);
  const deals = rows.filter((r) => r.e.deal2 !== null);
  const bad = deals.filter((r) => r.e.gain < 0).length;
  const flat = deals.filter((r) => r.e.gain === 0).length;
  const packMissing = rows.some((r) => !r.e.packagingKnown);

  return (
    <>
      <div className="vhead"><h2>Products</h2>
        <p>What each product sells for, what it costs you, and what's left after delivery and packaging. Ordered best contributor first.</p></div>
      <div className="block">
        <table>
          <thead><tr><th>Product</th><th className="r">Sells for</th><th className="r">Costs</th><th className="r">Margin</th><th className="r">After delivery + packaging</th></tr></thead>
          <tbody>
            {rows.map(({ it, e }) => (
              <tr key={`${it.type}-${it.id}`}>
                <td>{it.name}
                  {rows.length > 1 && e.contribution === best && <span className="tag">best</span>}
                  {rows.length > 1 && e.contribution === worst && best !== worst && <span className="tag warn">thinnest</span>}
                  <div className="rh">{it.type === "deal" ? "deal" : "product"}{e.packagingKnown ? ` · packaging ${fmt(e.pack)}` : " · packaging not known"}</div></td>
                <td className="r">{fmt(e.price)}</td><td className="r">{fmt(e.cost)}</td><td className="r">{fmt(e.margin)}</td>
                <td className="r" style={{ color: e.contribution > 0 ? "var(--profit)" : "var(--red)" }}>{fmt(e.contribution)}
                  <div className="rh">{Math.round((e.contribution / e.price) * 100)}% of price</div></td>
              </tr>
            ))}
            {uncosted.map((it) => (
              <tr key={`${it.type}-${it.id}`}><td>{it.name}<div className="rh">supplier cost missing</div></td>
                <td className="r">{fmt(Number(it.price))}</td><td className="r"><Wait /></td><td className="r"><Wait>—</Wait></td><td className="r"><Wait>—</Wait></td></tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && uncosted.length === 0 && <div className="none">No products or deals yet.</div>}
      </div>
      {rows.length > 0 && (
        <p className="explain">The column that decides things is <b>after delivery + packaging</b>: {fmt(delivery)} of shipping and the packaging come out of every order before a dirham of advertising — once per order, not per unit.
          {" "}<b>{rows[0].it.name}</b> contributes {fmt(best)} a sale, <b>{rows[rows.length - 1].it.name}</b> {fmt(worst)}.
          {packMissing && " Items marked “packaging not known” are shown without it — fill it in under Edit figures."}</p>
      )}

      <div className="block" style={{ marginTop: 24 }}>
        <div className="capt">Two-unit deals</div>
        {deals.length === 0 ? <div className="none">No two-unit deal with a known cost yet.</div> : (
          <table>
            <thead><tr><th>Product</th><th className="r">2 for</th><th className="r">Keeps</th><th className="r">vs one unit</th></tr></thead>
            <tbody>
              {deals.map(({ it, e }) => (
                <tr key={`${it.type}-${it.id}`}><td>{it.name}</td><td className="r">{fmt(e.deal2)}</td><td className="r">{fmt(e.contribution2)}</td>
                  <td className="r" style={{ color: e.gain > 0 ? "var(--profit)" : e.gain === 0 ? "var(--ink-2)" : "var(--red)" }}>
                    {e.gain > 0 ? "+ " : e.gain === 0 ? "" : "− "}{fmt(Math.abs(e.gain))}
                    <div className="rh">{e.gain >= 0 ? "" : `needs ${fmt(e.floor)}+ to break even`}</div></td></tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <p className="explain">Compared against the same customer buying <b>one</b> unit — the right comparison, because an advertisement buys one order either way. Bundling only saves the {fmt(delivery)} of delivery and the packaging, so a two-unit price has to stay above <b>single price + unit cost</b>.
        {bad > 0 && <> <b>{bad} {bad === 1 ? "deal loses" : "deals lose"} money</b> against selling one.</>}
        {flat > 0 && ` ${flat} break even in cash but hand over a second unit of stock for nothing.`}</p>
    </>
  );
}

function SaleView({ costed, delivery, spend }) {
  const [sel, setSel] = useState(0);
  const [qty, setQty] = useState(1);
  const [ad, setAd] = useState(0);
  const [rate, setRate] = useState(100);

  if (!costed.length) {
    return (<><div className="vhead"><h2>On a single sale</h2></div>
      <div className="none">Fill in a supplier cost under <b>Edit figures</b> to model a sale.</div></>);
  }
  const item = costed[Math.min(sel, costed.length - 1)];
  const hasDeal = isKnown(item.deal_price_2);
  const q = hasDeal ? qty : 1;
  const s = perSale(item, q, delivery, ad, rate);
  const adMax = Math.max(5, Math.round(s.price - s.cost));
  const loss = s.net < 0;
  const parts = [
    { c: "goods", v: s.cost, k: "Product" },
    { c: "ship", v: Math.max(0, delivery), k: "Delivery" },
    ...(s.pack > 0 ? [{ c: "pack", v: s.pack, k: "Packaging" }] : []),
    { c: "ad", v: ad, k: "Ads" },
    { c: loss ? "loss" : "keep", v: Math.abs(s.net), k: loss ? "Loss" : "Kept" },
  ];
  const span = parts.reduce((a, p) => a + p.v, 0) || 1;
  const be = breakevenQty(spend.fixedTotal, s.perPlaced);

  return (
    <>
      <div className="vhead"><h2>On a single sale</h2>
        <p>Pick a product, then move the sliders to see what's actually left once the product is bought, the delivery and packaging paid and the advertising covered.</p></div>
      <div className="picker">
        {costed.map((it, i) => (
          <button key={`${it.type}-${it.id}`} type="button" className={`pick ${it === item ? "on" : ""}`}
            onClick={() => { setSel(i); setAd((a) => Math.min(a, Math.max(5, Math.round(Number(it.price) - Number(it.cost_price))))); }}>
            {it.name}<small>{fmt(Number(it.price))}</small></button>
        ))}
      </div>
      <div className="picker" style={{ marginTop: -8 }}>
        <button type="button" className={`pick ${q === 1 ? "on" : ""}`} onClick={() => setQty(1)}>One unit<small>{fmt(Number(item.price))}</small></button>
        <button type="button" className={`pick ${q === 2 ? "on" : ""}`} disabled={!hasDeal} onClick={() => setQty(2)}>
          Two-unit deal<small>{hasDeal ? fmt(Number(item.deal_price_2)) : "no deal"}</small></button>
      </div>

      <div className="block">
        <div className="ftop"><span className="l">Price paid by the customer</span><span className="r num">{fmt(s.price)}</span></div>
        <div className="stack">
          {parts.map((p) => {
            const w = (p.v / span) * 100;
            return (
              <div key={p.c} className={`seg ${p.c}`} style={{ width: `${w}%` }}>
                {w > 15 ? <><span className="a">{fmt(p.v)}</span><span className="b">{p.k}</span></> : w > 7 ? <span className="a">{Math.round(p.v)}</span> : null}
              </div>
            );
          })}
        </div>
        <div className="keys">
          {[
            ["#7b7871", "Product cost", fmt(s.cost) + (q === 2 ? " — two units" : " — what you pay the supplier")],
            ["#5a86b8", "Delivery", fmt(delivery) + ` — courier cost minus the ${DELIVERY_FEE} DH the customer pays, once per order`],
            ["#a07cc5", "Packaging", s.packagingKnown ? fmt(s.pack) + " — once per order" : "not known yet — left out"],
            ["#e0a92e", "Advertising", fmt(ad) + " — paid once per order, however many units"],
            [loss ? "#e2695e" : "#3fba74", loss ? "Loss" : "What you keep", fmt(Math.abs(s.net)) + (loss ? " lost on every sale" : " on every delivered sale")],
          ].map(([c, n, d]) => <div className="key" key={n}><i style={{ background: c }} /><span><b>{n}</b><span>{d}</span></span></div>)}
        </div>
        <div className="istats">
          {[
            [<span key="a" style={{ color: "var(--brand)" }}>{Math.round((s.margin / s.price) * 100)}%</span>, "Gross margin", `${fmt(s.margin)} before delivery and ads`],
            [<span key="b" style={{ color: "var(--var)" }}>{Math.round((s.contrib / s.price) * 100)}%</span>, "After delivery + packaging", `${fmt(s.contrib)} once shipping is paid`],
            [<span key="c" style={{ color: loss ? "var(--red)" : "var(--profit)" }}>{Math.round((s.net / s.price) * 100)}%</span>, "After ads", `${fmt(s.net)} of the ${fmt(s.price)} paid`],
            [<span key="d" style={{ color: s.perPlaced < 0 ? "var(--red)" : "var(--profit)" }}>{fmt(s.perPlaced)}</span>, "Per order placed", `cancellations included (${rate}% delivered)`],
          ].map(([v, a, c]) => <div className="ist" key={a}><div className="a">{a}</div><div className="b">{v}</div><div className="c">{c}</div></div>)}
        </div>
      </div>

      <p className="explain" style={{ marginBottom: 18 }}>
        <b>{item.name}</b> — {q === 2 ? "two units " : "one unit "}costing {fmt(s.cost)}, sold for {fmt(s.price)}. After {fmt(delivery)} delivery{s.packagingKnown ? ` and ${fmt(s.pack)} packaging` : ""} (once per order) that leaves <b>{fmt(s.contrib)}</b> for advertising and overheads.
        {q === 2
          ? s.saleGain > 0 ? <> That's <b>{fmt(s.saleGain)} more</b> than this customer buying one.</>
            : s.saleGain === 0 ? <> That's <b>exactly the same</b> as this customer buying one — a second unit of stock for no extra money.</>
            : <> That's <b>{fmt(Math.abs(s.saleGain))} less</b> than this customer buying one. The discount is deeper than the delivery it saves.</>
          : hasDeal ? " Switch to the two-unit deal to see whether the discount pays for itself." : ""}
      </p>

      {s.perPlaced <= 0 ? (
        <div className="verdict ko"><span>⚠</span><div><b>At this level the advertising costs more than it brings in.</b> With {rate}% of orders delivered, every order you win loses about {fmt(Math.abs(s.perPlaced))}.</div></div>
      ) : (
        <div className="verdict ok"><span>✓</span><div>Every order you win returns <b>{fmt(s.perPlaced)}</b> on average, once cancellations are taken into account.
          {spend.fixedKnown && be !== null ? <> You need roughly <b>{be}</b> of them to cover your {fmt(spend.fixedTotal)} of fixed costs.</> : " Fill in the fixed costs to see how many orders cover your overheads."}</div></div>
      )}

      <div className="block">
        <div className="ctrls">
          <div className="ct">
            <label htmlFor="trk-ad"><span className="t">Advertising per order</span><span className="n num">{ad} DH</span></label>
            <input id="trk-ad" type="range" min="0" max={adMax} step="5" value={Math.min(ad, adMax)} onChange={(e) => setAd(+e.target.value)} />
            <div className="hint">Set to 0 because no campaign has run yet. Move it to model what a given cost per order would do to the margin.</div>
          </div>
          <div className="ct">
            <label htmlFor="trk-rate"><span className="t">Orders actually delivered</span><span className="n num">{rate}%</span></label>
            <input id="trk-rate" type="range" min="40" max="100" step="5" value={rate} onChange={(e) => setRate(+e.target.value)} />
            <div className="hint">At 100% until we know the real rate. With cash on delivery a share of orders is never confirmed — and the advertising for them is already paid.</div>
          </div>
        </div>
      </div>
    </>
  );
}

function ProfitView({ data, costed, delivery }) {
  const s = data.summary;
  const net = s.net;
  const npc = s.income > 0 ? (net / s.income) * 100 : null;
  const econ = costed.map((it) => itemEconomics(it, delivery));
  const mg = econ.map((e) => e.margin);
  const pcs = econ.map((e) => (e.margin / e.price) * 100);
  return (
    <>
      <div className="vhead"><h2>Profit</h2><p>Money actually received minus money actually spent, from the saved movements.</p></div>
      <div className="stats">
        <div className={`stat ${net >= 0 ? "pos" : "neg"}`}><div className="a">Net result</div><div className="b num">{fmt(net)}</div>
          <div className="c">{fmt(s.income)} received − {fmt(s.spending)} spent</div></div>
        <div className={`stat ${npc === null ? "" : npc >= 0 ? "pos" : "neg"}`}><div className="a">Net margin</div><div className="b num">{npc === null ? "—" : pct(npc)}</div>
          <div className="c">{npc === null ? "no money received yet to measure against" : "share of money in left at the end"}</div></div>
        <div className="stat known"><div className="a">Gross margin</div>
          {econ.length ? <><div className="b num">{Math.round(Math.min(...pcs))}–{Math.round(Math.max(...pcs))}%</div>
            <div className="c">{fmt(Math.min(...mg))} to {fmt(Math.max(...mg))} a unit, before delivery</div></>
            : <><div className="b wait">no costs yet</div><div className="c">fill in supplier costs</div></>}</div>
      </div>
      <p className="explain"><b>Gross margin</b> — what's left after paying for the product, before anything else.<br /><b>Net result</b> — money in minus every recorded expense (stock, ads, packaging, delivery, other). {fmt(data.orders.expected.total)} from shipped orders is still expected and not counted until it is received.</p>
    </>
  );
}

const SPEND_CATS = ["packaging", "tiktok_ads", "meta_ads", "stock", "delivery", "other"];

const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
function periodRange(key, custom) {
  const now = new Date();
  const to = ymd(now);
  if (key === "today") return { from: to, to };
  if (key === "week") { const d = new Date(now); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return { from: ymd(d), to }; } // Monday
  if (key === "month") return { from: `${to.slice(0, 7)}-01`, to };
  if (key === "year") return { from: `${to.slice(0, 4)}-01-01`, to };
  if (key === "custom") return { from: custom.from || null, to: custom.to || null };
  return { from: null, to: null };
}

function SpendView({ data, plan, version }) {
  const { t, i18n } = useTranslation();
  const [period, setPeriod] = useState("month");
  const [custom, setCustom] = useState({ from: "", to: "" });
  const [res, setRes] = useState(null);
  const [err, setErr] = useState("");
  const range = periodRange(period, custom);
  const badRange = !!(range.from && range.to && range.to < range.from);

  useEffect(() => {
    if (badRange) return undefined; // "To" before "From" while the dates are being typed
    let live = true;
    api.getFinanceSpending(range.from, range.to)
      .then((r) => { if (live) { setRes(r); setErr(""); } })
      .catch((e) => live && setErr(e?.message || "Could not load spending."));
    return () => { live = false; };
  }, [range.from, range.to, version, badRange]);

  const totals = res?.totals;
  const mx = totals ? Math.max(1, ...Object.values(totals.spending_by_category)) : 1;

  return (
    <>
      <div className="vhead" dir={i18n.dir()}><h2>{t("fin_spending")}</h2>
        <p>Every expense movement lands here automatically, in its category. Edit or delete a movement under Edit figures and these totals follow.</p></div>

      <div className="picker" dir={i18n.dir()}>
        {["today", "week", "month", "year", "all", "custom"].map((k) => (
          <button key={k} type="button" className={`pick ${period === k ? "on" : ""}`} onClick={() => setPeriod(k)}>{t(`fin_period_${k}`)}</button>
        ))}
      </div>
      {period === "custom" && (
        <div className="fgrid" style={{ marginTop: -8, marginBottom: 18 }}>
          <div className="fld"><label htmlFor="sp-from">{t("fin_from")}</label><input id="sp-from" type="date" value={custom.from} onChange={(e) => setCustom({ ...custom, from: e.target.value })} /></div>
          <div className="fld"><label htmlFor="sp-to">{t("fin_to")}</label><input id="sp-to" type="date" value={custom.to} onChange={(e) => setCustom({ ...custom, to: e.target.value })} /></div>
        </div>
      )}
      {badRange && <div className="none">“{t("fin_to")}” must be on or after “{t("fin_from")}”.</div>}
      {err && !badRange && <div className="none">{err}</div>}

      {totals && (<>
        <div className="spcards" dir={i18n.dir()}>
          <div className="spc total"><div className="a">{t("fin_totalSpending")}</div><div className="b num" data-testid="sp-total">{fmt(totals.spending)}</div>
            <div className="c">{fmt(totals.spending_by_account.cash)} {t("fin_cash").toLowerCase()} · {fmt(totals.spending_by_account.bank)} {t("fin_bank").toLowerCase()}</div></div>
          {SPEND_CATS.map((c) => (
            <div className="spc" key={c} data-testid={`sp-${c}`}><div className="a"><i style={{ background: CAT_COLOR[c] }} />{t(`fin_kind_${c}`)}</div>
              <div className="b num">{fmt(totals.spending_by_category[c])}</div>
              <div className="t"><div className="f" style={{ width: `${(totals.spending_by_category[c] / mx) * 100}%`, background: CAT_COLOR[c] }} /></div></div>
          ))}
        </div>
        <p className="explain" style={{ marginTop: -6, marginBottom: 18 }}>{t("fin_advertising")}: <b>{fmt(totals.advertising)}</b> (TikTok + Meta) · {t("fin_moneyIn")}: <b>{fmt(totals.income)}</b> in the same period.</p>

        <div className="block">
          {res.expenses.length === 0 ? <div className="none">{t("fin_noSpending")}</div> : (
            <table>
              <thead><tr><th>Expense</th><th>Date</th><th className="r">Amount</th></tr></thead>
              <tbody>
                {SPEND_CATS.map((c) => {
                  const rows = res.expenses.filter((e) => e.category === c);
                  if (!rows.length) return null;
                  return [
                    <tr className="grp" key={`g-${c}`}><td colSpan="3"><div className="n"><i style={{ background: CAT_COLOR[c] }} />{t(`fin_kind_${c}`)}</div></td></tr>,
                    ...rows.map((m) => (
                      <tr key={m.id}><td><MovementWhat m={m} t={t} /></td><td className="m">{fmtDate(m.occurred_on)}</td><td className="r"><MovementAmount m={m} /></td></tr>
                    )),
                    <tr className="sum" key={`s-${c}`}><td colSpan="2">Subtotal</td><td className="r">{fmt(totals.spending_by_category[c])}</td></tr>,
                  ];
                })}
              </tbody>
            </table>
          )}
        </div>

        {(res.delivery_by_city.length > 0 || res.stock_by_item.length > 0) && (
          <div className="split2">
            {res.delivery_by_city.length > 0 && (
              <div className="block"><div className="capt">{t("fin_byCity")}</div>
                <table><thead><tr><th>{t("fin_city")}</th><th className="r">#</th><th className="r">Last</th><th className="r">{t("fin_total")}</th></tr></thead>
                  <tbody>{res.delivery_by_city.map((r) => <tr key={r.city}><td>{r.city}</td><td className="r">{r.count}</td><td className="r">{fmt(r.last)}</td><td className="r">{fmt(r.total)}</td></tr>)}</tbody></table></div>
            )}
            {res.stock_by_item.length > 0 && (
              <div className="block"><div className="capt">{t("fin_byProduct")}</div>
                <table><thead><tr><th>{t("fin_product")}</th><th className="r">{t("fin_quantity")}</th><th className="r">{t("fin_total")}</th></tr></thead>
                  <tbody>{res.stock_by_item.map((r) => <tr key={r.item}><td>{r.item}</td><td className="r">{r.quantity || "—"}</td><td className="r">{fmt(r.total)}</td></tr>)}</tbody></table></div>
            )}
          </div>
        )}
      </>)}

      <PlanList expenses={data.expenses} plan={plan} />
    </>
  );
}

/** The older hand-typed list: kept as a plan of recurring costs (used for break-even), never added to spending. */
function PlanList({ expenses, plan }) {
  if (!expenses.length) return null;
  return (
    <div className="block">
      <div className="capt">Recurring costs — planning list (not counted in spending)</div>
      <p className="explain" style={{ marginTop: 0 }}>Your earlier hand-typed list. It feeds the break-even estimate (fixed costs per month) but is <b>not</b> added to the totals above, so nothing is counted twice. To record an actual payment, add a movement.</p>
      <table>
        <thead><tr><th>Item</th><th>Group</th><th>Period</th><th className="r">Amount</th></tr></thead>
        <tbody>
          {expenses.map((r) => (
            <tr key={r.id}><td>{r.label}{r.note && <div className="rh">{r.note}</div>}</td><td className="m">{CATS[r.category]?.name}</td>
              <td className="m">{r.period || "—"}</td><td className="r">{isKnown(r.amount) ? fmt(r.amount) : <Wait />}</td></tr>
          ))}
          <tr className="sum"><td colSpan="3">Fixed costs (for break-even)</td><td className="r">{plan.known.fixed ? fmt(plan.totals.fixed) : <Wait>—</Wait>}</td></tr>
        </tbody>
      </table>
    </div>
  );
}

/* ═══════════ edit ═══════════ */

const numOrNull = (v) => (v === "" || v === null || v === undefined ? null : Number(v));
const str = (v) => (isKnown(v) ? String(v) : "");

// Each row keeps its own draft, so a save + reload never wipes what is being typed in the
// next field, and every save sends the whole row (the latest values always win).
function ExpenseRow({ x, onSave, onDelete }) {
  const [d, setD] = useState(() => ({ label: x.label, note: x.note || "", period: x.period || "", amount: str(x.amount), category: x.category, verified: x.verified }));
  const payload = (v) => ({ ...v, label: v.label.trim() || x.label, note: v.note || null, period: v.period || null, amount: numOrNull(v.amount) });
  const changed = (v) => { const a = payload(v); return a.label !== x.label || a.note !== x.note || a.period !== x.period || a.amount !== x.amount || a.category !== x.category || a.verified !== x.verified; };
  const commit = (patch = {}) => { const v = { ...d, ...patch }; setD(v); if (changed(v)) onSave(x.id, payload(v)); };
  const field = (k) => ({ value: d[k], onChange: (e) => setD({ ...d, [k]: e.target.value }), onBlur: () => commit() });
  return (
    <div className="erow">
      <div className="nm">
        <input type="text" maxLength={255} aria-label="Label" {...field("label")} />
        <input type="text" className="note" maxLength={255} placeholder="note" aria-label="Note" {...field("note")} />
      </div>
      <select value={d.category} aria-label="Group" onChange={(e) => commit({ category: e.target.value })}>
        {Object.entries(CATS).map(([k, c]) => <option key={k} value={k}>{c.name}</option>)}</select>
      <input type="text" maxLength={255} placeholder="monthly" aria-label="Period" {...field("period")} />
      <input type="number" step="0.01" min="0" placeholder="not known" aria-label="Amount" {...field("amount")} />
      <label className="chk"><input type="checkbox" checked={d.verified} onChange={(e) => commit({ verified: e.target.checked })} /><span>checked</span></label>
      <button type="button" className="del" aria-label={`Delete ${x.label}`} onClick={() => onDelete(x)}>×</button>
    </div>
  );
}

function ItemRow({ it, onSave }) {
  const [d, setD] = useState(() => ({ cost_price: str(it.cost_price), packaging_cost: str(it.packaging_cost), deal_price_2: str(it.deal_price_2) }));
  const payload = (v) => ({
    cost_price: numOrNull(v.cost_price), packaging_cost: numOrNull(v.packaging_cost),
    ...(it.type === "product" ? { deal_price_2: numOrNull(v.deal_price_2) } : {}),
  });
  const commit = () => {
    const a = payload(d);
    if (a.cost_price !== it.cost_price || a.packaging_cost !== it.packaging_cost || (it.type === "product" && a.deal_price_2 !== it.deal_price_2)) onSave(it, a);
  };
  const field = (k, label, placeholder = "not known") => (
    <input type="number" step="0.01" min="0" placeholder={placeholder} aria-label={`${it.name} ${label}`}
      value={d[k]} onChange={(e) => setD({ ...d, [k]: e.target.value })} onBlur={commit} />
  );
  return (
    <div className="prow">
      <div className="nm">{it.name}<small>{it.type === "deal" ? "deal" : "product"}{!it.active && " · inactive"}</small></div>
      <div className="readonly num">{fmt(Number(it.price))}</div>
      {field("cost_price", "cost")}
      {field("packaging_cost", "packaging")}
      {it.deal_price_2_derived
        ? <div className="readonly num" title="Comes from the deal's offer settings">{isKnown(it.deal_price_2) ? fmt(it.deal_price_2) : "—"}</div>
        : field("deal_price_2", "two-unit price", "no deal")}
    </div>
  );
}

function EditView({ data, reload, toast }) {
  const { t } = useTranslation();
  const [settings, setSettings] = useState(data.settings);
  const [editing, setEditing] = useState(null);
  const [newExp, setNewExp] = useState({ category: "fixed", label: "", amount: "", period: "", note: "", verified: false });
  const formRef = useRef(null);

  // Saves run one after another, so two quick edits can never land out of order.
  const queue = useRef(Promise.resolve());
  const run = (fn, ok = "Saved.") => {
    queue.current = queue.current.then(async () => {
      try {
        await fn();
        await reload();
        toast(ok);
        return true;
      } catch (err) {
        const first = err?.data?.errors && Object.values(err.data.errors)[0]?.[0];
        toast(first || err.message || "Could not save.", true);
        await reload();
        return false;
      }
    });
    return queue.current;
  };

  const saveSettings = (e) => {
    e.preventDefault();
    run(() => api.updateFinanceSettings({
      opening_balance: Number(settings.opening_balance) || 0,
      opening_cash: Number(settings.opening_cash) || 0,
      opening_date: settings.opening_date || null,
      reconciled_on: settings.reconciled_on || null,
      delivery_per_order: Number(settings.delivery_per_order) || 0,
    }));
  };

  const submitMovement = async (body, reset) => {
    const id = editing?.id;
    const ok = await run(() => (id ? api.updateCashMovement(id, body) : api.addCashMovement(body)), id ? "Movement updated." : "Movement added.");
    if (ok) { if (id) setEditing(null); else reset(); }
  };

  const startEdit = (m) => { setEditing(m); setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0); };

  const saveExpense = (id, body) => run(() => api.updateExpense(id, body));
  const deleteExpense = (x) => confirm(`Delete “${x.label}”?`) && run(() => api.deleteExpense(x.id), "Removed from the planning list.");
  const addExpense = (e) => {
    e.preventDefault();
    if (!newExp.label.trim()) return toast("Give the cost a name.", true);
    run(async () => {
      await api.addExpense({ ...newExp, label: newExp.label.trim(), amount: numOrNull(newExp.amount) });
      setNewExp({ category: newExp.category, label: "", amount: "", period: "", note: "", verified: false });
    }, "Added to the planning list.");
  };

  const saveItem = (it, body) => run(() => api.updateFinanceItem(it.type, it.id, body));
  const movements = [...data.movements].sort((a, c) => (a.occurred_on === c.occurred_on ? c.id - a.id : a.occurred_on < c.occurred_on ? 1 : -1));

  return (
    <>
      <div className="vhead"><h2>Edit figures</h2>
        <p>Record every movement of money here — it is saved to the shop's database and every balance, Money in, Spending and report updates from it. Nothing has to be typed twice.</p></div>

      <form className="block" onSubmit={saveSettings}>
        <div className="capt">Starting balances</div>
        <div className="fgrid">
          <div className="fld"><label htmlFor="f-open">Bank — starting balance (DH)</label>
            <input id="f-open" type="number" step="0.01" required value={settings.opening_balance} onChange={(e) => setSettings({ ...settings, opening_balance: e.target.value })} />
            <div className="sub">What the bank account showed on the date below.</div></div>
          <div className="fld"><label htmlFor="f-cash">Cash — starting balance (DH)</label>
            <input id="f-cash" type="number" step="0.01" required value={settings.opening_cash} onChange={(e) => setSettings({ ...settings, opening_cash: e.target.value })} />
            <div className="sub">Cash in hand on the same date.</div></div>
          <div className="fld"><label htmlFor="f-opend">As of date</label>
            <input id="f-opend" type="date" value={settings.opening_date || ""} onChange={(e) => setSettings({ ...settings, opening_date: e.target.value })} /></div>
          <div className="fld"><label htmlFor="f-recon">Last reconciled with statement</label>
            <input id="f-recon" type="date" value={settings.reconciled_on || ""} onChange={(e) => setSettings({ ...settings, reconciled_on: e.target.value })} />
            <div className="sub">Leave empty if you haven't checked it against the bank.</div></div>
          <div className="fld"><label htmlFor="f-del">Average delivery per order (DH)</label>
            <input id="f-del" type="number" step="0.01" min="0" required value={settings.delivery_per_order} onChange={(e) => setSettings({ ...settings, delivery_per_order: e.target.value })} />
            <div className="sub">What the courier charges you. The customer pays {DELIVERY_FEE} DH delivery on top of the products, so the per-sale model uses this minus {DELIVERY_FEE} DH. Real delivery costs are recorded per city as movements.</div></div>
        </div>
        <div className="acts"><button type="submit">Save starting balances</button></div>
      </form>

      <div className="block" ref={formRef}>
        <MovementForm key={editing ? `e-${editing.id}` : "new"} data={data} editing={editing} onSubmit={submitMovement} onCancel={() => setEditing(null)} />
      </div>

      <div className="block">
        <div className="capt">Movements</div>
        {movements.length === 0 ? <div className="none">No movements recorded yet.</div> : (
          <table>
            <thead><tr><th>Movement</th><th>Date</th><th className="r">Amount</th><th /></tr></thead>
            <tbody>
              {movements.map((m) => (
                <tr key={m.id} className={editing?.id === m.id ? "editing" : ""}><td><MovementWhat m={m} t={t} /></td><td className="m">{fmtDate(m.occurred_on)}</td>
                  <td className="r"><MovementAmount m={m} /></td>
                  <td className="r nowrap">
                    <button type="button" className="ed" aria-label={`Edit ${m.label}`} onClick={() => startEdit(m)}>✎</button>
                    <button type="button" className="del" aria-label={`Delete ${m.label}`}
                      onClick={() => confirm(`Delete “${m.label}”? The balances and totals will be recalculated.`) && run(() => api.deleteCashMovement(m.id), "Movement deleted.").then(() => editing?.id === m.id && setEditing(null))}>×</button></td></tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="block">
        <div className="capt">Recurring costs — planning list (not counted in spending)</div>
        <p className="explain" style={{ marginTop: 0 }}>Monthly / yearly costs used for the break-even estimate. Actual payments belong in the movements above.</p>
        <div className="ehead"><span>Item</span><span>Group</span><span>Period</span><span>Amount</span><span>Checked</span><span /></div>
        {data.expenses.map((x) => <ExpenseRow key={x.id} x={x} onSave={saveExpense} onDelete={deleteExpense} />)}
        <form className="erow erow-new" onSubmit={addExpense}>
          <div className="nm"><input type="text" placeholder="New recurring cost, e.g. Hosting" maxLength={255} value={newExp.label} onChange={(e) => setNewExp({ ...newExp, label: e.target.value })} /></div>
          <select value={newExp.category} onChange={(e) => setNewExp({ ...newExp, category: e.target.value })}>
            {Object.entries(CATS).map(([k, c]) => <option key={k} value={k}>{c.name}</option>)}</select>
          <input type="text" placeholder="period" maxLength={255} value={newExp.period} onChange={(e) => setNewExp({ ...newExp, period: e.target.value })} />
          <input type="number" step="0.01" min="0" placeholder="not known" value={newExp.amount} onChange={(e) => setNewExp({ ...newExp, amount: e.target.value })} />
          <label className="chk"><input type="checkbox" checked={newExp.verified} onChange={(e) => setNewExp({ ...newExp, verified: e.target.checked })} /><span>checked</span></label>
          <button type="submit">Add</button>
        </form>
      </div>

      <div className="block">
        <div className="capt">Products — supplier cost and packaging (per order)</div>
        <div className="phead"><span>Product</span><span>Sells for</span><span>Costs</span><span>Packaging</span><span>2 for</span></div>
        {data.items.map((it) => <ItemRow key={`${it.type}-${it.id}`} it={it} onSave={saveItem} />)}
        {data.items.length === 0 && <div className="none">No products or deals yet.</div>}
        <p className="explain" style={{ marginTop: 14 }}>Prices come from the catalogue. A deal's “2 for” price follows its 1+1 offer, exactly as checkout charges it — change it on the deal itself. Packaging is charged once per order.</p>
      </div>
    </>
  );
}

/* ═══════════ page ═══════════ */

export default function Tracker() {
  const [params, setParams] = useSearchParams();
  const tab = TABS.some(([k]) => k === params.get("tab")) ? params.get("tab") : "cash";
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState({ text: "", bad: false });

  const reload = useCallback(
    () => api.getFinance().then((d) => { setData(d); setError(""); }).catch(() => setError("Could not load the figures.")),
    []
  );
  useEffect(() => { reload(); }, [reload]);
  useEffect(() => {
    if (!msg.text) return;
    const id = setTimeout(() => setMsg({ text: "", bad: false }), 2600);
    return () => clearTimeout(id);
  }, [msg]);
  const toast = useCallback((text, bad = false) => setMsg({ text, bad }), []);

  const derived = useMemo(() => {
    if (!data) return null;
    // What delivery really costs the shop per order: the courier cost minus the fixed
    // fee the customer pays on top of the products (negative = the fee covers it fully).
    const delivery = (Number(data.settings.delivery_per_order) || 0) - DELIVERY_FEE;
    const shown = data.items.filter((it) => it.active);
    const costed = shown.filter((it) => isKnown(it.cost_price) && Number(it.price) > 0);
    const uncosted = shown.filter((it) => !isKnown(it.cost_price));
    // Planning list of recurring costs: only feeds the break-even estimate.
    const spend = expenseSummary(data.expenses);
    // Completion: every expense amount, plus each shown item's cost and packaging.
    const itemFilled = shown.reduce((a, it) => a + (isKnown(it.cost_price) ? 1 : 0) + (isKnown(it.packaging_cost) ? 1 : 0), 0);
    return {
      delivery, costed, uncosted, spend,
      filled: spend.filled + itemFilled,
      total: data.expenses.length + shown.length * 2,
      missing: spend.missing + shown.length * 2 - itemFilled,
    };
  }, [data]);

  if (error && !data) return <main className="trk"><div className="wrap"><div className="none">{error} <button type="button" className="g" onClick={reload}>Retry</button></div></div></main>;
  if (!data) return <main className="trk"><div className="wrap"><p className="explain">Loading the figures…</p></div></main>;

  const { delivery, costed, uncosted, spend } = derived;
  const s = data.summary;

  return (
    <main className="trk">
      <div className="wrap">
        <div className="top">
          <div>
            <div className="bl"><i /><span>Electropheuria · Tracker</span></div>
            <h1>Where the money goes</h1>
            <p className="lede">What we spend, what we take in, and what's actually left on each sale.</p>
          </div>
          <Ring filled={derived.filled} total={derived.total} />
        </div>

        <div className="kpis">
          <div className="kpi"><div className="k">Total spent</div><div className="v num" data-testid="kpi-spent">{fmt(s.spending)}</div>
            <div className="s">{s.counts.expense} expense movement{s.counts.expense === 1 ? "" : "s"}</div></div>
          <div className="kpi"><div className="k">Money in</div><div className="v num" data-testid="kpi-in">{fmt(s.income)}</div>
            <div className="s">received · {fmt(data.orders.expected.total)} more expected from shipped orders</div></div>
          <div className={`kpi ${s.net >= 0 ? "pos" : "neg"}`}><div className="k">Result</div><div className="v num">{fmt(s.net)}</div>
            <div className="s">{s.income === 0 ? "nothing received yet" : "money in minus spent"}</div></div>
        </div>

        {derived.missing > 0 && (
          <div className="notice"><span>ⓘ</span><div><b>{derived.missing} {derived.missing === 1 ? "amount is" : "amounts are"} still missing.</b> Fill {derived.missing === 1 ? "it" : "them"} in under <b>Edit figures</b>.</div></div>
        )}

        <nav className="tabs" role="tablist">
          {TABS.map(([k, label]) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} className={`tab ${tab === k ? "on" : ""} ${k === "edit" ? "edit" : ""}`}
              onClick={() => setParams(k === "cash" ? {} : { tab: k }, { replace: true })}>{label}</button>
          ))}
        </nav>

        <div className="view" role="tabpanel">
          {tab === "cash" && <CashView data={data} />}
          {tab === "months" && <MonthsView data={data} />}
          {tab === "products" && <ProductsView costed={costed} uncosted={uncosted} delivery={delivery} />}
          {tab === "sale" && <SaleView costed={costed} delivery={delivery} spend={spend} />}
          {tab === "profit" && <ProfitView data={data} costed={costed} delivery={delivery} />}
          {tab === "spend" && <SpendView data={data} plan={spend} version={data} />}
          {tab === "edit" && <EditView data={data} reload={reload} toast={toast} />}
        </div>

        {msg.text && <div className={`trk-toast ${msg.bad ? "bad" : ""}`} role="status">{msg.text}</div>}
        <footer>Behind the admin login · never enter a card or bank account number on this page.</footer>
      </div>
    </main>
  );
}
