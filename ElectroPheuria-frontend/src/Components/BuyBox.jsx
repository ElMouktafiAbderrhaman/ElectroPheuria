// Product / deal page purchase block: quantity, total for that quantity, the big
// "PURCHASE NOW" button (straight to checkout) and a smaller "Add to cart" button
// (adds and stays on the page).
import { useTranslation } from "react-i18next";
import QuantitySelector from "./QuantitySelector";
import { formatPrice } from "../utils/dealPricing";
import "./BuyBox.css";

export default function BuyBox({ quantity, setQuantity, qtyTotal, label, onPurchase, onAddToCart, purchaseRef }) {
  const { t } = useTranslation();
  return (
    <div className="buy-box">
      <div className="buy-box-qty">
        <QuantitySelector value={quantity} onChange={setQuantity} />
        {qtyTotal !== null && quantity > 1 && (
          <p className="buy-box-total">
            {t("qtyTotal", { count: quantity })}: <strong><bdi dir="ltr">{formatPrice(qtyTotal)}</bdi> {t("currency")}</strong>
          </p>
        )}
      </div>
      <button type="button" ref={purchaseRef} onClick={onPurchase} className="purchase-now-btn" data-testid="purchase-now">
        <span className="purchase-now-label">{label}</span>
        {qtyTotal !== null && (
          <span className="purchase-now-sub"><bdi dir="ltr">{formatPrice(qtyTotal)}</bdi> {t("currency")}</span>
        )}
      </button>
      <button type="button" onClick={onAddToCart} className="add-to-cart-secondary" data-testid="add-to-cart">
        🛒 {t("addToCart")}
      </button>
    </div>
  );
}
