// src/pages/Cart.jsx
import { useEffect } from "react";
import { useCart, cartLineKey } from "../context/CartContext";
import { trackAddToCart } from "../utils/fbPixel";
import { orderTotals, lineTotal, isBogoDeal, offerLabel, formatPrice } from "../utils/dealPricing";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import CartLineExtras, { cartLineImage } from "../Components/CartLineExtras";
import QuantitySelector from "../Components/QuantitySelector";
import "../Components/BuyBox.css";
import "./Cart.css";

export default function Cart() {
const { cart, updateQuantity, removeFromCart, syncWithCatalog } = useCart();
  const navigate = useNavigate();
  const { t } = useTranslation();

  useEffect(() => {
    syncWithCatalog();
  }, [syncWithCatalog]);

  // Totals include the "buy 1, get the 2nd at 50% off" savings and the fixed delivery fee
  const totals = orderTotals(cart);
  const cur = t("currency");

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
          <div key={cartLineKey(item)} className="cart-item">
            <div className="item-image">
              <img src={cartLineImage(item)} alt={item.name} />
            </div>
            <div className="item-details">
              <h4>{item.name}</h4>
              <CartLineExtras item={item} />
              {isBogoDeal(item) && <span className="cart-offer-tag">{offerLabel(item, t)}</span>}
              <p className="item-price">
                {lineTotal(item).discount > 0 && (
                  <span className="cart-line-old">{formatPrice(lineTotal(item).subtotal)} MAD</span>
                )}
                {formatPrice(lineTotal(item).total)} MAD
              </p>
              <p className="item-price-single">
                <bdi dir="ltr">{item.quantity} × {formatPrice(Number(item.price))}</bdi> {cur} · <strong className="cart-qty-words">{t("itemCount", { count: item.quantity })}</strong>
              </p>
              {lineTotal(item).discount > 0 && (
                <p className="cart-line-saving">−{formatPrice(lineTotal(item).discount)} MAD</p>
              )}
            </div>
            <QuantitySelector
              size="sm"
              showLabel={false}
              className="cart-qty"
              value={item.quantity}
              onChange={(q) => {
                if (q > item.quantity) trackAddToCart(item, q - item.quantity, item.quantity);
                updateQuantity(item, q);
              }}
            />
            <button
              className="remove-button"
              onClick={() => removeFromCart(item)}
              aria-label={t("remove")}
            >
              🗑️
            </button>
          </div>
        ))}
      </div>

      <div className="cart-total">
        {totals.discount > 0 && (
          <>
            <p className="cart-breakdown">{t("subtotal")}: <span><bdi dir="ltr">{formatPrice(totals.subtotal)}</bdi> {cur}</span></p>
            <p className="cart-breakdown cart-breakdown-saving">{t("offerSavings")}: <span><bdi dir="ltr">−{formatPrice(totals.discount)}</bdi> {cur}</span></p>
          </>
        )}
        <p className="cart-breakdown">{t("productsSubtotal")} ({t("itemCount", { count: totals.items })}): <span><bdi dir="ltr">{formatPrice(totals.products)}</bdi> {cur}</span></p>
        <p className="cart-breakdown">{t("deliveryFeeLine")}: <span>+ <bdi dir="ltr">{formatPrice(totals.delivery)}</bdi> {cur}</span></p>
        <p className="cart-grand-total">{t("youPay")}: <span className="total-amount"><bdi dir="ltr">{formatPrice(totals.total)}</bdi> {cur}</span></p>
      </div>

      <div className="cart-actions">
        <button
          className="order-button purchase-now-btn"
          onClick={() => navigate("/checkout")}
        >
          <span className="purchase-now-label">{t("purchaseNow")}</span>
          <span className="purchase-now-sub"><bdi dir="ltr">{formatPrice(totals.total)}</bdi> {cur}</span>
        </button>
      </div>
    </main>
  );
}