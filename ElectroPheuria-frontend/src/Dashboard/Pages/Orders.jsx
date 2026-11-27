// src/pages/Orders.jsx
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import api from '../../services/api.js';
import { orderAmounts } from "../../utils/dealPricing";
import "./Orders.css"; // Import the CSS file
import "./PrepareProducts.css";

/** Full delivery address of an order (orders placed before this field existed have none). */
const orderAddress = (order) => order?.delivery_address || order?.client_data?.delivery_address || "";
const orderCity = (order) => order?.client_data?.city || order?.client_data?.address || order?.client?.address || order?.address || "";

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for http:// or older browsers
    const el = document.createElement("textarea");
    el.value = text;
    el.setAttribute("readonly", "");
    el.style.position = "fixed";
    el.style.opacity = "0";
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(el);
    return ok;
  }
}

/** Order line: name × qty, plus the chosen cable type or the two products of a pack. */
function OrderLine({ p }) {
  return (
    <div className="order-item-line">
      {p.name} x{p.quantity}
      {p.variant_label && <span className="order-item-variant">🔌 {p.variant_label}</span>}
      {Array.isArray(p.bundle_items) && p.bundle_items.length > 0 && (
        <div className="order-item-bundle">
          <span className="order-item-bundle-tag">🎁 Pack</span>
          {p.bundle_items.map((b, i) => (
            <div key={i} className="order-item-bundle-line">↳ {b.name} x{(b.quantity || 1) * (p.quantity || 1)}{b.variant_label && <span className="order-item-variant">🔌 {b.variant_label}</span>}</div>
          ))}
        </div>
      )}
    </div>
  );
}

/** What each status button does, shown in the confirmation popup before anything is sent. */
const STATUS_ACTIONS = {
  ongoing:   { label: "Confirm",  btn: "confirm-btn", title: "Confirm Order",    text: "will be confirmed." },
  on_route:  { label: "On Route", btn: "route-btn",   title: "Mark On Route",    text: "will be marked as on route (out with the courier)." },
  shipped:   { label: "Shipped",  btn: "ship-btn",    title: "Mark Shipped",     text: "will be marked as shipped (delivered and paid)." },
  cancelled: { label: "Cancel",   btn: "cancel-btn",  title: "Cancel Order",     text: "will be cancelled and its stock will be restored." },
  refunded:  { label: "Refund",   btn: "refund-btn",  title: "Confirm Refund",   text: "will be refunded and its stock will be restored." },
};

/** Buttons offered for each current status, in workflow order. */
const NEXT_STATUSES = {
  pending:  ["ongoing", "cancelled"],
  ongoing:  ["on_route", "cancelled"],
  on_route: ["shipped", "cancelled"],
  shipped:  ["refunded"],
};

const statusLabel = (status) => (status === "on_route" ? "on route" : status);

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchId, setSearchId] = useState("");
  // Status change waiting for confirmation in the popup: { order, status }.
  const [pendingChange, setPendingChange] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  const handleCopyAddress = async (order) => {
    const text = [orderAddress(order), orderCity(order)].filter(Boolean).join(", ");
    if (text && (await copyText(text))) {
      setCopiedId(order.id);
      setTimeout(() => setCopiedId((id) => (id === order.id ? null : id)), 2000);
    }
  };

  const statusOrder = { pending: 0, ongoing: 1, on_route: 2, shipped: 3, done: 4, refunded: 5, cancelled: 6 };

  const activeOrders = orders
    .filter(o => !['done', 'cancelled', 'refunded'].includes(o.status))
    .filter(o => {
      if (searchId === "") return true;
      const q = searchId.toLowerCase();
      return (
        String(o.id).includes(q) ||
        (o.client_data?.name || o.client?.name || "").toLowerCase().includes(q) ||
        (o.client_data?.email || o.client?.email || "").toLowerCase().includes(q) ||
        (o.client_data?.phone || o.client?.phone || "").toLowerCase().includes(q) ||
        (o.client_data?.city || o.client_data?.address || o.client?.address || "").toLowerCase().includes(q) ||
        orderAddress(o).toLowerCase().includes(q)
      );
    })
    .sort((a, b) => (statusOrder[a.status] ?? 99) - (statusOrder[b.status] ?? 99));

  useEffect(() => {
    api.getOrders().then(setOrders).catch(setError).finally(() => setLoading(false));
  }, []);

  const getStatusColor = (status) => {
    switch (status) {
      case "shipped": return "status-shipped";
      case "pending": return "status-pending";
      case "done": return "status-delivered";
      case "ongoing": return "status-processing";
      case "on_route": return "status-on-route";
      case "cancelled": return "status-cancelled";
      case "refunded": return "status-refunded";
      default: return "";
    }
  };

  const handleStatusChange = async (orderId, newStatus) => {
    try {
      await api.updateOrderStatus(orderId, newStatus);
      setOrders(prev => prev.map(o =>
        o.id === orderId ? { ...o, status: newStatus } : o
      ));
      window.dispatchEvent(new Event("ordersUpdated"));

      // Refresh products & deals stock after cancellation / refund (stock was restored)
      if (newStatus === 'cancelled' || newStatus === 'refunded') {
        try {
          const [products, deals] = await Promise.all([
            api.getProducts(),
            api.getDeals(),
          ]);
          localStorage.setItem("ElectroPheuria_products", JSON.stringify(products));
          localStorage.setItem("ElectroPheuria_deals", JSON.stringify(deals));
          window.dispatchEvent(new Event("productsUpdated"));
          window.dispatchEvent(new Event("dealsUpdated"));
        } catch (e) {
          console.error("Failed to refresh stock:", e);
        }
      }
    } catch (err) {
      alert("Failed to update order status");
      console.error(err);
    }
  };

  if (loading) return <div className="loading">Loading orders...</div>;
  if (error) return <div className="error">Error: {error.message}</div>;

  return (
    <div className="orders-container">
      <div className="orders-header">
        <h1 className="gold-text">Orders</h1>
        <p>Manage and track all customer orders</p>
        <Link to="/dashboard/prepare" className="prep-link">📦 Products to prepare →</Link>
        <div className="orders-search">
          <input
            type="text"
            placeholder="Search by ID, name, email, phone or address..."
            value={searchId}
            onChange={(e) => setSearchId(e.target.value)}
            className="search-input"
          />
        </div>
      </div>

      {pendingChange && (() => {
        const action = STATUS_ACTIONS[pendingChange.status];
        const { order } = pendingChange;
        const customer = order.client_data?.name || order.client?.name;
        return (
          <div className="refund-overlay" onClick={() => setPendingChange(null)}>
            <div className="refund-modal" onClick={(e) => e.stopPropagation()}>
              <h3>{action.title}</h3>
              <p>
                Are you sure about submitting this action? Order <strong>#{order.id}</strong>
                {customer && <> ({customer})</>} {action.text}
              </p>
              <p className="status-change-path">
                <span className={`status-badge ${getStatusColor(order.status)}`}>{statusLabel(order.status)}</span>
                {" → "}
                <span className={`status-badge ${getStatusColor(pendingChange.status)}`}>{statusLabel(pendingChange.status)}</span>
              </p>
              <div className="refund-modal-actions">
                <button className="action-btn" onClick={() => setPendingChange(null)}>Go back</button>
                <button
                  className={`action-btn ${action.btn}`}
                  autoFocus
                  onClick={() => { handleStatusChange(order.id, pendingChange.status); setPendingChange(null); }}
                >
                  Yes, {action.label}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      <div className="orders-table-container">
        <table className="orders-table">
          <thead>
            <tr>
              <th>Order ID</th>
              <th>Customer</th>
              <th>Phone</th>
              <th>City</th>
              <th>Delivery Address</th>
              <th>Email</th>
              <th>Items</th>
              <th>Date</th>
              <th>Status</th>
              <th>Total</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {activeOrders.map((order, index) => (
              <tr key={index} className="order-row">
                <td>{order?.id || "N/A"}</td>
<td>{order.client_data?.name || order?.client?.name || order?.customer || "N/A"}</td>
                <td>{order.client_data?.phone || order?.client?.phone || order?.phone || "N/A"}</td>
                <td>{orderCity(order) || "N/A"}</td>
                <td className="order-address-cell">
                  {orderAddress(order) ? (
                    <div className="order-address">
                      <span className="order-address-text" dir="auto">{orderAddress(order)}</span>
                      <button
                        type="button"
                        className={`copy-address-btn${copiedId === order.id ? " copied" : ""}`}
                        onClick={() => handleCopyAddress(order)}
                        title="Copy address and city"
                      >
                        {copiedId === order.id ? "✓ Copied" : "📋 Copy"}
                      </button>
                    </div>
                  ) : "—"}
                </td>
                <td>{order.client_data?.email || order?.client?.email || order?.email || "—"}</td>
                <td className="order-items">
                  {(() => {
                    const products = typeof order?.products === 'string' ? JSON.parse(order.products) : order?.products;
                    return products?.map((p, i) => <OrderLine key={i} p={p} />) || "—";
                  })()}
                </td>
                <td>{order?.created_at ? new Date(order.created_at).toLocaleDateString() : (order?.date || "N/A")}</td>
                <td>
                  <span className={`status-badge ${getStatusColor(order?.status)}`}>
                    {order?.status ? statusLabel(order.status) : "N/A"}
                  </span>
                </td>
                <td className="total-amount">
                  MAD {orderAmounts(order).total.toFixed(2)}
                  {orderAmounts(order).delivery > 0 && (
                    <div className="order-total-split">
                      {orderAmounts(order).products.toFixed(2)} products + {orderAmounts(order).delivery.toFixed(2)} delivery
                    </div>
                  )}
                </td>
                <td className="order-actions">
                  {(NEXT_STATUSES[order.status] || []).map((status) => (
                    <button
                      key={status}
                      className={`action-btn ${STATUS_ACTIONS[status].btn}`}
                      onClick={() => setPendingChange({ order, status })}
                    >
                      {STATUS_ACTIONS[status].label}
                    </button>
                  ))}
                  {["done", "cancelled", "refunded"].includes(order.status) && (
                    <span className="status-final">{order.status}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="orders-summary">
        <div className="summary-card">
          <h3>Active Orders</h3>
          <p className="summary-number">{activeOrders.length}</p>
        </div>
        <div className="summary-card">
          <h3>Pending Orders</h3>
          <p className="summary-number">{activeOrders.filter(o => o.status === "pending").length}</p>
        </div>
        <div className="summary-card">
          <h3>To Collect (incl. delivery)</h3>
          <p className="summary-number">
            MAD {activeOrders.reduce((sum, o) => sum + orderAmounts(o).total, 0).toFixed(2)}
          </p>
          <p className="order-total-split">
            Products MAD {activeOrders.reduce((sum, o) => sum + orderAmounts(o).products, 0).toFixed(2)}
            {" · "}Delivery MAD {activeOrders.reduce((sum, o) => sum + orderAmounts(o).delivery, 0).toFixed(2)}
          </p>
        </div>
      </div>
    </div>
  );
}