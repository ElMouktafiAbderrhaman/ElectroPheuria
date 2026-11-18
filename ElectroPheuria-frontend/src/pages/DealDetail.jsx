import { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useCart } from "../context/CartContext";
import api from "../services/api";
import { dealDiscount, formatPrice, isDealActive, isBogoDeal, isBogoFixedDeal, isComingSoon, lineTotal, offerLabel, byAvailability } from "../utils/dealPricing";
import { ComingSoonNotice, ComingSoonOverlay } from "../Components/ComingSoon";
import { trackAddToCart, trackViewContent } from "../utils/fbPixel";
import { isBundleDeal, bundleProducts, bundleItemImage, bundleItemKey, bundleCableItems, bundleChoiceId, bundleChoicesComplete, bundleCartItem, activeVariants, variantCartItem, variantStock, variantImage, variantLabel } from "../utils/variants";
import { cartLineKey } from "../context/CartContext";
import "../Components/VariantPicker.css";
import "./ProductDetail.css";
import "./DealDetail.css";

export default function DealDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { cart, addToCart } = useCart();
  const { t, i18n } = useTranslation();

  // Helper: get localized text from multi-lang object or old string
  const localized = (field) => {
    if (!field) return '';
    if (typeof field === 'object') return field[i18n.language] || field.fr || '';
    return field;
  };

  const [deal, setDeal] = useState(null);
  const [allDeals, setAllDeals] = useState([]);
  const [loadingDeal, setLoadingDeal] = useState(true);
  // Pack: cable type chosen for each pack item with variants, {choiceId: variantId}.
  const [packCables, setPackCables] = useState({});
  const [packCableError, setPackCableError] = useState(false);
  const packPickerRef = useRef(null);
  // Single deal with cable variants: the chosen cable type.
  const [selectedVariantId, setSelectedVariantId] = useState(null);
  const [variantError, setVariantError] = useState(false);
  const variantPickerRef = useRef(null);
  useEffect(() => {
    api.getDeal(id)
      .then(d => {
        setDeal(d);
        setPackCables({});
        setPackCableError(false);
        setSelectedVariantId(null);
        setVariantError(false);
        setLoadingDeal(false);
        if (d?.id) trackViewContent({ ...d, isDeal: true });
      })
      .catch(() => {
        setDeal(null);
        setLoadingDeal(false);
      });
    api.getDeals().then(setAllDeals).catch(() => {});
  }, [id]);

  const similarDeals = useMemo(() => {
    if (!deal) return [];
    const dealCategories = deal.categories || (deal.category ? [deal.category] : []);
    return allDeals
      .filter(d => {
        if (String(d.id) === id || !isDealActive(d)) return false;
        const dCats = d.categories || (d.category ? [d.category] : []);
        return dCats.some(c => dealCategories.includes(c));
      })
      .sort(byAvailability())
      .slice(0, 6);
  }, [allDeals, deal, id]);

  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isSlideAnimating, setIsSlideAnimating] = useState(false);
  const [slideDirection, setSlideDirection] = useState('next');
  const [footerVisible, setFooterVisible] = useState(false);
  const touchStartX = useRef(null);

  useEffect(() => {
    const footer = document.querySelector('footer, .footer, .site-footer');
    if (!footer) return;
    const observer = new IntersectionObserver(
      ([entry]) => setFooterVisible(entry.isIntersecting),
      { threshold: 0 }
    );
    observer.observe(footer);
    return () => observer.disconnect();
  }, []);

  const dealVariants = isBundleDeal(deal) ? [] : activeVariants(deal);
  const selectedVariant = dealVariants.find((v) => v.id === selectedVariantId) || null;

  const handleAddToCart = () => {
    if (deal && deal.stock > 0 && !isComingSoon(deal) && deal.bundle_complete !== false) {
      // A pack with a cable item can only be added once every cable type is chosen.
      if (!bundleChoicesComplete(deal, packCables)) {
        setPackCableError(true);
        packPickerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      // A deal with cable variants can only be added once a cable type is chosen.
      if (dealVariants.length > 0 && !selectedVariant) {
        setVariantError(true);
        variantPickerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      const item = selectedVariant ? variantCartItem({ ...deal, isDeal: true }, selectedVariant) : bundleCartItem(deal, packCables);
      const inCart = cart.find((c) => cartLineKey(c) === cartLineKey(item));
      const qtyBefore = inCart?.quantity || 0;
      const qtyAfter = Math.min(qtyBefore + 1, item.stock || 999);
      addToCart(item, 1);
      // Only report units that were really added (the cart caps quantity at stock).
      if (qtyAfter > qtyBefore) trackAddToCart(item, qtyAfter - qtyBefore, qtyBefore);
      navigate('/cart');
    }
  };

  const goBack = () => {
    navigate(-1);
  };

  // Chosen cable type: its image comes first. No deal images: the cable images.
  const dealImages = () => {
    const own = (deal?.images?.length ? deal.images : [deal?.image]).filter(Boolean);
    if (selectedVariant) return [variantImage(selectedVariant), ...own].filter(Boolean);
    return own.length ? own : dealVariants.map(variantImage).filter(Boolean);
  };

  const nextImage = () => {
    const images = dealImages();
    if (images.length > 0) {
      setSlideDirection('next');
      setIsSlideAnimating(true);
      const nextIndex = (currentImageIndex + 1) % images.length;
      setTimeout(() => {
        setCurrentImageIndex(nextIndex);
        setIsSlideAnimating(false);
      }, 250);
    }
  };

  const prevImage = () => {
    const images = dealImages();
    if (images.length > 0) {
      setSlideDirection('prev');
      setIsSlideAnimating(true);
      const prevIndex = currentImageIndex === 0 ? images.length - 1 : currentImageIndex - 1;
      setTimeout(() => {
        setCurrentImageIndex(prevIndex);
        setIsSlideAnimating(false);
      }, 250);
    }
  };

  const selectThumbnail = (index) => {
    setCurrentImageIndex(index);
  };

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    touchStartX.current = null;
    if (Math.abs(diff) > 50) {
      diff > 0 ? nextImage() : prevImage();
    }
  };

  const images = dealImages();

  if (loadingDeal) {
    return (
      <div className="product-detail-main">
        <div className="product-detail-loading">
          <div className="detail-spinner"></div>
          <p>Chargement du produit...</p>
        </div>
      </div>
    );
  }

  if (!deal) {
    return (
      <div className="product-detail-main">
        <div className="product-detail-empty">
          <h2>{t("dealNotFound")}</h2>
          <button onClick={goBack} className="back-btn">
            {t("goBack")}
          </button>
        </div>
      </div>
    );
  }

  const finalPrice = formatPrice(deal?.price);
  const comingSoon = isComingSoon(deal);
  const isBundle = isBundleDeal(deal);
  const packItems = bundleProducts(deal);
  const unavailable = comingSoon || deal.stock <= 0 || deal.bundle_complete === false;
  const buyLabel = comingSoon ? t("comingSoon") : deal.stock <= 0 ? t("soldOut") : t("addToCart");
  const buyClass = comingSoon ? " coming-soon-btn" : deal.stock <= 0 ? " disabled-btn" : "";

  return (
    <>
    <div className="product-detail-main">
      <div className="product-detail-container">
        <div className="product-detail-content">
          <div className="detail-images-section">
            <div className="main-image-container"
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
            >
              <img
                src={images[currentImageIndex]}
                alt={deal.name}
                className={`main-detail-image ${isSlideAnimating ? `slide-${slideDirection}` : 'slide-reset'}`}
              />
              {images.length > 1 && (
                <>
                  <button onClick={prevImage} className="prev-btn">‹</button>
                  <button onClick={nextImage} className="next-btn">›</button>
                  <div className="image-counter">
                    {currentImageIndex + 1} / {images.length}
                  </div>
                </>
              )}
            </div>

            {images.length > 1 && (
              <div className="thumbnails">
                {images.map((img, index) => (
                  <img
                    key={index}
                    src={img}
                    alt={`${deal.name} ${index + 1}`}
                    className={`thumbnail ${currentImageIndex === index ? 'active' : ''}`}
                    onClick={() => selectThumbnail(index)}
                  />
                ))}
              </div>
            )}

            {/* Specs Table */}
            {(Array.isArray(deal.specs) && deal.specs.length > 0) && (
              <div className="product-specs-section">
                <h2 className="specs-title">{t("productSpecs")}</h2>
                <table className="specs-table">
                  <tbody>
                    {deal.specs.map((row, i) => (
                      row.label && (
                        <tr key={i}>
                          <td className="spec-label">{row.label}</td>
                          <td className="spec-value">{row.value}</td>
                        </tr>
                      )
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="detail-info">
            <span className="deal-hot-badge">{isBundle ? `🎁 ${t("bundleDeal")}` : t("hotDeal")}</span>
            <h1 className="product-title">{deal.name}</h1>

            <div className="price-section-deal">
              <span className="detail-price-deal">{formatPrice(deal.price)} MAD</span>
              {isBogoDeal(deal) && <span className="bogo-unit">{t("bogoUnit")}</span>}
              {Number(deal.oldPrice) > Number(deal.price) && (
                <span className="old-price-deal">{formatPrice(deal.oldPrice)} MAD</span>
              )}
              {dealDiscount(deal) !== null && (
                <span className="discount-badge-deal">-{dealDiscount(deal)}%</span>
              )}
            </div>

            {isBundle && (
              <div className="bundle-detail-box">
                <strong className="bundle-detail-title">{t("bundleIncludes")}</strong>
                <ul className="bundle-detail-items">
                  {packItems.map((p, i) => (
                    <li key={bundleItemKey(p)} className="bundle-detail-item">
                      {i > 0 && <span className="bundle-detail-plus" aria-hidden="true">+</span>}
                      {bundleItemImage(p) ? <img src={bundleItemImage(p)} alt="" /> : <span className="bundle-detail-noimg">📦</span>}
                      <span className="bundle-detail-name"><bdi>{p.name}</bdi>{p.quantity > 1 && ` ×${p.quantity}`}</span>
                      <span className="bundle-detail-price" dir="ltr">{formatPrice(p.price * (p.quantity || 1))} MAD</span>
                    </li>
                  ))}
                </ul>
                <div className="bundle-detail-total">
                  <span>{t("bundleSeparately")}: <s dir="ltr">{formatPrice(deal.oldPrice)} MAD</s></span>
                  <span className="bundle-detail-pack">{t("bundleBoth")}: <b dir="ltr">{formatPrice(deal.price)} MAD</b></span>
                </div>
                {deal.bundle_complete === false && <p className="bundle-detail-unavailable">{t("bundleUnavailable")}</p>}
              </div>
            )}

            {!isBundle && !unavailable && dealVariants.length > 0 && (
              <div className={`variant-picker${variantError ? ' has-error' : ''}`} ref={variantPickerRef}>
                <h3 className="variant-picker-title">{t("chooseCableType")}</h3>
                <div className="variant-options" role="radiogroup" aria-label={t("cableType")}>
                  {dealVariants.map((v) => {
                    const out = variantStock(deal, v) <= 0;
                    const selected = selectedVariant?.id === v.id;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        disabled={out}
                        className={`variant-option${selected ? ' selected' : ''}${out ? ' out' : ''}`}
                        onClick={() => { if (!out) { setSelectedVariantId(v.id); setVariantError(false); setCurrentImageIndex(0); } }}
                      >
                        {variantImage(v) && <img src={variantImage(v)} alt="" className="variant-option-img" />}
                        <span className="variant-option-name" dir="ltr">{variantLabel(v)}</span>
                        {out && <span className="variant-option-out">{t("variantOutOfStock")}</span>}
                        {selected && <span className="variant-option-check" aria-hidden="true">✓</span>}
                      </button>
                    );
                  })}
                </div>
                {variantError && <p className="variant-error" role="alert">{t("chooseCableTypeError")}</p>}
              </div>
            )}

            {isBundle && !unavailable && bundleCableItems(deal).map((p) => (
              <div key={`cable-${bundleItemKey(p)}`} className={`variant-picker${packCableError && !packCables[bundleChoiceId(p)] ? ' has-error' : ''}`} ref={packPickerRef}>
                <h3 className="variant-picker-title">{t("chooseCableType")} — <bdi>{p.name}</bdi></h3>
                <div className="variant-options" role="radiogroup" aria-label={t("cableType")}>
                  {p.variants.map((v) => {
                    const out = Number(v.stock) <= 0;
                    const selected = String(packCables[bundleChoiceId(p)]) === String(v.id);
                    return (
                      <button
                        key={v.id}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        disabled={out}
                        className={`variant-option${selected ? ' selected' : ''}${out ? ' out' : ''}`}
                        onClick={() => { if (!out) { setPackCables((prev) => ({ ...prev, [bundleChoiceId(p)]: v.id })); setPackCableError(false); } }}
                      >
                        {variantImage(v) && <img src={variantImage(v)} alt="" className="variant-option-img" />}
                        <span className="variant-option-name" dir="ltr">{variantLabel(v)}</span>
                        {out && <span className="variant-option-out">{t("variantOutOfStock")}</span>}
                        {selected && <span className="variant-option-check" aria-hidden="true">✓</span>}
                      </button>
                    );
                  })}
                </div>
                {packCableError && !packCables[bundleChoiceId(p)] && <p className="variant-error" role="alert">{t("chooseCableTypeError")}</p>}
              </div>
            ))}

            {isBogoDeal(deal) && (
              <div className="bogo-detail-box">
                <strong className="bogo-detail-title">🎁 {offerLabel(deal, t)}</strong>
                <p>{isBogoFixedDeal(deal) ? t("bogoFixedExplain", { price: formatPrice(deal.second_item_price) }) : t("bogoExplain")}</p>
                <div className="bogo-detail-examples">
                  {[2, 4].map((q) => (
                    <span key={q}>
                      {q} × {formatPrice(deal.price)} = <s>{formatPrice(lineTotal({ ...deal, quantity: q }).subtotal)}</s>{" "}
                      <b>{formatPrice(lineTotal({ ...deal, quantity: q }).total)} MAD</b>
                    </span>
                  ))}
                </div>
              </div>
            )}

              {deal.category && (
                <div className="stock-info">
                  <span className="category-badge">{deal.category}</span>
                </div>
              )}

              {comingSoon && <ComingSoonNotice />}

              {!comingSoon && (deal.stock <= 0 || deal.bundle_complete === false) && (
                <div className="stock-info">
                  <span className="sold-out-detail-badge">{t("soldOut")}</span>
                </div>
              )}

<div className="description-section">
                <h3>{t("description")}</h3>
                <p className="detail-description">{localized(deal.description) || t("noDescription")}</p>
              </div>

            <div className="add-to-cart-row">
              <button onClick={handleAddToCart} className={`detail-add-to-cart${buyClass}`} disabled={unavailable}>
                {buyLabel}
              </button>
              <button onClick={goBack} className="detail-back-button">
                {t("backToProducts")}
              </button>
            </div>

            <div className="reviews-section">
              <h3>{t("reviews")}</h3>
              {localized(deal.reviews) ? (
                <div className="reviews-content deal-reviews">
                  <p className="detail-reviews">{localized(deal.reviews)}</p>
                </div>
              ) : (
                <div className="reviews-content add-review-placeholder">
                  {t("noReviewsDeal")}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Gallery Info Images */}
        {Array.isArray(deal.gallery) && deal.gallery.length > 0 && (
          <div className="scrolling-gallery-section">
            <h2 className="gallery-section-title">{t("productGallery")}</h2>
            <div className="scrolling-gallery">
              {deal.gallery.map((gItem, index) => (
                gItem.image && (
                  <div key={index} className="gallery-block">
                    <div className="gallery-image-wrapper">
                      <img
                        src={gItem.image}
                        alt={`${deal.name} - ${index + 1}`}
                        className="gallery-full-image"
                      />
                      <span className="gallery-image-number">{index + 1} / {deal.gallery.length}</span>
                    </div>
                    {(typeof gItem.text === 'object' ? localized(gItem.text) : gItem.text) && (
                      <div className="gallery-paragraph">
                        <p>{typeof gItem.text === 'object' ? localized(gItem.text) : gItem.text}</p>
                      </div>
                    )}
                  </div>
                )
              ))}
            </div>
          </div>
        )}

        {/* Similar Deals */}
        {similarDeals.length > 0 && (
          <div className="similar-products-section">
            <h2 className="similar-title">{t("similarProducts")}</h2>
            <p className="similar-subtitle">{t("similarSubtitle")}</p>
            <div className="similar-products-grid">
              {similarDeals.map((item) => (
                <div
                  key={item.id}
                  className={`similar-product-card${isComingSoon(item) ? ' coming-soon-card' : item.stock <= 0 ? ' sold-out-card' : ''}`}
                  onClick={() => {
                    navigate(`/deal/${item.id}`);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                >
                  <div className="similar-product-image">
                    {item.images?.[0] || item.image ? (
                      <img src={item.images?.[0] || item.image} alt={item.name} />
                    ) : (
                      <div className="image-placeholder">📦</div>
                    )}
                    {isComingSoon(item) ? <ComingSoonOverlay compact /> : item.stock <= 0 && (
                      <div className="sold-out-overlay">
                        <span className="sold-out-badge">{t("soldOut")}</span>
                      </div>
                    )}
                  </div>
                  <div className="similar-product-info">
                    <h4>{item.name}</h4>
                    <div className="similar-deal-prices">
                      <span className="similar-product-price">{formatPrice(item.price)} MAD</span>
                      {Number(item.oldPrice) > Number(item.price) && <span className="similar-old-price">{formatPrice(item.oldPrice)} MAD</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>

      {createPortal(
        <div className={`sticky-bottom-bar ${footerVisible ? 'hidden' : ''}`}>
          <button onClick={goBack} className="sticky-back-btn" aria-label={t("backToProducts")}>
            ←
          </button>
          <span className="sticky-price" dir="ltr">{finalPrice} MAD</span>
          <button onClick={handleAddToCart} className={`sticky-add-to-cart${buyClass}`} disabled={unavailable}>
            {buyLabel}
          </button>
        </div>,
        document.body
      )}
    </>
  );
}
