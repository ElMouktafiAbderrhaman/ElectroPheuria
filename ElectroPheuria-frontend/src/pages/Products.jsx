// src/pages/Products.jsx
import { useNavigate, useLocation } from "react-router-dom";
import { useMemo, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import api from "../services/api";
import { dealDiscount, formatPrice, isDealActive, isProductActive, isBogoDeal, isComingSoon, offerLabel, offerBadge, byAvailability } from "../utils/dealPricing";
import { ComingSoonOverlay } from "../Components/ComingSoon";
import BundleDealCard from "../Components/BundleDealCard";
import { activeVariants, variantImage, variantLabel, variantPrice, variantStock, variantPriceRange, productSoldOut, isBundleDeal } from "../utils/variants";
import "../Components/VariantPicker.css";
import "./Products.css";

export default function Products() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();

  const [productsList, setProductsList] = useState([]);
  const [dealsList, setDealsList] = useState([]);
  const [loading, setLoading] = useState(true);
  // Cable type previewed on each product card: { [productId]: variantType }
  const [cardVariant, setCardVariant] = useState({});

  useEffect(() => {
    const loadData = async () => {
      try {
        const [products, deals] = await Promise.all([
          api.getProducts(),
          api.getDeals(),
        ]);
        if (products) {
          setProductsList(products);
          try {
            localStorage.setItem("ElectroPheuria_products", JSON.stringify(products));
          } catch (e) {
            console.warn('localStorage full, products not cached');
          }
        }
        if (deals) {
          setDealsList(deals);
          try {
            localStorage.setItem("ElectroPheuria_deals", JSON.stringify(deals));
          } catch (e) {
            console.warn('localStorage full, deals not cached');
          }
        }
      } catch (err) {
        console.error("Failed to load products from API:", err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  useEffect(() => {
    const handleUpdate = () => {
      try {
        const savedProducts = localStorage.getItem("ElectroPheuria_products");
        const savedDeals = localStorage.getItem("ElectroPheuria_deals");
        if (savedProducts) setProductsList(JSON.parse(savedProducts));
        if (savedDeals) setDealsList(JSON.parse(savedDeals));
      } catch (e) {
        console.warn('localStorage read failed in handleUpdate');
      }
    };

    window.addEventListener('productsUpdated', handleUpdate);
    window.addEventListener('dealsUpdated', handleUpdate);

    return () => {
      window.removeEventListener('productsUpdated', handleUpdate);
      window.removeEventListener('dealsUpdated', handleUpdate);
    };
  }, []);

  const queryParams = new URLSearchParams(location.search);
  const selectedCategory = queryParams.get("category");
  const searchQuery = queryParams.get("search")?.toLowerCase() || "";

  const categories = [
    { label: t("all"), value: null },
    { label: t("catPods"), value: "pods" },
    { label: t("catBatteries"), value: "batteries" },
    { label: t("catWatches"), value: "watches" },
    { label: t("catHeadphones"), value: "headphones" },
    { label: t("catSpeakers"), value: "speakers" },
    { label: t("catGaming"), value: "gaming" },
    { label: t("goldenDeals"), value: "golden" }
  ];

  const filteredProducts = useMemo(() => {
    return productsList.filter((product) => {
      if (!isProductActive(product)) return false;
      const matchesCategory = selectedCategory
        ? selectedCategory === "batteries"
          ? product.category === "batteries" || product.category === "chargers"
          : product.category === selectedCategory
        : true;

      const matchesSearch = searchQuery
        ? product.name.toLowerCase().includes(searchQuery) ||
          product.category.toLowerCase().includes(searchQuery)
        : true;

      return matchesCategory && matchesSearch;
    }).sort(byAvailability(productSoldOut)); // available first, coming soon last
  }, [productsList, selectedCategory, searchQuery]);

  const filteredDeals = useMemo(() => {
    return dealsList.filter((deal) => {
      if (!isDealActive(deal)) return false;
      const categories = Array.isArray(deal.categories) ? deal.categories : [deal.category || ""];
      // If "golden" category is selected, show all deals
      const matchesCategory = selectedCategory === "golden" || selectedCategory === null || categories.includes(selectedCategory);
      const matchesSearch = searchQuery
        ? deal.name.toLowerCase().includes(searchQuery) ||
          categories.some(cat => cat.toLowerCase().includes(searchQuery))
        : true;
      return matchesCategory && matchesSearch;
    }).sort(byAvailability()); // available first, coming soon last
  }, [dealsList, selectedCategory, searchQuery]);

  return (
    <main className="products-main">
      <div className="products-header">
        <h2>{t("products")}</h2>

        {searchQuery && (
          <p className="search-indicator">
            {t("showingResults")} <strong>{searchQuery}</strong>
          </p>
        )}

        <div className="categories-filter">
          {categories.map((cat, index) => {
            let url = "/products";

            if (cat.value && searchQuery) {
              url = `/products?category=${cat.value}&search=${searchQuery}`;
            } else if (cat.value) {
              url = `/products?category=${cat.value}`;
            } else if (searchQuery) {
              url = `/products?search=${searchQuery}`;
            }

            return (
              <button
                key={index}
                onClick={() => navigate(url)}
                className={`category-button ${selectedCategory === cat.value ? "active" : ""}`}
                data-value={cat.value || ""}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="products-grid" style={{display: 'flex', flexWrap: 'wrap', gap: '12px'}}>
{loading ? (
          <div className="products-loading">
            <div className="products-spinner"></div>
            <p>Chargement des produits...</p>
          </div>
        ) : (filteredProducts.length === 0 && filteredDeals.length === 0) ? (
          <div className="no-products">
            <p>{t("noItemsFound")}</p>
            <button onClick={() => navigate("/products")} className="clear-filters">
              {t("clearFilters")}
            </button>
          </div>
        ) : (
          <>
            {filteredProducts.map((product) => {
              const variants = activeVariants(product);
              const chosen = variants.find((v) => v.type === cardVariant[product.id]) || null;
              const cardImage = (chosen && variantImage(chosen)) || product.images?.[0] || product.image || (variants[0] && variantImage(variants[0]));
              const range = variantPriceRange(product);
              const cardPrice = chosen
                ? formatPrice(variantPrice(product, chosen))
                : range ? (range.min !== range.max ? `${formatPrice(range.min)} – ${formatPrice(range.max)}` : formatPrice(range.min)) : product.price;
              const soldOut = productSoldOut(product);
              return (
              <div
                key={product.id}
                className={`product-card${isComingSoon(product) ? ' coming-soon-card' : soldOut ? ' sold-out-card' : ''}`}
                onClick={() => navigate(`/product/${product.id}${chosen ? `?variant=${chosen.type}` : ''}`)}
                style={{cursor: 'pointer'}}
              >
                <div className="product-image">
                  {cardImage ? (
                    <img src={cardImage} alt={product.name} />
                  ) : (
                    <div className="image-placeholder">📦</div>
                  )}
                  {isComingSoon(product) ? <ComingSoonOverlay /> : soldOut && (
                    <div className="sold-out-overlay">
                      <span className="sold-out-badge">{t("soldOut")}</span>
                    </div>
                  )}
                </div>

                <div className="product-info">
                  <h4>{product.name}</h4>
                  {variants.length > 0 && !isComingSoon(product) && (
                    <div className="variant-chips" role="radiogroup" aria-label={t("cableType")}>
                      {variants.map((v) => {
                        const out = variantStock(product, v) <= 0;
                        return (
                          <button
                            key={v.id}
                            type="button"
                            role="radio"
                            aria-checked={chosen?.id === v.id}
                            className={`variant-chip${chosen?.id === v.id ? ' selected' : ''}${out ? ' out' : ''}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!out) setCardVariant((prev) => ({ ...prev, [product.id]: v.type }));
                            }}
                            title={out ? t("variantOutOfStock") : variantLabel(v)}
                          >
                            {variantImage(v) && <img src={variantImage(v)} alt="" />}
                            <span dir="ltr">{variantLabel(v)}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <p className="price" dir="ltr">{cardPrice} MAD</p>
                </div>
                <span className="click-details-tag">{t("clickDetails")}</span>
              </div>
              );
            })}
            {filteredDeals.map((deal) => isBundleDeal(deal) ? (
              <BundleDealCard key={deal.id} deal={deal} />
            ) : (
              <div
                key={deal.id}
                className={`product-card golden-card${isComingSoon(deal) ? ' coming-soon-card' : deal.stock <= 0 ? ' sold-out-card' : ''}`}
                onClick={() => navigate(`/deal/${deal.id}`)}
                style={{cursor: 'pointer'}}
              >
                <div className="product-image">
                  {deal.images?.[0] || deal.image ? (
                    <img src={deal.images?.[0] || deal.image} alt={deal.name} />
                  ) : (
                    <div className="image-placeholder">🔥</div>
                  )}
                  <span className="promo-sticker">{t("promotion")}</span>
                  {isBogoDeal(deal) ? (
                    <span className="deal-discount-corner bogo">{offerBadge(deal, t)}</span>
                  ) : dealDiscount(deal) !== null && (
                    <span className="deal-discount-corner">-{dealDiscount(deal)}%</span>
                  )}
                  {isComingSoon(deal) ? <ComingSoonOverlay /> : deal.stock <= 0 && (
                    <div className="sold-out-overlay">
                      <span className="sold-out-badge">{t("soldOut")}</span>
                    </div>
                  )}
                </div>

                <div className="product-info">
                  <h4>{deal.name}</h4>
                  {isBogoDeal(deal) && <span className="bogo-tag">{offerLabel(deal, t)}</span>}
                  <div className="deal-bottom">
                    {Number(deal.oldPrice) > Number(deal.price) ? (
                      <span className="deal-save">
                        {t("youSave")} {formatPrice(deal.oldPrice - deal.price)} MAD
                      </span>
                    ) : <span />}
                    <div className="deal-prices-stacked">
                      {Number(deal.oldPrice) > Number(deal.price) && (
                        <span className="old-price">{formatPrice(deal.oldPrice)} MAD</span>
                      )}
                      <span className="new-price">{formatPrice(deal.price)} MAD</span>
                    </div>
                  </div>
                </div>
                <span className="click-details-tag">{t("clickDetails")}</span>
              </div>
            ))}
          </>
        )}
      </div>
    </main>
  );
}