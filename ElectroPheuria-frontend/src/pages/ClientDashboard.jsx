// src/pages/ClientDashboard.jsx
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import './ClientDashboard.css'; // Create this or use Orders.css

export default function ClientDashboard({ userId = 1 }) { // Mock userId, replace with auth
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.getClientOrders(userId).then(setOrders).catch(setError).finally(() => setLoading(false));
  }, [userId]);

  if (loading) return <div className="loading">Loading your dashboard...</div>;
  if (error) return <div className="error">Error: {error.message}</div>;

  const totalSpent = orders.reduce((sum, o) => sum + parseFloat(o.total?.slice(1) || 0), 0);

  return (
    <div className="client-dashboard">
      <div className="client-header">
        <h1>My Dashboard</h1>
        <p>Track your orders and profile</p>
      </div>

      <div className="client-stats">
        <div className="stat-card">
          <h3>Total Orders</h3>
          <p>{orders.length}</p>
        </div>
        <div className="stat-card">
          <h3>Total Spent</h3>
          <p>${totalSpent.toFixed(2)}</p>
        </div>
      </div>

      <div className="client-orders">
        <h2>Your Orders</h2>
        {orders.length === 0 ? (
          <p>No orders yet. <Link to="/products">Shop now!</Link></p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Date</th>
                <th>Status</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td>{order.id}</td>
                  <td>{order.date}</td>
                  <td>{order.status}</td>
                  <td>{order.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

