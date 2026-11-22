// Small "Added to your cart" confirmation after the secondary Add to Cart button.
// The customer stays on the page and keeps browsing; "View cart" is one tap away.
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import "./BuyBox.css";

export default function CartToast({ toast, onClose }) {
  const { t } = useTranslation();

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [toast, onClose]);

  if (!toast) return null;
  return createPortal(
    <div className="cart-toast" role="status" aria-live="polite" key={toast.id}>
      <span className="cart-toast-icon" aria-hidden="true">✓</span>
      <span className="cart-toast-text">
        <strong>{t("addedToCart")}</strong>
        <span><bdi>{toast.name}</bdi> <bdi dir="ltr">× {toast.quantity}</bdi></span>
      </span>
      <Link to="/cart" className="cart-toast-link">{t("viewCart")}</Link>
      <button type="button" className="cart-toast-close" onClick={onClose} aria-label="×">×</button>
    </div>,
    document.body
  );
}
