// src/Components/DashboardNavbar.jsx
import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useDashboardAuth } from "../../context/DashboardAuthContext";
import api from "../../services/api";
import "./DashboardNavbar.css";

export default function DashboardNavbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const { logout } = useDashboardAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchPending = () => {
      api.getOrders()
        .then(orders => {
          const pending = orders.filter(o => o.status === 'pending').length;
          setPendingCount(pending);
        })
        .catch(() => {});
    };

    fetchPending();
    const interval = setInterval(fetchPending, 30000); // poll every 30s
    window.addEventListener('ordersUpdated', fetchPending);
    return () => {
      clearInterval(interval);
      window.removeEventListener('ordersUpdated', fetchPending);
    };
  }, []);

  const handleLogout = async () => {
    setMenuOpen(false);
    try { await api.logout(); } catch (e) { /* ignore */ }
    logout();
    navigate("/dashboard/login");
  };

  return (
    <nav className="dashboard-navbar">
      <h2 className="navbar-title">Admin Panel</h2>

      <button
        className={`hamburger ${menuOpen ? "open" : ""}`}
        onClick={() => setMenuOpen(!menuOpen)}
        aria-label="Toggle menu"
      >
        <span className="hamburger-line" />
        <span className="hamburger-line" />
        <span className="hamburger-line" />
      </button>

      <div className={`navbar-links ${menuOpen ? "navbar-links--open" : ""}`}>
        <Link to="/dashboard" className="navbar-link" onClick={() => setMenuOpen(false)}>Home</Link>
        <Link to="/dashboard/add-product" className="navbar-link" onClick={() => setMenuOpen(false)}>Add Products</Link>
        <Link to="/dashboard/orders" className="navbar-link orders-link" onClick={() => setMenuOpen(false)}>
          Orders
          {pendingCount > 0 && (
            <span className="orders-badge">{pendingCount > 99 ? '99+' : pendingCount}</span>
          )}
        </Link>
        <Link to="/dashboard/clients" className="navbar-link" onClick={() => setMenuOpen(false)}>Clients</Link>
        <Link to="/dashboard/sales" className="navbar-link" onClick={() => setMenuOpen(false)}>Sales</Link>
        <Link to="/dashboard/edit-products" className="navbar-link" onClick={() => setMenuOpen(false)}>Edit Products</Link>
        <button className="navbar-link logout-link" onClick={handleLogout}>Logout</button>
      </div>

      {menuOpen && <div className="navbar-overlay" onClick={() => setMenuOpen(false)} />}
    </nav>
  );
}