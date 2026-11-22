// Dashboard → Products to Prepare: units needed per product over all orders that
// still have to be fulfilled (new + confirmed), computed by the server from the
// orders themselves. Packs count as their items; items are grouped by product id.
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../services/api.js";
import "./PrepareProducts.css";

const STATUS_LABEL = { pending: "New", ongoing: "Confirmed" };
const REFRESH_MS = 30000;

const fmtDate = (iso) => (iso ? new Date(iso).toLocaleString([], { dateStyle: "short", timeStyle: "short" }) : "—");

/** Report limited to the chosen statuses (all / confirmed only), totals recomputed from the orders. */
function scopeReport(report, scope) {
  if (!report) return null;
  if (scope === "all") return report;
  const items = report.items
    .map((item) => {
      const orders = item.orders.filter((o) => o.status === "ongoing");
      const variants = {};
      orders.forEach((o) => { if (o.variant_label) variants[o.variant_label] = (variants[o.variant_label] || 0) + o.quantity; });
      return {
        ...item,
        orders,
        total: orders.reduce((n, o) => n + o.quantity, 0),
        orders_count: new Set(orders.map((o) => o.order_id)).size,
        variants: Object.entries(variants).map(([label, quantity]) => ({ label, quantity })),
      };
    })
    .filter((item) => item.total > 0)
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  return {
    ...report,
    items,
    total_units: items.reduce((n, i) => n + i.total, 0),
    orders_count: report.confirmed_orders,
  };
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export default function PrepareProducts() {
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);
  const [scope, setScope] = useState("all");
  const [open, setOpen] = useState(() => new Set());
  const [search, setSearch] = useState("");
  const [copied, setCopied] = useState(false);

  const load = useCallback(() => {
    api.getMerchandise()
      .then((data) => { setReport(data); setError(null); })
      .catch((err) => setError(err?.message || "Could not load the list"));
  }, []);

  // Live: refresh every 30 s, when an order changes status here, and when the tab comes back.
  useEffect(() => {
    load();
    const timer = setInterval(load, REFRESH_MS);
    const onFocus = () => document.visibilityState === "visible" && load();
    window.addEventListener("ordersUpdated", load);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      clearInterval(timer);
      window.removeEventListener("ordersUpdated", load);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [load]);

  const view = useMemo(() => scopeReport(report, scope), [report, scope]);
  const items = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!view) return [];
    if (!q) return view.items;
    return view.items.filter((i) => i.name.toLowerCase().includes(q) || i.orders.some((o) => String(o.order_id).includes(q)));
  }, [view, search]);

  const toggle = (key) =>
    setOpen((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const handleCopy = async () => {
    const text = items
      .map((i) => `${i.name} — ${i.total}${i.variants.length ? ` (${i.variants.map((v) => `${v.label} ×${v.quantity}`).join(", ")})` : ""}${i.to_source > 0 ? ` — to buy: ${i.to_source}` : ""}`)
      .join("\n");
    if (await copyText(text)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!report && error) return <div className="error">Error: {error}</div>;
  if (!report) return <div className="loading">Loading products to prepare...</div>;

  return (
    <div className="prep-container">
      <header className="prep-header">
        <h1 className="gold-text">Products to Prepare</h1>
        <p>
          Units needed to fulfil every order that is <strong>new</strong> or <strong>confirmed</strong>.
          Shipped, done, cancelled and refunded orders are not counted. Customers can order any
          quantity — "To buy" is what you still need to source because it is not in stock.
        </p>
      </header>

      <section className="prep-stats" aria-label="Summary">
        <div className="prep-stat">
          <span className="prep-stat-label">Units to prepare</span>
          <span className="prep-stat-value" data-testid="prep-total-units">{view.total_units}</span>
        </div>
        <div className="prep-stat">
          <span className="prep-stat-label">Orders awaiting fulfilment</span>
          <span className="prep-stat-value">{view.orders_count}</span>
          {scope === "all" && (
            <span className="prep-stat-sub">{report.pending_orders} new · {report.confirmed_orders} confirmed</span>
          )}
        </div>
        <div className={`prep-stat${report.total_to_source > 0 ? " prep-stat-alert" : ""}`}>
          <span className="prep-stat-label">Units to buy (not in stock)</span>
          <span className="prep-stat-value" data-testid="prep-total-to-source">{report.total_to_source ?? 0}</span>
          <span className="prep-stat-sub">{view.items.length} different product{view.items.length === 1 ? "" : "s"}</span>
        </div>
      </section>

      <div className="prep-toolbar">
        <div className="prep-scope" role="radiogroup" aria-label="Orders to include">
          <button type="button" role="radio" aria-checked={scope === "all"} className={scope === "all" ? "active" : ""} onClick={() => setScope("all")}>
            New + confirmed
          </button>
          <button type="button" role="radio" aria-checked={scope === "confirmed"} className={scope === "confirmed" ? "active" : ""} onClick={() => setScope("confirmed")}>
            Confirmed only
          </button>
        </div>
        <input
          type="search"
          className="search-input prep-search"
          placeholder="Search product or order #"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button type="button" className="prep-copy" onClick={handleCopy} disabled={items.length === 0}>
          {copied ? "✓ Copied" : "📋 Copy list"}
        </button>
      </div>

      {error && <p className="prep-warning">Could not refresh: {error}. Showing the last loaded list.</p>}

      {items.length === 0 ? (
        <div className="prep-empty">
          <p>🎉 Nothing to prepare{scope === "confirmed" ? " from confirmed orders" : ""}.</p>
          <Link to="/dashboard/orders">View orders</Link>
        </div>
      ) : (
        <ul className="prep-list">
          {items.map((item) => {
            const isOpen = open.has(item.key);
            return (
              <li key={item.key} className={`prep-item${isOpen ? " open" : ""}`}>
                <button type="button" className="prep-item-head" onClick={() => toggle(item.key)} aria-expanded={isOpen}>
                  <span className="prep-thumb">
                    {item.image ? <img src={item.image} alt="" loading="lazy" /> : <span aria-hidden="true">📦</span>}
                  </span>
                  <span className="prep-main">
                    <span className="prep-name">
                      {item.name}
                      {item.kind === "deal" && <span className="prep-kind">Deal</span>}
                    </span>
                    <span className="prep-meta">
                      {item.orders_count} order{item.orders_count === 1 ? "" : "s"}
                      {scope === "all" && item.confirmed > 0 && item.pending > 0 && ` · ${item.confirmed} confirmed, ${item.pending} new`}
                    </span>
                    {item.in_stock !== null && item.in_stock !== undefined && (
                      <span className="prep-stock">
                        {item.to_source > 0
                          ? <span className="prep-chip prep-chip-buy" data-testid="prep-item-to-source">🛒 To buy: {item.to_source}</span>
                          : <span className="prep-chip prep-chip-ok">✓ Covered by stock</span>}
                        <span className="prep-chip">📦 {item.in_stock} more in stock</span>
                      </span>
                    )}
                    {item.variants.length > 0 && (
                      <span className="prep-variants">
                        {item.variants.map((v) => (
                          <span key={v.label} className="prep-chip">🔌 {v.label} ×{v.quantity}</span>
                        ))}
                      </span>
                    )}
                  </span>
                  <span className="prep-qty" data-testid="prep-item-total">
                    <strong>{item.total}</strong>
                    <small>unit{item.total === 1 ? "" : "s"}</small>
                  </span>
                  <span className="prep-caret" aria-hidden="true">{isOpen ? "▴" : "▾"}</span>
                </button>

                {isOpen && (
                  <div className="prep-orders">
                    <table>
                      <thead>
                        <tr>
                          <th>Order</th>
                          <th>Qty</th>
                          <th>Status</th>
                          <th>Customer</th>
                          <th>Details</th>
                          <th>Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {item.orders.map((o, i) => (
                          <tr key={`${o.order_id}-${i}`}>
                            <td className="prep-order-id">#{o.order_id}</td>
                            <td><strong>×{o.quantity}</strong></td>
                            <td><span className={`prep-status prep-status-${o.status}`}>{STATUS_LABEL[o.status] || o.status}</span></td>
                            <td>{o.customer || "—"}{o.city ? <small className="prep-city"> · {o.city}</small> : null}</td>
                            <td>
                              {o.variant_label && <span className="prep-chip">🔌 {o.variant_label}</span>}
                              {o.via_pack && <span className="prep-chip">🎁 {o.via_pack}</span>}
                              {!o.variant_label && !o.via_pack && "—"}
                            </td>
                            <td>{fmtDate(o.created_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <p className="prep-updated">Updated {fmtDate(report.generated_at)} · refreshes automatically</p>
    </div>
  );
}
