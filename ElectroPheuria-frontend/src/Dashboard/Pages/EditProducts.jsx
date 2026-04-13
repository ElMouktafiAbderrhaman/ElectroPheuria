// src/Dashboard/Pages/EditProducts.jsx
import { useOutletContext } from "react-router-dom";
import api from "../../services/api.js";
import "./EditProducts.css";

export default function EditProducts() {
  const context = useOutletContext() || {};
  
  const productsList = context.productsList || [];
  const dealsList = context.dealsList || [];
  const setProductsList = context.setProductsList || (() => {});
  const setDealsList = context.setDealsList || (() => {});

  /* ================= DELETE FUNCTIONS ================= */

  const handleDeleteProduct = async (id) => {
    const product = productsList.find(p => p.id === id);
    const dbId = product?.dbId || product?.id;
    
    try {
      await api.deleteProduct(dbId);
    } catch (e) {
      console.error('DB delete failed:', e);
    }

    const updated = productsList.filter((p) => p.id !== id);
    setProductsList(updated);
    localStorage.setItem("ElectroPheuria_products", JSON.stringify(updated));
    window.dispatchEvent(new Event('productsUpdated'));
  };

  const handleDeleteDeal = async (id) => {
    const deal = dealsList.find(d => d.id === id);
    const dbId = deal?.dbId || deal?.id;
    
    try {
      await api.deleteDeal(dbId);
    } catch (e) {
      console.error('DB delete failed:', e);
    }

    const updated = dealsList.filter((d) => d.id !== id);
    setDealsList(updated);
    localStorage.setItem("ElectroPheuria_deals", JSON.stringify(updated));
    window.dispatchEvent(new Event('dealsUpdated'));
  };

  const getFallbackImage = (category) => {
    const imageMap = {
      batteries: 'batteries.jpg',
      chargers: 'chargers.jpg',
      headphones: 'headphones.jpg',
      pods: 'pods.jpg',
      speakers: 'SpeakerAcc.avif',
      gaming: 'GamingAcc.jpg',
      watches: 'watches.jpg'
    };
    return `/assets/images/${imageMap[category] || 'batteries.jpg'}`;
  };

  return (
    <main className="edit-products-main">
      {/* ================= PRODUCTS SECTION ================= */}

      <section className="edit-section">
        <div className="section-header">
          <h2 className="section-title">Edit Products</h2>
          <p className="section-subtitle">Manage your product inventory</p>
        </div>

        {productsList.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📦</div>
            <p className="empty-text">No products added yet.</p>
            <p className="empty-subtext">Go to Add Products to create your first product.</p>
          </div>
        ) : (
          <div className="products-grid">
            {productsList.map((p) => {
              const imgSrc = p.images?.[0] || p.image;
              console.log('Product image:', imgSrc ? 'loaded' : 'missing', p.name);
              const fallback = getFallbackImage(p.category);
              return (
              <div key={p.id} className="product-card">
                <div className="card-image-container">
                  <img 
                    src={imgSrc || fallback} 
                    alt={p.name} 
                    className="card-image" 
                    onError={(e) => { e.target.src = fallback; }}
                  />
                  <span className="category-badge">{p.category}</span>
                </div>

                <div className="card-content">
                  <h3 className="card-title">{p.name}</h3>
                  <p className="card-description" style={{textAlign: 'left', marginLeft: 0}}>{p.description || 'No description'}</p>
                  <div className="card-details">
                    <span className="card-price">{p.price} MAD</span>

                  </div>
                </div>

                <div className="card-actions">
                  <button className="delete-button" onClick={() => handleDeleteProduct(p.id)}>
                    <span>🗑️</span> Delete
                  </button>
                </div>
              </div>
            );
            })}
          </div>
        )}
      </section>

      {/* ================= DEALS SECTION ================= */}

      <section className="edit-section">
        <div className="section-header">
          <h2 className="section-title deal-title">Edit Deals</h2>
          <p className="section-subtitle">Manage your special offers</p>
        </div>

        {dealsList.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🔥</div>
            <p className="empty-text">No deals added yet.</p>
            <p className="empty-subtext">Go to Add Products to create your first deal.</p>
          </div>
        ) : (
          <div className="deals-grid">
            {dealsList.map((d) => {
              const imgSrc = d.images?.[0] || d.image;
              console.log('Deal image:', imgSrc ? 'loaded' : 'missing', d.name);
              const fallback = getFallbackImage(d.category);
              return (
              <div key={d.id} className="deal-card">
                <div className="deal-badge-card">🔥 HOT DEAL</div>
                <div className="card-image-container">
                  <img 
                    src={imgSrc || fallback} 
                    alt={d.name} 
                    className="card-image" 
                    onError={(e) => { e.target.src = fallback; }}
                  />
                  <span className="discount-badge-card">-{d.discount}%</span>
                </div>

                <div className="card-content">
                  <h3 className="card-title">{d.name}</h3>
                  <p className="card-description" style={{textAlign: 'left', marginLeft: 0}}>{d.description || 'No description'}</p>
                  <div className="deal-prices">
                    <span className="old-price">{d.oldPrice} MAD</span>
                    <span className="new-price">{d.price} MAD</span>
                  </div>
                </div>

                <div className="card-actions">
                  <button className="delete-button deal-delete" onClick={() => handleDeleteDeal(d.id)}>
                    <span>🗑️</span> Delete
                  </button>
                </div>
              </div>
            );
            })}
          </div>
        )}
      </section>
    </main>
  );
}