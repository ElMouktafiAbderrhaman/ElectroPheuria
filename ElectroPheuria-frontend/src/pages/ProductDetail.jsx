import { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useCart, cartLineKey } from "../context/CartContext";
import api from "../services/api";
import { trackAddToCart, trackViewContent } from "../utils/fbPixel";
import { isComingSoon, isProductActive, formatPrice, byAvailability } from "../utils/dealPricing";
import { activeVariants, variantPrice, variantStock, variantImage, variantLabel, variantCartItem, productSoldOut, variantPriceRange } from "../utils/variants";
import { ComingSoonNotice, ComingSoonOverlay } from "../Components/ComingSoon";
import "./ProductDetail.css";
import "../Components/VariantPicker.css";

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

  useEffect(() => {
    api.getProduct(id)
      .then(p => {
        setProduct(p);
        // Pre-select the cable type picked on the product card (?variant=usb_c), if available.
        const wanted = searchParams.get("variant");
        const pre = activeVariants(p).find((v) => v.type === wanted && variantStock(p, v) > 0);
        setSelectedVariantId(pre ? pre.id : null);
        setVariantError(false);
        setCurrentImageIndex(0);
        setLoadingProduct(false);
        if (p?.id) trackViewContent(p);
      })
      .catch(() => {
        setProduct(null);
        setLoadingProduct(false);
      });
    api.getProducts().then(setAllProducts).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const similarProducts = useMemo(() => {
    if (!product) return [];
    return allProducts
      .filter(p => isProductActive(p) && p.category === product.category && String(p.id) !== id)
      .sort(byAvailability(productSoldOut))
      .slice(0, 6);
  }, [allProducts, product, id]);

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

  const variants = activeVariants(product);
  const selectedVariant = variants.find((v) => v.id === selectedVariantId) || null;

  const selectVariant = (variant) => {
    if (variantStock(product, variant) <= 0) return;
    setSelectedVariantId(variant.id);
    setVariantError(false);
    setCurrentImageIndex(0); // the chosen cable's image is shown first
  };

  const handleAddToCart = () => {
    if (!product || isComingSoon(product)) return;
    // A cable with variants can only be added once a cable type is chosen.
    if (variants.length > 0 && !selectedVariant) {
      setVariantError(true);
      variantPickerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    const item = selectedVariant ? variantCartItem(product, selectedVariant) : product;
    if (item.stock > 0) {
      const inCart = cart.find((c) => cartLineKey(c) === cartLineKey(item));
      const qtyBefore = inCart?.quantity || 0;
      const qtyAfter = Math.min(qtyBefore + 1, item.stock || 999);
      addToCart(item);
      if (qtyAfter > qtyBefore) trackAddToCart(item, qtyAfter - qtyBefore, qtyBefore);
      navigate('/cart');
    }
  };

  const goBack = () => {
    navigate(-1);
  };

  const nextImage = () => {
    if (product && product.images && product.images.length > 0) {
      setSlideDirection('next');
      setIsSlideAnimating(true);
      const nextIndex = (currentImageIndex + 1) % product.images.length;

      setTimeout(() => {
        setCurrentImageIndex(nextIndex);
        setIsSlideAnimating(false);
      }, 250);
    }
  };

  const prevImage = () => {
    if (product && product.images && product.images.length > 0) {
      setSlideDirection('prev');
      setIsSlideAnimating(true);
      const prevIndex = currentImageIndex === 0 ? product.images.length - 1 : currentImageIndex - 1;

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
  const soldOut = selectedVariant ? variantStock(product, selectedVariant) <= 0 : productSoldOut(product);
  const unavailable = comingSoon || soldOut;
  const buyLabel = comingSoon ? t("comingSoon") : soldOut ? t("soldOut") : t("addToCart");
  const buyClass = comingSoon ? " coming-soon-btn" : soldOut ? " disabled-btn" : "";

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

            {/* Product Specifications Table */}
            {(Array.isArray(product.specs) && product.specs.length > 0) && (
              <div className="product-specs-section">
                <h2 className="specs-title">{t("productSpecs")}</h2>
                <table className="specs-table">
                  <tbody>
                    {product.specs.map((row, i) => (
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
                <h3 className="variant-picker-title">{t("chooseCableType")}</h3>
                <div className="variant-options" role="radiogroup" aria-label={t("cableType")}>
                  {variants.map((v) => {
                    const out = variantStock(product, v) <= 0;
                    const selected = selectedVariant?.id === v.id;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        disabled={out}
                        className={`variant-option${selected ? ' selected' : ''}${out ? ' out' : ''}`}
                        onClick={() => selectVariant(v)}
                      >
                        {variantImage(v) && <img src={variantImage(v)} alt="" className="variant-option-img" />}
                        <span className="variant-option-name" dir="ltr">{variantLabel(v)}</span>
                        <span className="variant-option-price" dir="ltr">{formatPrice(variantPrice(product, v))} MAD</span>
                        {out && <span className="variant-option-out">{t("variantOutOfStock")}</span>}
                        {selected && <span className="variant-option-check" aria-hidden="true">✓</span>}
                      </button>
                    );
                  })}
                </div>
                {variantError && <p className="variant-error" role="alert">{t("chooseCableTypeError")}</p>}
              </div>
            )}

            {comingSoon && <ComingSoonNotice />}

            <div className="stock-info">
              {!comingSoon && soldOut && (
                <span className="sold-out-detail-badge">{t("soldOut")}</span>
              )}
            </div>

            {localized(product.description) && (
              <div className="description-section">
                <h3>{t("description")}</h3>
                <p className="detail-description">{localized(product.description)}</p>
              </div>
            )}

            <div className="add-to-cart-row">
              <button 
                onClick={handleAddToCart}
                className={`detail-add-to-cart${buyClass}`}
                disabled={unavailable}
              >
                {buyLabel}
              </button>
              <button onClick={goBack} className="detail-back-button">
                {t("backToProducts")}
              </button>
            </div>

            <div className="reviews-section">
              <h3>{t("reviews")}</h3>
              {localized(product.reviews) ? (
                <div className="reviews-content">
                  <p className="detail-reviews">{localized(product.reviews)}</p>
                </div>
              ) : (
                <div className="reviews-content add-review-placeholder">
                  {t("noReviews")}
                </div>
              )}
            </div>
          </div>
        </div>

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
                  className={`similar-product-card${isComingSoon(item) ? ' coming-soon-card' : productSoldOut(item) ? ' sold-out-card' : ''}`}
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
                    {isComingSoon(item) ? <ComingSoonOverlay compact /> : productSoldOut(item) && (
                      <div className="sold-out-overlay">
                        <span className="sold-out-badge">{t("soldOut")}</span>
                      </div>
                    )}
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
