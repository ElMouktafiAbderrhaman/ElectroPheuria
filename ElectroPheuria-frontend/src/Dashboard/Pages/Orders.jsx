// src/pages/Orders.jsx
import { useState, useEffect } from "react";
import api from '../../services/api.js';
import { orderAmounts } from "../../utils/dealPricing";
import "./Orders.css"; // Import the CSS file

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

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchId, setSearchId] = useState("");
  const [confirmRefund, setConfirmRefund] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  const handleCopyAddress = async (order) => {
    const text = [orderAddress(order), orderCity(order)].filter(Boolean).join(", ");
    if (text && (await copyText(text))) {
      setCopiedId(order.id);
      setTimeout(() => setCopiedId((id) => (id === order.id ? null : id)), 2000);
    }
  };

  const statusOrder = { pending: 0, ongoing: 1, shipped: 2, done: 3, refunded: 4, cancelled: 5 };

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

      // Refresh products & deals stock after cancellation
      if (newStatus === 'cancelled') {
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

      {confirmRefund && (
        <div className="refund-overlay" onClick={() => setConfirmRefund(null)}>
          <div className="refund-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Confirm Refund</h3>
            <p>Are you sure about submitting this action? Order <strong>#{confirmRefund}</strong> will be refunded and stock will be restored.</p>
            <div className="refund-modal-actions">
              <button className="action-btn cancel-btn" onClick={() => setConfirmRefund(null)}>Cancel</button>
              <button className="action-btn refund-btn" onClick={() => { handleStatusChange(confirmRefund, "refunded"); setConfirmRefund(null); }}>Yes, Refund</button>
            </div>
          </div>
        </div>
      )}

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
                    {order?.status || "N/A"}
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
                  {order.status === "pending" && (
                    <>
                      <button className="action-btn confirm-btn" onClick={() => handleStatusChange(order.id, "ongoing")}>Confirm</button>
                      <button className="action-btn cancel-btn" onClick={() => handleStatusChange(order.id, "cancelled")}>Cancel</button>
                    </>
                  )}
                  {order.status === "ongoing" && (
                    <>
                      <button className="action-btn ship-btn" onClick={() => handleStatusChange(order.id, "shipped")}>Shipped</button>
                      <button className="action-btn cancel-btn" onClick={() => handleStatusChange(order.id, "cancelled")}>Cancel</button>
                    </>
                  )}
                  {order.status === "shipped" && (
                    <button className="action-btn refund-btn" onClick={() => setConfirmRefund(order.id)}>Refund</button>
                  )}
                  {order.status === "refunded" && (
                    <span className="status-final">refunded</span>
                  )}
                  {(order.status === "done" || order.status === "cancelled") && (
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