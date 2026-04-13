// src/pages/Cart.jsx
import { useCart } from "../context/CartContext";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import "./Cart.css";

export default function Cart() {
const { cart, updateQuantity, removeFromCart } = useCart();
  const navigate = useNavigate();
  const { t } = useTranslation();

  // Calculate total price with quantity
  const totalPrice = cart.reduce((sum, item) => sum + (Number(item.price || 0) * item.quantity), 0);

  if (cart.length === 0) {
    return (
      <main className="cart-main">
        <div className="empty-cart">
          <h2>{t("emptyCart")} 🛒</h2>
          <p>{t("cartEmptyDesc")}</p>
          <Link to="/products" className="start-shopping-link">
            {t("startShopping")} →
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="cart-main">
      <div className="cart-header">
        <h2>{t("yourCart")}</h2>
      </div>

      <div className="cart-items">
        {cart.map((item) => (
          <div key={item.id} className="cart-item">
            <div className="item-image">
              <img src={item.images?.[0] || item.image} alt={item.name} />
            </div>
            <div className="item-details">
              <h4>{item.name}</h4>
              <p className="item-price">{(item.price * item.quantity).toFixed(2)} MAD</p>
              <p className="item-price-single">{item.price.toFixed(2)} MAD x {item.quantity}</p>
            </div>
            <div className="quantity-controls">
              <button 
                onClick={() => updateQuantity(item.id, item.quantity - 1)}
                disabled={item.quantity <= 1}
              >
                -
              </button>
              <span className="quantity">{item.quantity}</span>
              <button 
                onClick={() => updateQuantity(item.id, item.quantity + 1)}
                disabled={item.quantity >= (item.stock || 999)}
              >
                +
              </button>
            </div>
            <button
              className="remove-button"
              onClick={() => removeFromCart(item.id)}
            >
              🗑️
            </button>
          </div>
        ))}
      </div>

      <div className="cart-total">
        <p>{t("totalPrice")}: <span className="total-amount">MAD {totalPrice.toFixed(2)}</span></p>
      </div>

      <div className="cart-actions">
        <button
          className="order-button"
          onClick={() => navigate("/checkout")}
        >
          {t("orderNow")}
        </button>
        <Link to="/products" className="keep-shopping-link">
          {t("keepShopping")}
        </Link>
      </div>
    </main>
  );
}