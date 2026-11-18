import { useState, useEffect } from "react";
import api from "../../services/api.js";
import "./Clients.css";

export default function Clients() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedClient, setSelectedClient] = useState(null);
  const [clientOrders, setClientOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    api.getClients()
      .then(setClients)
      .catch(setError)
      .finally(() => setLoading(false));
  }, []);

  const viewHistory = (client) => {
    setSelectedClient(client);
    setClientOrders(client.orders || []);
    setShowModal(true);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "shipped": return "status-shipped";
      case "pending": return "status-pending";
      case "done": return "status-delivered";
      case "ongoing": return "status-processing";
      case "cancelled": return "status-cancelled";
      default: return "";
    }
  };

  if (loading) return <div className="loading">Loading clients...</div>;
  if (error) return <div className="error">Error: {error.message}</div>;

  return (
    <div className="clients-container">
      <div className="clients-header">
        <h1 className="gold-text">Clients</h1>
        <p>Manage clients and view their purchase history</p>
      </div>

      <div className="clients-table-container">
        <table className="clients-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>City</th>
              <th>Orders</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((client) => (
              <tr key={client.id} className="client-row">
                <td>{client.id}</td>
                <td>{client.name}</td>
                <td>{client.email}</td>
                <td>{client.phone}</td>
                <td>{client.address}</td>
                <td>{client.orders?.length || 0}</td>
                <td>
                  <button 
                    className="action-btn view-history-btn" 
                    onClick={() => viewHistory(client)}
                  >
                    View History
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && selectedClient && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Purchase History - {selectedClient.name}</h3>
              <button className="close-btn" onClick={() => setShowModal(false)}>×</button>
            </div>
            {ordersLoading ? (
              <div>Loading orders...</div>
            ) : (
              <div className="orders-modal-table">
                <table>
                  <thead>
                    <tr>
                      <th>Order ID</th>
                      <th>Date</th>
                      <th>Status</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clientOrders.map((order, index) => (
                      <tr key={index}>
                        <td>{order.id}</td>
                        <td>{order.created_at ? new Date(order.created_at).toLocaleDateString() : "N/A"}</td>
                        <td>
                          <span className={`status-badge ${getStatusColor(order.status)}`}>
                            {order.status}
                          </span>
                        </td>
                        <td>${Number(order.total_price || 0).toFixed(2)}</td>
                      </tr>
                    ))}
                    {clientOrders.length === 0 && (
                      <tr>
                        <td colSpan="4">No purchase history</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="clients-summary">
        <div className="summary-card">
          <h3>Total Clients</h3>
          <p className="summary-number">{clients.length}</p>
        </div>
      </div>
    </div>
  );
}

