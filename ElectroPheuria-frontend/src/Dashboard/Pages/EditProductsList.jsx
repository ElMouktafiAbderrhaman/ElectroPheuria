import { useOutletContext, Link, useNavigate } from "react-router-dom";
import api from "../../services/api.js";
import { dealDiscount, isDealActive, isProductActive, isBogoDeal, isComingSoon, offerShortLabel } from "../../utils/dealPricing";
import { activeVariants, variantLabel, isBundleDeal, bundleProducts } from "../../utils/variants";
import "./EditProductsList.css";

export default function EditProductsList() {
  const navigate = useNavigate();
  const context = useOutletContext() || {};

  const productsList = context.productsList || [];
  const dealsList = context.dealsList || [];
  const setProductsList = context.setProductsList || (() => {});
  const setDealsList = context.setDealsList || (() => {});

  const handleDeleteProduct = async (e, id) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this product?")) return;
    const product = productsList.find((p) => p.id === id);
    const dbId = product?.dbId || product?.id;
    try {
      await api.deleteProduct(dbId);
    } catch (error) {
      console.error('Database delete failed:', error);
      alert('Failed to delete product. Please try again.');
      return;
    }
    const updated = productsList.filter((p) => p.id !== id);
    setProductsList(updated);
    try {
      localStorage.setItem("ElectroPheuria_products", JSON.stringify(updated));
    } catch (storageErr) {
      console.warn('localStorage full, delete not cached locally');
    }
    window.dispatchEvent(new Event('productsUpdated'));
  };

  const handleDeleteDeal = async (e, id) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this deal?")) return;
    const deal = dealsList.find((d) => d.id === id);
    const dbId = deal?.dbId || deal?.id;
    try {
      await api.deleteDeal(dbId);
    } catch (error) {
      console.error('Database delete failed:', error);
      alert('Failed to delete deal. Please try again.');
      return;
    }
    const updated = dealsList.filter((d) => d.id !== id);
    setDealsList(updated);
    try {
      localStorage.setItem("ElectroPheuria_deals", JSON.stringify(updated));
    } catch (storageErr) {
      console.warn('localStorage full, delete not cached locally');
    }
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

      {/* ── Products Table ── */}
      <section className="edit-section">
        <div className="section-header">
          <h2 className="section-title">Products</h2>
          <p className="section-subtitle">{productsList.length} product{productsList.length !== 1 ? 's' : ''}</p>
        </div>

        {productsList.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📦</div>
            <p className="empty-text">No products yet.</p>
            <Link to="/dashboard/add-product" className="empty-action">➕ Add First Product</Link>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="ep-table">
              <thead>
                <tr>
                  <th>Image</th>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Price</th>
                  <th>Stock</th>
                  <th>Description</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {productsList.map((p) => {
                  const imgSrc = p.images?.[0] || getFallbackImage(p.category);
                  return (
                    <tr key={p.id} className="ep-row" onClick={() => navigate(`/dashboard/edit-products/${p.id}`)}>
                      <td>
                        <img
                          src={imgSrc}
                          alt={p.name}
                          className="ep-thumb"
                          onError={(e) => { e.target.src = getFallbackImage(p.category); }}
                        />
                      </td>
                      <td className="ep-name">{p.name}{!isProductActive(p) && <span style={{ marginLeft: 8, fontSize: '0.7rem', color: '#f87171' }}>(Hidden)</span>}{isComingSoon(p) && <span style={{ marginLeft: 8, fontSize: '0.7rem', color: '#FFD700' }}>(⏳ Coming soon)</span>}{activeVariants(p).length > 0 && <span style={{ display: 'block', fontSize: '0.72rem', color: '#D4AF37' }}>🔌 {activeVariants(p).map(variantLabel).join(' / ')}</span>}</td>
                      <td><span className="ep-badge">{p.category}</span></td>
                      <td className="ep-price">{p.price} MAD</td>
                      <td className="ep-stock">{p.stock ?? 0}</td>
                      <td className="ep-desc">{(typeof p.description === 'object' ? (p.description?.fr || '') : (p.description || '')).substring(0, 80) || '—'}</td>
                      <td className="ep-actions" onClick={(e) => e.stopPropagation()}>
                        <button className="ep-btn ep-btn-edit" onClick={() => navigate(`/dashboard/edit-products/${p.id}`)}>Edit</button>
                        <button className="ep-btn ep-btn-delete" onClick={(e) => handleDeleteProduct(e, p.id)}>Delete</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Deals Table ── */}
      <section className="edit-section">
        <div className="section-header">
          <h2 className="section-title deal-title">Deals</h2>
          <p className="section-subtitle">{dealsList.length} deal{dealsList.length !== 1 ? 's' : ''}</p>
        </div>

        {dealsList.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🔥</div>
            <p className="empty-text">No deals yet.</p>
            <Link to="/dashboard/add-product" className="empty-action">➕ Add First Deal</Link>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="ep-table">
              <thead>
                <tr>
                  <th>Image</th>
                  <th>Name</th>
                  <th>Old Price</th>
                  <th>Discount</th>
                  <th>New Price</th>
                  <th>Description</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {dealsList.map((d) => (
                  <tr key={d.id} className="ep-row" onClick={() => navigate(`/dashboard/edit-products/deal-${d.id}`)}>
                    <td>
                      <img
                        src={d.images?.[0] || getFallbackImage(d.categories?.[0])}
                        alt={d.name}
                        className="ep-thumb"
                      />
                    </td>
                    <td className="ep-name">{d.name}{!isDealActive(d) && <span style={{ marginLeft: 8, fontSize: '0.7rem', color: '#f87171' }}>(Inactive)</span>}{isComingSoon(d) && <span style={{ marginLeft: 8, fontSize: '0.7rem', color: '#FFD700' }}>(⏳ Coming soon)</span>}{activeVariants(d).length > 0 && <span style={{ display: 'block', fontSize: '0.72rem', color: '#D4AF37' }}>🔌 {activeVariants(d).map(variantLabel).join(' / ')}</span>}{isBundleDeal(d) && (
                      <span style={{ display: 'block', fontSize: '0.72rem', color: d.bundle_complete === false ? '#f87171' : '#D4AF37' }}>
                        🎁 Bundle: {bundleProducts(d).map((p) => p.name).join(' + ') || '—'}{d.bundle_complete === false && ' (a product was deleted — edit or delete this bundle)'}
                      </span>
                    )}</td>
                    <td className="ep-old-price">{isBogoDeal(d) ? "—" : `${d.oldPrice} MAD`}</td>
                    <td><span className="ep-discount">{isBogoDeal(d) ? offerShortLabel(d) : dealDiscount(d) !== null ? `-${dealDiscount(d)}%` : "—"}</span></td>
                    <td className="ep-price">{d.price} MAD</td>
                    <td className="ep-desc">{(typeof d.description === 'object' ? (d.description?.fr || '') : (d.description || '')).substring(0, 80) || '—'}</td>
                    <td className="ep-actions" onClick={(e) => e.stopPropagation()}>
                      <button className="ep-btn ep-btn-edit" onClick={() => navigate(`/dashboard/edit-products/deal-${d.id}`)}>Edit</button>
                      <button className="ep-btn ep-btn-edit" title="Feature this deal in a homepage banner" onClick={() => navigate(`/dashboard/banners/new?deal=${d.id}`)}>Banner</button>
                      <button className="ep-btn ep-btn-delete" onClick={(e) => handleDeleteDeal(e, d.id)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

    </main>
  );
}

