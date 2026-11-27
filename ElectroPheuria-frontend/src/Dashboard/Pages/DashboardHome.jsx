// src/pages/DashboardHome.jsx
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import api from '../../services/api.js';
import "./DashboardHome.css";
import "./PrepareProducts.css";

export default function DashboardHome() {
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [recentOrders, setRecentOrders] = useState([]);
  const [prep, setPrep] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [statsData, ordersData, merchandise] = await Promise.all([
          api.getStats(),
          api.getOrders(),
          api.getMerchandise().catch(() => null),
        ]);
        setStats(statsData);
        setPrep(merchandise);
        setRecentOrders((Array.isArray(ordersData) ? ordersData : []).slice(0, 4)); // Recent 4
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return <div className="loading">Loading dashboard...</div>;
  if (error) return <div className="error">Error: {error}</div>;

  return (
    <div className="dashboard-container">
      <section className="dashboard-welcome">
        <h1 className="gold-text">Dashboard Overview</h1>
        <p>Welcome back! Here's a quick overview from your database.</p>
      </section>

      <section className="dashboard-stats">
        <div className="stats-grid">
          <div className="stat-card">
            <h3>This Month Sales <small>(products)</small></h3>
            <p className="stat-number">{parseFloat(stats.month_sales || 0).toLocaleString()} MAD</p>
            <span className="stat-change positive">all time: {parseFloat(stats.total_sales || 0).toLocaleString()} MAD</span>
            <span className="stat-change neutral">+ {parseFloat(stats.total_delivery_fees || 0).toLocaleString()} MAD delivery fees (not counted as sales)</span>
          </div>
          <div className="stat-card">
            <h3>Pending Orders</h3>
            <p className="stat-number">{stats.pending || 0}</p>
            <span className="stat-change neutral">{stats.ongoing || 0} ongoing · {stats.on_route || 0} on route · {stats.shipped || 0} shipped</span>
          </div>
          <div className="stat-card">
            <h3>Customers</h3>
            <p className="stat-number">{stats.total_customers || 0}</p>
            <span className="stat-change neutral">registered</span>
          </div>
          <div className="stat-card">
            <h3>Products</h3>
            <p className="stat-number">{stats.total_products || 0}</p>
            <span className="stat-change neutral">incl. {stats.total_deals || 0} deals</span>
          </div>
        </div>
      </section>

      {prep && (
        <section className="dashboard-prep">
          <Link to="/dashboard/prepare" className="dashboard-prep-card">
            <span className="dashboard-prep-title">📦 Products to prepare</span>
            <span className="dashboard-prep-value">{prep.total_units} units</span>
            <span className="dashboard-prep-sub">
              {prep.orders_count} order{prep.orders_count === 1 ? "" : "s"} awaiting fulfilment
              {prep.items.length > 0 && ` · top: ${prep.items.slice(0, 3).map((i) => `${i.name} ×${i.total}`).join(", ")}`}
            </span>
          </Link>
        </section>
      )}

      <section className="dashboard-activity">
        <h2>Recent Activity</h2>
        <div className="activity-list">
          {recentOrders.map((order) => (
            <div key={order.id} className="activity-item">
              <div className="activity-icon">🛒</div>
              <div className="activity-content">
                <p>Order #{order.id} by {order.client?.name || order.customer || 'Unknown'} — <strong>{order.status}</strong></p>
                <span>{new Date(order.created_at || order.date).toLocaleString()}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="dashboard-actions">
        <h2>Quick Actions</h2>
        <div className="actions-grid">
          <a href="/dashboard/add-product" className="action-btn">Add New Product</a>
          <a href="/dashboard/orders" className="action-btn">View Orders</a>
          <a href="/dashboard/edit-products" className="action-btn">Manage Inventory</a>
          <a href="/dashboard/sales" className="action-btn">View Sales</a>
        </div>
      </section>
    </div>
  );
}

