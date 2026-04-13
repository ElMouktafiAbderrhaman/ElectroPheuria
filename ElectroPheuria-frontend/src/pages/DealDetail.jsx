import { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useCart } from "../context/CartContext";
import "./ProductDetail.css";
import "./DealDetail.css";

export default function DealDetail() {
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
  
  const [deal] = useState(() => {
    const saved = localStorage.getItem("ElectroPheuria_deals");
    if (saved) {
      const deals = JSON.parse(saved);
      return deals.find(d => String(d.id) === id);
    }
    return null;
  });

  const allDeals = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("ElectroPheuria_deals") || "[]");
    } catch { return []; }
  }, []);

  const similarDeals = useMemo(() => {
    if (!deal) return [];
    const dealCategories = deal.categories || (deal.category ? [deal.category] : []);
    return allDeals
      .filter(d => {
        if (String(d.id) === id) return false;
        const dCats = d.categories || (d.category ? [d.category] : []);
        return dCats.some(c => dealCategories.includes(c));
      })
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

  const handleAddToCart = () => {
    if (deal && deal.stock > 0) {
      addToCart(deal, 1);
      navigate('/cart');
    }
  };

  const goBack = () => {
    navigate(-1);
  };

  const nextImage = () => {
    const images = deal?.images || [deal?.image].filter(Boolean) || [];
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
    const images = deal?.images || [deal?.image].filter(Boolean) || [];
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

  const images = deal?.images || [deal?.image].filter(Boolean) || [];

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

  const finalPrice = deal?.price;

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
            <span className="deal-hot-badge">{t("hotDeal")}</span>
            <h1 className="product-title">{deal.name}</h1>
            
            <div className="price-section-deal">
              <span className="detail-price-deal">{deal.price} MAD</span>
              <span className="old-price-deal">{deal.oldPrice} MAD</span>
              <span className="discount-badge-deal">-{deal.discount}%</span>
            </div>

              {deal.category && (
                <div className="stock-info">
                  <span className="category-badge">{deal.category}</span>
                </div>
              )}

              {deal.stock <= 0 && (
                <div className="stock-info">
                  <span className="sold-out-detail-badge">{t("soldOut")}</span>
                </div>
              )}

<div className="description-section">
                <h3>{t("description")}</h3>
                <p className="detail-description">{localized(deal.description) || t("noDescription")}</p>
              </div>

            <div className="add-to-cart-row">
              <button onClick={handleAddToCart} className={`detail-add-to-cart${deal.stock <= 0 ? ' disabled-btn' : ''}`} disabled={deal.stock <= 0}>
                {deal.stock <= 0 ? t("soldOut") : t("addToCart")}
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
                  className={`similar-product-card${item.stock <= 0 ? ' sold-out-card' : ''}`}
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
                    {item.stock <= 0 && (
                      <div className="sold-out-overlay">
                        <span className="sold-out-badge">{t("soldOut")}</span>
                      </div>
                    )}
                  </div>
                  <div className="similar-product-info">
                    <h4>{item.name}</h4>
                    <div className="similar-deal-prices">
                      <span className="similar-product-price">{item.price} MAD</span>
                      {item.oldPrice && <span className="similar-old-price">{item.oldPrice} MAD</span>}
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
          <span className="sticky-price">{finalPrice} MAD</span>
          <button onClick={handleAddToCart} className={`sticky-add-to-cart${deal.stock <= 0 ? ' disabled-btn' : ''}`} disabled={deal.stock <= 0}>
            {deal.stock <= 0 ? t("soldOut") : t("addToCart")}
          </button>
        </div>,
        document.body
      )}
    </>
  );
}
