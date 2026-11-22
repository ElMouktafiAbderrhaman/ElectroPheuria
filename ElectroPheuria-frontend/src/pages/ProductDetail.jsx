import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useCart, cartLineKey } from "../context/CartContext";
import api from "../services/api";
import { trackAddToCart, trackViewContent } from "../utils/fbPixel";
import { isComingSoon, isProductActive, formatPrice, byAvailability, lineTotal } from "../utils/dealPricing";
import { activeVariants, variantPrice, variantImage, variantLabel, variantCartItem, variantPriceRange } from "../utils/variants";
import { ComingSoonNotice, ComingSoonOverlay } from "../Components/ComingSoon";
import { buyNowUrl } from "../utils/buyNow";
import { clampQuantity, parseQuantity } from "../utils/quantity";
import "./ProductDetail.css";
import "../Components/VariantPicker.css";
import BuyBox from "../Components/BuyBox";
import CartToast from "../Components/CartToast";
import ProductInfoSections from "../Components/ProductInfoSections";
import useStickyBuyBar from "../utils/useStickyBuyBar";

export default function ProductDetail() {
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

  const [product, setProduct] = useState(null);
  const [allProducts, setAllProducts] = useState([]);
  const [loadingProduct, setLoadingProduct] = useState(true);
  const [searchParams] = useSearchParams();
  const [selectedVariantId, setSelectedVariantId] = useState(null);
  const [variantError, setVariantError] = useState(false);
  const variantPickerRef = useRef(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  // Ad links can preselect a quantity: /product/12?qty=2
  const [quantity, setQuantity] = useState(() => parseQuantity(searchParams.get("qty")) || 1);

  useEffect(() => {
    // A late answer for a previous product must not replace the current one or reset the
    // customer's cable choice.
    let stale = false;
    api.getProduct(id)
      .then(p => {
        if (stale) return;
        setProduct(p);
        // Pre-select the cable type picked on the product card (?variant=usb_c), if available.
        const wanted = searchParams.get("variant");
        const pre = activeVariants(p).find((v) => v.type === wanted);
        setSelectedVariantId(pre ? pre.id : null);
        setVariantError(false);
        setCurrentImageIndex(0);
        setLoadingProduct(false);
        if (p?.id) trackViewContent(p);
      })
      .catch(() => {
        if (stale) return;
        setProduct(null);
        setLoadingProduct(false);
      });
    api.getProducts().then(setAllProducts).catch(() => {});
    return () => { stale = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const similarProducts = useMemo(() => {
    if (!product) return [];
    return allProducts
      .filter(p => isProductActive(p) && p.category === product.category && String(p.id) !== id)
      .sort(byAvailability())
      .slice(0, 6);
  }, [allProducts, product, id]);

  const [isSlideAnimating, setIsSlideAnimating] = useState(false);
  const [slideDirection, setSlideDirection] = useState('next');
  const touchStartX = useRef(null);
  const { purchaseRef, showSticky } = useStickyBuyBar();
  const [toast, setToast] = useState(null);
  const closeToast = useCallback(() => setToast(null), []);

  const variants = activeVariants(product);
  const selectedVariant = variants.find((v) => v.id === selectedVariantId) || null;

  // The line being bought: the chosen cable type, or the product itself (null until a cable is chosen).
  const currentItem = !product ? null : selectedVariant ? variantCartItem(product, selectedVariant) : variants.length ? null : product;

  const selectVariant = (variant) => {
    setSelectedVariantId(variant.id);
    setVariantError(false);
    setCurrentImageIndex(0); // the chosen cable's image is shown first
  };

  /** The item ready to buy, or null after pointing the customer to the missing choice. */
  const readyItem = () => {
    if (!product || isComingSoon(product)) return null;
    // A cable with variants can only be bought once a cable type is chosen.
    if (variants.length > 0 && !selectedVariant) {
      setVariantError(true);
      variantPickerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return null;
    }
    return currentItem;
  };

  // Main action: straight to checkout with this item and quantity (the cart is left as it is).
  const handlePurchaseNow = () => {
    const item = readyItem();
    if (!item) return;
    const qty = clampQuantity(quantity);
    trackAddToCart(item, qty, 0);
    navigate(buyNowUrl(item, qty));
  };

  // Secondary action: add to the cart and stay on the page (to keep shopping).
  const handleAddToCart = () => {
    const item = readyItem();
    if (!item) return;
    const inCart = cart.find((c) => cartLineKey(c) === cartLineKey(item));
    const qtyBefore = inCart?.quantity || 0;
    const qtyAfter = qtyBefore + quantity;
    addToCart(item, quantity);
    if (qtyAfter > qtyBefore) trackAddToCart(item, qtyAfter - qtyBefore, qtyBefore);
    setToast((prev) => ({ id: (prev?.id || 0) + 1, name: item.variant_label ? `${item.name} (${item.variant_label})` : item.name, quantity: qtyAfter - qtyBefore || quantity }));
  };

  const goBack = () => {
    navigate(-1);
  };

  const nextImage = () => {
    if (images.length > 1) {
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
    if (images.length > 1) {
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

  const productImages = (product?.images?.length ? product.images : [product?.image]).filter(Boolean);
  // Chosen cable type: its image comes first. No choice yet: product images, else the variant images.
  const images = selectedVariant
    ? [variantImage(selectedVariant), ...productImages].filter(Boolean)
    : productImages.length ? productImages : variants.map(variantImage).filter(Boolean);

  if (loadingProduct) {
    return (
      <div className="product-detail-main">
        <div className="product-detail-loading">
          <div className="detail-spinner"></div>
          <p>Chargement du produit...</p>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="product-detail-main">
        <div className="product-detail-empty">
          <h2>{t("productNotFound")}</h2>
          <button onClick={goBack} className="back-btn">
            {t("goBack")}
          </button>
        </div>
      </div>
    );
  }

  const range = variantPriceRange(product);
  const finalPrice = selectedVariant
    ? formatPrice(variantPrice(product, selectedVariant))
    : range && range.min !== range.max
      ? `${formatPrice(range.min)} – ${formatPrice(range.max)}`
      : range ? formatPrice(range.min) : (product.new_price || product.price);
  const comingSoon = isComingSoon(product);
  // Only "coming soon" stops a purchase: stock never does.
  const unavailable = comingSoon;
  const buyLabel = comingSoon ? t("comingSoon") : t("purchaseNow");
  const qtyTotal = currentItem ? lineTotal({ ...currentItem, quantity }).total : null;
  const buyClass = comingSoon ? " coming-soon-btn" : "";

  return (
    <>
      <div className="product-detail-main">
        <div className="product-detail-container">
        <div className="product-detail-content">
          {/* Images Section */}
          <div className="detail-images-section">
            <div className="main-image-container"
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
            >
              <img 
                src={images[currentImageIndex]} 
                alt={product.name}
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
                    alt={`${product.name} thumbnail ${index + 1}`}
                    className={`thumbnail ${currentImageIndex === index ? 'active' : ''}`}
                    onClick={() => selectThumbnail(index)}
                  />
                ))}
              </div>
            )}

          </div>

          {/* Info Section */}
          <div className="detail-info">
            <span className="category-badge-top">
              {product.category}
            </span>
            <h1 className="product-title">{product.name}</h1>
            
            <div className="price-section">
              <span className="detail-price" dir="ltr">{finalPrice} MAD</span>
            </div>

            {variants.length > 0 && !comingSoon && (
              <div className={`variant-picker${variantError ? ' has-error' : ''}`} ref={variantPickerRef}>
                <h3 className="variant-picker-title">
                  {t("chooseCableType")}
                  {selectedVariant && <span className="variant-picker-selected"> · {t("selectedOption")}: <bdi>{variantLabel(selectedVariant)}</bdi></span>}
                </h3>
                <div className="variant-options" role="radiogroup" aria-label={t("cableType")}>
                  {variants.map((v) => {
                    const selected = selectedVariant?.id === v.id;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        className={`variant-option${selected ? ' selected' : ''}`}
                        onClick={() => selectVariant(v)}
                      >
                        {variantImage(v) && <img src={variantImage(v)} alt="" className="variant-option-img" />}
                        <span className="variant-option-name" dir="ltr">{variantLabel(v)}</span>
                        <span className="variant-option-price" dir="ltr">{formatPrice(variantPrice(product, v))} MAD</span>
                        {selected && <span className="variant-option-check" aria-hidden="true">✓</span>}
                      </button>
                    );
                  })}
                </div>
                {variantError && <p className="variant-error" role="alert">{t("chooseCableTypeError")}</p>}
              </div>
            )}

            {comingSoon && <ComingSoonNotice />}


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

        <ProductInfoSections item={product} />

        {/* Scrolling Gallery Info Images */}
        {Array.isArray(product.gallery) && product.gallery.length > 0 && (
          <div className="scrolling-gallery-section">
            <h2 className="gallery-section-title">{t("productGallery")}</h2>
            <div className="scrolling-gallery">
              {product.gallery.map((gItem, index) => (
                gItem.image && (
                  <div key={index} className="gallery-block">
                    <div className="gallery-image-wrapper">
                      <img 
                        src={gItem.image} 
                        alt={`${product.name} - ${index + 1}`} 
                        className="gallery-full-image"
                      />
                      <span className="gallery-image-number">{index + 1} / {product.gallery.length}</span>
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

        {/* Similar Products Section */}
        {similarProducts.length > 0 && (
          <div className="similar-products-section">
            <h2 className="similar-title">{t("similarProducts")}</h2>
            <p className="similar-subtitle">{t("similarSubtitle")}</p>
            <div className="similar-products-grid">
              {similarProducts.map((item) => (
                <div 
                  key={item.id} 
                  className={`similar-product-card${isComingSoon(item) ? ' coming-soon-card' : ''}`}
                  onClick={() => {
                    navigate(`/product/${item.id}`);
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
                    <span className="similar-product-price">{item.price} MAD</span>
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
