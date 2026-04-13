import { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useCart } from "../context/CartContext";
import "./ProductDetail.css";

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { t, i18n } = useTranslation();

  // Helper: get localized text from multi-lang object or old string
  const localized = (field) => {
    if (!field) return '';
    if (typeof field === 'object') return field[i18n.language] || field.fr || '';
    return field;
  };

  const [allProducts] = useState(() => {
    const saved = localStorage.getItem("ElectroPheuria_products");
    return saved ? JSON.parse(saved) : [];
  });
  
  const product = useMemo(() => {
    return allProducts.find(p => String(p.id) === id) || null;
  }, [allProducts, id]);

  const similarProducts = useMemo(() => {
    if (!product) return [];
    return allProducts
      .filter(p => p.category === product.category && String(p.id) !== id)
      .slice(0, 6);
  }, [allProducts, product, id]);

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

  const handleAddToCart = () => {
    if (product && product.stock > 0) {
      addToCart(product);
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

  const images = product?.images || [product?.image].filter(Boolean) || [];

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

  const finalPrice = product.new_price || product.price;

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
              <span className="detail-price">{product.price} MAD</span>
            </div>

            <div className="stock-info">
              {product.stock <= 0 && (
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
                className={`detail-add-to-cart${product.stock <= 0 ? ' disabled-btn' : ''}`}
                disabled={product.stock <= 0}
              >
                {product.stock <= 0 ? t("soldOut") : t("addToCart")}
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
                  className={`similar-product-card${item.stock <= 0 ? ' sold-out-card' : ''}`}
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
                    {item.stock <= 0 && (
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
          <span className="sticky-price">{finalPrice} MAD</span>
          <button onClick={handleAddToCart} className={`sticky-add-to-cart${product.stock <= 0 ? ' disabled-btn' : ''}`} disabled={product.stock <= 0}>
            {product.stock <= 0 ? t("soldOut") : t("addToCart")}
          </button>
        </div>,
        document.body
      )}
    </>
  );
}
