// src/pages/Checkout.jsx
import { useState } from "react";
import { useCart } from "../context/CartContext";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import api from "../services/api";
import "./Checkout.css";

export default function Checkout() {
  const { cart, clearCart } = useCart();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [confirmPhone, setConfirmPhone] = useState("");
  const [email, setEmail] = useState("");
  const [city] = useState("Casablanca");
  const [submitting, setSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [message, setMessage] = useState(""); // Added for success/error messages

  // Calculate total price with quantity (matching Cart.jsx)
  const totalPrice = cart.reduce((sum, item) => sum + (Number(item.price || 0) * item.quantity), 0);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (submitting) return;

    if (!name || !phone || !confirmPhone || !city) {
      alert(t("fillAllFields"));
      return;
    }

    if (phone !== confirmPhone) {
      alert(t("phoneMismatch"));
      return;
    }

    if (cart.length === 0) {
      alert(t("emptyCart"));
      navigate("/products");
      return;
    }

    setSubmitting(true);
    setMessage("");

    const orderData = {
      client: {
        name,
        email,
        phone,
        address: city,
      },
      products: cart,
      total_price: totalPrice
    };

    try {
      await api.createOrder(orderData);
      clearCart();

      // Refresh products & deals to get updated stock
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

      setSubmitting(false);
      setOrderSuccess(true);
      setTimeout(() => navigate("/"), 4000);
    } catch (error) {
      setSubmitting(false);
      setMessage(t("orderError"));
      console.error(error);
    }
  };

  return (
    <main className="checkout-main">
      {/* Loading Overlay */}
      {submitting && (
        <div className="checkout-overlay">
          <div className="checkout-overlay-content">
            <div className="checkout-spinner"></div>
            <p>{t("processingOrder")}</p>
          </div>
        </div>
      )}

      {/* Success Overlay */}
      {orderSuccess && (
        <div className="checkout-overlay success-overlay">
          <div className="checkout-overlay-content">
            <div className="success-checkmark">✓</div>
            <h3>{t("orderSuccess")}</h3>
            <p>{t("redirecting")}</p>
          </div>
        </div>
      )}

      <div className="checkout-header">
        <h2>{t("checkout")}</h2>
      </div>
      
      <div className="checkout-content">
        {/* Left: User Info Form */}
        <div className="checkout-form-section">
          <h3>{t("shippingInfo")}</h3>
          <form onSubmit={handleSubmit} className="checkout-form">
            <input
              type="text"
              placeholder={t("fullName")}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="checkout-input"
              required
            />
            <input
              type="tel"
              placeholder={t("phoneWhatsapp")}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="checkout-input"
              required
            />
            <input
              type="tel"
              placeholder={t("confirmPhone")}
              value={confirmPhone}
              onChange={(e) => setConfirmPhone(e.target.value)}
              className={`checkout-input ${confirmPhone && confirmPhone !== phone ? 'input-error' : ''}`}
              required
            />
            {confirmPhone && confirmPhone !== phone && (
              <span className="error-hint">{t("phoneMismatchHint")}</span>
            )}
            <input
              type="email"
              placeholder={t("emailOptional")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="checkout-input"
            />
            <input
              type="text"
              value={city}
              className="checkout-input checkout-input-disabled"
              readOnly
            />
            <button type="submit" className="checkout-button" disabled={submitting}>
              {submitting ? t("processingOrder") : t("submitOrder")}
            </button>
          </form>
          {message && <p className="checkout-message">{message}</p>} {/* Added message display */}
        </div>

        {/* Right: Order Summary & Delivery */}
        <div className="checkout-summary-section">
          {/* Order Summary */}
          <div className="order-summary">
            <h3>{t("orderSummary")}</h3>
            <div className="summary-items">
              {cart.map((item) => (
                <div key={item.id} className="summary-item">
                  <img 
                    src={item.images?.[0] || item.image} 
                    alt={item.name} 
                    className="summary-image"
                  />
                  <div className="summary-details">
                    <h4>{item.name}</h4>
                    <p>{item.quantity} x {item.price?.toFixed(2)} MAD = {(item.price * item.quantity).toFixed(2)} MAD</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="summary-total">
              <p><strong>Total: <span className="total-amount">MAD {totalPrice.toFixed(2)}</span></strong></p>
            </div>
          </div>

          {/* Delivery Info */}
          <div className="delivery-info">
            <h4>{t("delivery")}</h4>
            <p dangerouslySetInnerHTML={{ __html: t("deliveryTime") }} />
            <p><em>{t("deliveryTerms")}</em></p>
          </div>
        </div>
      </div>
    </main>
  );
}