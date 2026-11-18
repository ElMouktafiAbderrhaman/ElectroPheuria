// One promotional card for a two-product bundle deal ("Pack Promotion"):
// both product images and names, combined price vs. pack price. Like the other deal cards
// there is no button: the whole card opens the pack page (cable choice + Add to Cart there).
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { dealDiscount, formatPrice, isComingSoon } from "../utils/dealPricing";
import { bundleProducts, bundleItemImage, bundleItemKey } from "../utils/variants";
import { ComingSoonOverlay } from "./ComingSoon";
import "./BundleDealCard.css";

export default function BundleDealCard({ deal }) {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const products = bundleProducts(deal);
  const comingSoon = isComingSoon(deal);
  const soldOut = !comingSoon && (deal.bundle_complete === false || Number(deal.stock) <= 0);
  const discount = dealDiscount(deal);
  const oldPrice = Number(deal.oldPrice);
  const price = Number(deal.price);
  return (
    <div
      className={`product-card golden-card bundle-card${comingSoon ? " coming-soon-card" : soldOut ? " sold-out-card" : ""}`}
      onClick={() => navigate(`/deal/${deal.id}`)}
      style={{ cursor: "pointer" }}
    >
      <div className="product-image bundle-images">
        {products.slice(0, 2).map((p, i) => (
          <div key={bundleItemKey(p)} className="bundle-image-slot">
            {bundleItemImage(p) ? <img src={bundleItemImage(p)} alt={p.name} /> : <div className="image-placeholder">📦</div>}
            {i === 0 && products.length > 1 && <span className="bundle-plus" aria-hidden="true">+</span>}
          </div>
        ))}
        {products.length === 0 && (deal.images?.[0] ? <img src={deal.images[0]} alt={deal.name} /> : <div className="image-placeholder">🎁</div>)}
        <span className="promo-sticker bundle-sticker">🎁 {t("bundleDeal")}</span>
        {discount !== null && <span className="deal-discount-corner">-{discount}%</span>}
        {comingSoon ? <ComingSoonOverlay /> : soldOut && (
          <div className="sold-out-overlay">
            <span className="sold-out-badge">{t("soldOut")}</span>
          </div>
        )}
      </div>

      <div className="product-info">
        <h4>{deal.name}</h4>
        {/* The default pack name already lists both products: don't repeat them. */}
        {products.length > 0 && deal.name !== products.map((p) => p.name).join(" + ") && (
          <p className="bundle-names">
            {products.map((p, i) => (
              <span key={bundleItemKey(p)}>{i > 0 && <b className="bundle-names-plus"> + </b>}<bdi>{p.name}</bdi></span>
            ))}
          </p>
        )}
        <span className="bundle-both">{t("bundleBoth")}</span>
        <div className="deal-bottom">
          {oldPrice > price ? (
            <span className="deal-save">{t("youSave")} {formatPrice(oldPrice - price)} MAD</span>
          ) : <span />}
          <div className="deal-prices-stacked">
            {oldPrice > price && <span className="old-price">{formatPrice(oldPrice)} MAD</span>}
            <span className="new-price">{formatPrice(price)} MAD</span>
          </div>
        </div>
      </div>
      <span className="click-details-tag">{t("clickDetails")}</span>
    </div>
  );
}
