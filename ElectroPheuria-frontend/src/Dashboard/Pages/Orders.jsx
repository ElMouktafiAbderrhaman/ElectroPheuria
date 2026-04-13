// src/pages/Orders.jsx
import { useState, useEffect } from "react";
import api from '../../services/api.js';
import "./Orders.css"; // Import the CSS file

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchId, setSearchId] = useState("");
  const [confirmRefund, setConfirmRefund] = useState(null);

  const statusOrder = { pending: 0, ongoing: 1, shipped: 2, done: 3, refunded: 4, cancelled: 5 };

  const activeOrders = orders
    .filter(o => !['done', 'cancelled', 'refunded'].includes(o.status))
    .filter(o => searchId === "" || String(o.id).includes(searchId))
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
            placeholder="Search by Order ID..."
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
                <td>{order.client_data?.address || order?.client?.address || order?.address || "N/A"}</td>
                <td>{order.client_data?.email || order?.client?.email || order?.email || "—"}</td>
                <td className="order-items">
                  {(() => {
                    const products = typeof order?.products === 'string' ? JSON.parse(order.products) : order?.products;
                    return products?.map((p, i) => (
                      <div key={i} className="order-item-line">{p.name} x{p.quantity}</div>
                    )) || "—";
                  })()}
                </td>
                <td>{order?.created_at ? new Date(order.created_at).toLocaleDateString() : (order?.date || "N/A")}</td>
                <td>
                  <span className={`status-badge ${getStatusColor(order?.status)}`}>
                    {order?.status || "N/A"}
                  </span>
                </td>
                <td className="total-amount">
                  MAD {Number(order?.total_price || order?.total || 0).toFixed(2)}
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
          <h3>Total Revenue</h3>
          <p className="summary-number">
            MAD {activeOrders.reduce((sum, o) => {
              return sum + Number(o.total_price || o.total || 0);
            }, 0).toFixed(2)}
          </p>
        </div>
      </div>
    </div>
  );
}