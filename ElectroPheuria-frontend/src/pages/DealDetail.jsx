import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useCart } from "../context/CartContext";
import api from "../services/api";
import { dealDiscount, formatPrice, isDealActive, isBogoDeal, isBogoFixedDeal, isComingSoon, lineTotal, offerLabel, byAvailability } from "../utils/dealPricing";
import { ComingSoonNotice, ComingSoonOverlay } from "../Components/ComingSoon";
import { trackAddToCart, trackViewContent } from "../utils/fbPixel";
import { isBundleDeal, bundleProducts, bundleItemImage, bundleItemKey, bundleCableItems, bundleChoiceId, bundleChoicesComplete, bundleCartItem, activeVariants, variantCartItem, variantImage, variantLabel } from "../utils/variants";
import { cartLineKey } from "../context/CartContext";
import "../Components/VariantPicker.css";
import BuyBox from "../Components/BuyBox";
import CartToast from "../Components/CartToast";
import ProductInfoSections from "../Components/ProductInfoSections";
import useStickyBuyBar from "../utils/useStickyBuyBar";
import { buyNowUrl } from "../utils/buyNow";
import { clampQuantity, parseQuantity } from "../utils/quantity";
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
  // Ad links can preselect a quantity: /deal/3?qty=2
  const [searchParams] = useSearchParams();
  const [quantity, setQuantity] = useState(() => parseQuantity(searchParams.get("qty")) || 1);
  useEffect(() => {
    // A late answer for a previous deal must not replace the current one or reset the
    // customer's cable choices.
    let stale = false;
    api.getDeal(id)
      .then(d => {
        if (stale) return;
        setDeal(d);
        setPackCables({});
        setPackCableError(false);
        setSelectedVariantId(null);
        setVariantError(false);
        setLoadingDeal(false);
        if (d?.id) trackViewContent({ ...d, isDeal: true });
      })
      .catch(() => {
        if (stale) return;
        setDeal(null);
        setLoadingDeal(false);
      });
    api.getDeals().then(setAllDeals).catch(() => {});
    return () => { stale = true; };
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
  const touchStartX = useRef(null);
  const { purchaseRef, showSticky } = useStickyBuyBar();
  const [toast, setToast] = useState(null);
  const closeToast = useCallback(() => setToast(null), []);

  const dealVariants = isBundleDeal(deal) ? [] : activeVariants(deal);
  const selectedVariant = dealVariants.find((v) => v.id === selectedVariantId) || null;

  // The line being bought (chosen cable / pack cables), or the deal itself while a choice is missing.
  const currentItem = !deal
    ? null
    : selectedVariant
      ? variantCartItem({ ...deal, isDeal: true }, selectedVariant)
      : bundleCartItem(deal, packCables);

  /** The item ready to buy, or null after pointing the customer to the missing choice. */
  const readyItem = () => {
    if (!deal || isComingSoon(deal) || deal.bundle_complete === false) return null;
    // A pack with a cable item can only be bought once every cable type is chosen.
    if (!bundleChoicesComplete(deal, packCables)) {
      setPackCableError(true);
      packPickerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return null;
    }
    // A deal with cable variants can only be bought once a cable type is chosen.
    if (dealVariants.length > 0 && !selectedVariant) {
      setVariantError(true);
      variantPickerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return null;
    }
    return currentItem;
  };

  // Main action: straight to checkout with this deal and quantity (the cart is left as it is).
  const handlePurchaseNow = () => {
    const item = readyItem();
    if (!item) return;
    const qty = clampQuantity(quantity);
    trackAddToCart(item, qty, 0);
    navigate(buyNowUrl(item, qty));
  };

  // Secondary action: keep it in the cart to order several items together.
  const handleAddToCart = () => {
    const item = readyItem();
    if (!item) return;
    const inCart = cart.find((c) => cartLineKey(c) === cartLineKey(item));
    const qtyBefore = inCart?.quantity || 0;
    const qtyAfter = qtyBefore + quantity;
    addToCart(item, quantity);
    if (qtyAfter > qtyBefore) trackAddToCart(item, qtyAfter - qtyBefore, qtyBefore);
    // Stay on the page: a small confirmation, the cart is one tap away.
    setToast((prev) => ({ id: (prev?.id || 0) + 1, name: item.variant_label ? `${item.name} (${item.variant_label})` : item.name, quantity: qtyAfter - qtyBefore || quantity }));
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
  // Only "coming soon" or a pack missing one of its items stops a purchase: stock never does.
  const unavailable = comingSoon || deal.bundle_complete === false;
  const buyLabel = comingSoon ? t("comingSoon") : deal.bundle_complete === false ? t("soldOut") : t("purchaseNow");
  const qtyTotal = currentItem ? lineTotal({ ...currentItem, quantity }).total : null;
  const buyClass = comingSoon ? " coming-soon-btn" : deal.bundle_complete === false ? " disabled-btn" : "";

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
            {Number(deal.oldPrice) > Number(deal.price) && (
              <p className="you-save-line">{t("youSaveAmount", { amount: formatPrice(Number(deal.oldPrice) - Number(deal.price)) })}</p>
            )}

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
                <h3 className="variant-picker-title">
                  {t("chooseCableType")}
                  {selectedVariant && <span className="variant-picker-selected"> · {t("selectedOption")}: <bdi>{variantLabel(selectedVariant)}</bdi></span>}
                </h3>
                <div className="variant-options" role="radiogroup" aria-label={t("cableType")}>
                  {dealVariants.map((v) => {
                    const selected = selectedVariant?.id === v.id;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        className={`variant-option${selected ? ' selected' : ''}`}
                        onClick={() => { setSelectedVariantId(v.id); setVariantError(false); setCurrentImageIndex(0); }}
                      >
                        {variantImage(v) && <img src={variantImage(v)} alt="" className="variant-option-img" />}
                        <span className="variant-option-name" dir="ltr">{variantLabel(v)}</span>
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
                    const selected = String(packCables[bundleChoiceId(p)]) === String(v.id);
                    return (
                      <button
                        key={v.id}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        className={`variant-option${selected ? ' selected' : ''}`}
                        onClick={() => { setPackCables((prev) => ({ ...prev, [bundleChoiceId(p)]: v.id })); setPackCableError(false); }}
                      >
                        {variantImage(v) && <img src={variantImage(v)} alt="" className="variant-option-img" />}
                        <span className="variant-option-name" dir="ltr">{variantLabel(v)}</span>
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
                  {[2, 3].map((q) => (
                    <span key={q}>
                      {q} × {formatPrice(deal.price)} = <s>{formatPrice(lineTotal({ ...deal, quantity: q }).subtotal)}</s>{" "}
                      <b>{formatPrice(lineTotal({ ...deal, quantity: q }).total)} MAD</b>
                    </span>
                  ))}
                </div>
              </div>
            )}

              {comingSoon && <ComingSoonNotice />}

              {!comingSoon && deal.bundle_complete === false && (
                <div className="stock-info">
                  <span className="sold-out-detail-badge">{t("soldOut")}</span>
                </div>
              )}

            {unavailable ? (
              <div className="add-to-cart-row">
                <button className={`detail-add-to-cart${buyClass}`} disabled>
                  {buyLabel}
                </button>
              </div>
            ) : (
              <BuyBox
                quantity={quantity}
                setQuantity={setQuantity}
                qtyTotal={qtyTotal}
                label={buyLabel}
                onPurchase={handlePurchaseNow}
                onAddToCart={handleAddToCart}
                purchaseRef={purchaseRef}
              />
            )}

            <p className="buy-reassure">🚚 {t("deliveryShort")} · 💵 {t("codShort")}</p>

          </div>
        </div>

        <ProductInfoSections item={deal} noReviewsKey="noReviewsDeal" />

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
                  className={`similar-product-card${isComingSoon(item) ? ' coming-soon-card' : ''}`}
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
                    {isComingSoon(item) && <ComingSoonOverlay compact />}
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
        <div className={`sticky-bottom-bar ${showSticky ? '' : 'hidden'}`}>
          <span className="sticky-price" dir="ltr">
            {qtyTotal !== null ? formatPrice(qtyTotal) : finalPrice} MAD
            {quantity > 1 && !unavailable && <small className="sticky-qty">×{quantity}</small>}
          </span>
          <button onClick={handlePurchaseNow} className={`sticky-add-to-cart${buyClass}`} disabled={unavailable}>
            {buyLabel}
          </button>
        </div>,
        document.body
      )}
      <CartToast toast={toast} onClose={closeToast} />
    </>
  );
}
