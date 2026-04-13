// src/pages/Products.jsx
import { useNavigate, useLocation } from "react-router-dom";
import { useMemo, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import "./Products.css";

export default function Products() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();

  // Get products from localStorage
  const [productsList, setProductsList] = useState(() => {
    const saved = localStorage.getItem("ElectroPheuria_products");
    return saved ? JSON.parse(saved) : [];
  });

  // Get deals from localStorage
  const [dealsList, setDealsList] = useState(() => {
    const saved = localStorage.getItem("ElectroPheuria_deals");
    return saved ? JSON.parse(saved) : [];
  });

  // Listen for product and deals updates
  useEffect(() => {
    const handleUpdate = () => {
      const savedProducts = localStorage.getItem("ElectroPheuria_products");
      const savedDeals = localStorage.getItem("ElectroPheuria_deals");
      setProductsList(savedProducts ? JSON.parse(savedProducts) : []);
      setDealsList(savedDeals ? JSON.parse(savedDeals) : []);
    };

    window.addEventListener('productsUpdated', handleUpdate);
    window.addEventListener('dealsUpdated', handleUpdate);
    window.addEventListener('focus', handleUpdate);
    
    return () => {
      window.removeEventListener('productsUpdated', handleUpdate);
      window.removeEventListener('dealsUpdated', handleUpdate);
      window.removeEventListener('focus', handleUpdate);
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
    }).sort((a, b) => (a.stock <= 0 ? 1 : 0) - (b.stock <= 0 ? 1 : 0));
  }, [productsList, selectedCategory, searchQuery]);

  const filteredDeals = useMemo(() => {
    return dealsList.filter((deal) => {
      const categories = Array.isArray(deal.categories) ? deal.categories : [deal.category || ""];
      // If "golden" category is selected, show all deals
      const matchesCategory = selectedCategory === "golden" || selectedCategory === null || categories.includes(selectedCategory);
      const matchesSearch = searchQuery
        ? deal.name.toLowerCase().includes(searchQuery) ||
          categories.some(cat => cat.toLowerCase().includes(searchQuery))
        : true;
      return matchesCategory && matchesSearch;
    }).sort((a, b) => (a.stock <= 0 ? 1 : 0) - (b.stock <= 0 ? 1 : 0));
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
{(filteredProducts.length === 0 && filteredDeals.length === 0) ? (
          <div className="no-products">
            <p>{t("noItemsFound")}</p>
            <button onClick={() => navigate("/products")} className="clear-filters">
              {t("clearFilters")}
            </button>
          </div>
        ) : (
          <>
            {filteredProducts.map((product) => (
              <div 
                key={product.id} 
                className={`product-card${product.stock <= 0 ? ' sold-out-card' : ''}`}
                onClick={() => navigate(`/product/${product.id}`)}
                style={{cursor: 'pointer'}}
              >
                <div className="product-image">
                  {product.images?.[0] || product.image ? (
                    <img src={product.images?.[0] || product.image} alt={product.name} />
                  ) : (
                    <div className="image-placeholder">📦</div>
                  )}
                  {product.stock <= 0 && (
                    <div className="sold-out-overlay">
                      <span className="sold-out-badge">{t("soldOut")}</span>
                    </div>
                  )}
                </div>
                
                <div className="product-info">
                  <h4>{product.name}</h4>
                  <p className="price">{product.price} MAD</p>
                </div>
                <span className="click-details-tag">{t("clickDetails")}</span>
              </div>
            ))}
            {filteredDeals.map((deal) => (
              <div 
                key={deal.id} 
                className={`product-card golden-card${deal.stock <= 0 ? ' sold-out-card' : ''}`}
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
                  {deal.stock <= 0 && (
                    <div className="sold-out-overlay">
                      <span className="sold-out-badge">{t("soldOut")}</span>
                    </div>
                  )}
                </div>
                
                <div className="product-info">
                  <h4>{deal.name}</h4>
                  <div className="deal-bottom">
                    {deal.discount && (
                      <span className="discount-badge-bottom">-{deal.discount}%</span>
                    )}
                    <div className="deal-prices-stacked">
                      <span className="old-price">{deal.oldPrice} MAD</span>
                      <span className="new-price">{deal.price} MAD</span>
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