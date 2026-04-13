// src/pages/SalesHistory.jsx
import { useState, useEffect } from "react";
import api from '../../services/api.js';
import "./SalesHistory.css";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export default function SalesHistory() {
  const [sales, setSales] = useState([]);
  const [monthlyData, setMonthlyData] = useState(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([
      api.getSales(),
      api.getMonthlySales(selectedYear)
    ]).then(([salesData, monthly]) => {
      setSales(salesData);
      setMonthlyData(monthly);
    }).catch(setError).finally(() => setLoading(false));
  }, [selectedYear]);

  const filteredSales = selectedMonth !== null
    ? sales.filter(s => {
        const d = new Date(s.created_at);
        return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
      })
    : sales;

  const shippedSales = filteredSales.filter(s => s.status === 'shipped');
  const filteredTotal = shippedSales.reduce((sum, s) => sum + parseFloat(s.total_price || 0), 0);
  const yearTotal = monthlyData?.months?.reduce((sum, m) => sum + m.sales, 0) || 0;

  if (loading) return <div className="loading">Loading sales...</div>;
  if (error) return <div className="error">Error: {error.message}</div>;

  return (
    <div className="sales-container">
      <div className="sales-header">
        <h1 className="gold-text">Sales History</h1>
        <p>Track and analyze your sales performance</p>
      </div>

      {/* Year selector + Monthly calendar */}
      <div className="sales-calendar-section">
        <div className="year-selector">
          <button onClick={() => setSelectedYear(y => y - 1)} className="year-btn">←</button>
          <span className="year-label">{selectedYear}</span>
          <button onClick={() => setSelectedYear(y => y + 1)} className="year-btn" disabled={selectedYear >= new Date().getFullYear()}>→</button>
        </div>

        <div className="months-grid">
          {MONTH_NAMES.map((name, i) => {
            const data = monthlyData?.months?.[i];
            const isSelected = selectedMonth === i;
            const hasSales = data && data.sales > 0;
            return (
              <div
                key={i}
                className={`month-card ${isSelected ? 'selected' : ''} ${hasSales ? 'has-sales' : ''}`}
                onClick={() => setSelectedMonth(isSelected ? null : i)}
              >
                <span className="month-name">{name.slice(0, 3)}</span>
                <span className="month-amount">{data ? data.sales.toLocaleString() : '0'} MAD</span>
                <span className="month-orders">{data ? data.orders : 0} orders</span>
              </div>
            );
          })}
        </div>

        <div className="year-total">
          Year Total: <strong>{yearTotal.toLocaleString()} MAD</strong>
        </div>
      </div>

      {/* Summary for selection */}
      <div className="sales-summary">
        <div className="summary-card">
          <h3>{selectedMonth !== null ? MONTH_NAMES[selectedMonth] : 'All Time'} Sales</h3>
          <p className="summary-number">{filteredTotal.toLocaleString()} MAD</p>
        </div>
        <div className="summary-card">
          <h3>Transactions</h3>
          <p className="summary-number">{shippedSales.length}</p>
        </div>
        <div className="summary-card">
          <h3>Average Sale</h3>
          <p className="summary-number">{shippedSales.length ? (filteredTotal / shippedSales.length).toFixed(2) : '0.00'} MAD</p>
        </div>
      </div>

      {/* Table */}
      <div className="sales-table-container">
        <table className="sales-table">
          <thead>
            <tr>
              <th>Order ID</th>
              <th>Customer</th>
              <th>Products</th>
              <th>Total</th>
              <th>Date</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredSales.map((sale, index) => (
              <tr key={index} className="sale-row">
                <td>{sale.id}</td>
                <td>{sale.client?.name || "N/A"}</td>
                <td>{Array.isArray(sale.products) ? sale.products.map(p => p.name || p.title).join(", ") : "N/A"}</td>
                <td className="price-amount">{Number(sale.total_price || 0).toLocaleString()} MAD</td>
                <td>{sale.created_at ? new Date(sale.created_at).toLocaleDateString() : "N/A"}</td>
                <td><span className={`status-badge status-${sale.status}`}>{sale.status}</span></td>
              </tr>
            ))}
            {filteredSales.length === 0 && (
              <tr><td colSpan="6" style={{textAlign: 'center', padding: '20px', color: '#888'}}>No sales for this period</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}