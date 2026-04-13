import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, useOutletContext } from "react-router-dom";
import api from "../../services/api.js";
import "./EditProductDetail.css";

/* ================= IMAGE COMPRESSION ================= */
const compressImage = (file, maxWidth = 800, quality = 0.75) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
};

export default function EditProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const context = useOutletContext() || {};
  const setProductsList = context.setProductsList || (() => {});
  const setDealsList = context.setDealsList || (() => {});

  const [item, setItem] = useState(null);
  const [isDeal, setIsDeal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [computedPrice, setComputedPrice] = useState(0);

  useEffect(() => {
    const dealType = id.startsWith('deal-');
    const realId = dealType ? id.slice(5) : id;
    setIsDeal(dealType);

    const key = dealType ? "ElectroPheuria_deals" : "ElectroPheuria_products";
    try {
      const items = JSON.parse(localStorage.getItem(key) || "[]");
      const found = items.find(p => String(p.id) === realId);
      if (found) {
        setItem({ ...found });
        if (dealType && found.oldPrice && found.discount) {
          const newPrice = Math.round(found.oldPrice * (1 - found.discount / 100));
          setComputedPrice(newPrice);
        }
      } else {
        navigate("/dashboard/edit-products", { replace: true });
      }
    } catch (e) {
      console.error('Load error:', e);
      navigate("/dashboard/edit-products", { replace: true });
    }
    setLoading(false);
  }, [id, navigate]);

  useEffect(() => {
    if (isDeal && item && item.oldPrice && item.discount) {
      const newPrice = Math.round(item.oldPrice * (1 - item.discount / 100));
      setComputedPrice(newPrice);
      setItem(prev => ({ ...prev, price: newPrice }));
    }
  }, [isDeal, item?.oldPrice, item?.discount]);

  const handleFieldChange = useCallback((e) => {
    const { name, value } = e.target;
    setItem(prev => ({ ...prev, [name]: Number(value) || value }));
  }, []);

  const handleLangFieldChange = useCallback((field, lang, value) => {
    setItem(prev => {
      const current = prev[field];
      // Migrate old string format to object
      const obj = (typeof current === 'object' && current !== null)
        ? { ...current }
        : { fr: current || '', en: '', ar: '' };
      obj[lang] = value;
      return { ...prev, [field]: obj };
    });
  }, []);

  const getLangValue = (field, lang) => {
    const val = item?.[field];
    if (typeof val === 'object' && val !== null) return val[lang] || '';
    // Old format: show the string only in FR
    return lang === 'fr' ? (val || '') : '';
  };

  const clearZero = (e) => {
    if (e.target.value === '0') {
      e.target.value = '';
    }
  };

  const handleImageChange = useCallback((index) => async (e) => {
    const file = e.target.files[0];
    if (file) {
      try {
        const base64 = await compressImage(file, 800, 0.75);
        setItem(prev => {
          const newImages = [...(prev?.images || [])];
          while (newImages.length <= index) newImages.push(null);
          newImages[index] = base64;
          return { ...prev, images: newImages };
        });
      } catch (err) {
        console.error("Image compress error:", err);
      }
    }
  }, []);

  const addImageSlot = useCallback(() => {
    setItem(prev => ({
      ...prev,
      images: [...(prev.images || []), null]
    }));
  }, []);

  const removeImage = useCallback((index) => {
    setItem(prev => ({
      ...prev,
      images: (prev.images || []).filter((_, i) => i !== index)
    }));
  }, []);

  // Specs table helpers
  const handleSpecChange = useCallback((index, field, value) => {
    setItem(prev => {
      const specs = Array.isArray(prev.specs) ? [...prev.specs] : [];
      specs[index] = { ...specs[index], [field]: value };
      return { ...prev, specs };
    });
  }, []);

  const addSpecRow = useCallback(() => {
    setItem(prev => ({
      ...prev,
      specs: [...(prev.specs || []), { label: "", value: "" }]
    }));
  }, []);

  const removeSpecRow = useCallback((index) => {
    setItem(prev => ({
      ...prev,
      specs: (prev.specs || []).filter((_, i) => i !== index)
    }));
  }, []);

  // Gallery helpers
  const handleGalleryTextChange = useCallback((index, lang, value) => {
    setItem(prev => {
      const gallery = Array.isArray(prev.gallery) ? [...prev.gallery] : [];
      const currentText = typeof gallery[index]?.text === 'object' ? gallery[index].text : { fr: gallery[index]?.text || '', en: '', ar: '' };
      gallery[index] = { ...gallery[index], text: { ...currentText, [lang]: value } };
      return { ...prev, gallery };
    });
  }, []);

  const handleGalleryImageChange = useCallback((index) => async (e) => {
    const file = e.target.files[0];
    if (file) {
      try {
        const base64 = await compressImage(file, 800, 0.75);
        setItem(prev => {
          const gallery = Array.isArray(prev.gallery) ? [...prev.gallery] : [];
          gallery[index] = { ...gallery[index], image: base64 };
          return { ...prev, gallery };
        });
      } catch (err) {
        console.error("Gallery image compress error:", err);
      }
    }
  }, []);

  const addGalleryItem = useCallback(() => {
    setItem(prev => ({
      ...prev,
      gallery: [...(prev.gallery || []), { image: "", text: { fr: "", en: "", ar: "" } }]
    }));
  }, []);

  const removeGalleryItem = useCallback((index) => {
    setItem(prev => ({
      ...prev,
      gallery: (prev.gallery || []).filter((_, i) => i !== index)
    }));
  }, []);

  const handleSave = useCallback(async () => {
    if (!item) return;
    setSaving(true);
    const dealType = id.startsWith('deal-');
    const realId = dealType ? id.slice(5) : id;
    const key = dealType ? "ElectroPheuria_deals" : "ElectroPheuria_products";
    try {
      // Update in database using the DB id
      const dbId = item.dbId || item.id;
      if (dealType) {
        await api.updateDeal({ ...item, id: dbId });
      } else {
        await api.updateProduct({ ...item, id: dbId });
      }

      // Also update localStorage
      const items = JSON.parse(localStorage.getItem(key) || "[]");
      const updatedItems = items.map(i => String(i.id) === realId ? item : i);
      localStorage.setItem(key, JSON.stringify(updatedItems));
      
      if (dealType) {
        setDealsList(updatedItems);
      } else {
        setProductsList(updatedItems);
      }
      navigate("/dashboard/edit-products");
    } catch (e) {
      console.error('Save error:', e);
      alert('Failed to save changes. Please try again.');
    }
    setSaving(false);
  }, [item, id, navigate, setProductsList, setDealsList, isDeal]);

  const handleDelete = useCallback(async () => {
    if (!item) return;
    const dealType = id.startsWith('deal-');
    const realId = dealType ? id.slice(5) : id;
    const key = dealType ? "ElectroPheuria_deals" : "ElectroPheuria_products";
    
    try {
      // Delete from database
      const dbId = item.dbId || item.id;
      try {
        if (dealType) {
          await api.deleteDeal(dbId);
        } else {
          await api.deleteProduct(dbId);
        }
      } catch (apiErr) {
        console.warn('API delete failed (continuing with local):', apiErr);
      }

      // Delete from localStorage (compare as strings to avoid type mismatch)
      const items = JSON.parse(localStorage.getItem(key) || "[]");
      const updated = items.filter(i => String(i.id) !== String(realId));
      localStorage.setItem(key, JSON.stringify(updated));
      
      if (dealType) {
        setDealsList(updated);
      } else {
        setProductsList(updated);
      }
      window.dispatchEvent(new Event(dealType ? 'dealsUpdated' : 'productsUpdated'));
      navigate("/dashboard/edit-products");
    } catch (e) {
      console.error('Delete error:', e);
      alert('Failed to delete. Please try again.');
    }
  }, [item, id, navigate, setProductsList, setDealsList]);

  if (loading) return <div className="loading">Loading...</div>;
  if (!item) return <div className="loading">Item not found</div>;

  // Ensure minimum 3 image slots
  const displayImages = [...(item.images || [])];
  while (displayImages.length < 3) displayImages.push(null);

  return (
    <main className="edit-detail-main">
      <div className="detail-header">
        <button className="back-button" onClick={() => navigate("/dashboard/edit-products")}>
          ← Back
        </button>
        <h1>Edit {isDeal ? 'Deal' : 'Product'}: {item.name}</h1>
      </div>

      <div className="edit-detail-card">
        <div className="detail-image-section">
          <label>Images (click to change) — minimum 3, add more below</label>
          <div className="images-preview">
            {displayImages.map((img, i) => (
              <div key={i} className="image-preview">
                <img src={img || '/vite.svg'} alt={`Image ${i+1}`} className="preview-img" />
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={handleImageChange(i)} 
                  className="form-file" 
                />
                <label className="file-label">Image {i+1}</label>
                {displayImages.length > 3 && (
                  <button type="button" className="spec-remove-btn image-remove-btn" onClick={() => removeImage(i)}>✕</button>
                )}
              </div>
            ))}
          </div>
          <button type="button" className="spec-add-btn" onClick={addImageSlot}>+ Add Image</button>
        </div>

        <div className="detail-form">
          <div className="input-group">
            <label>Name</label>
            <input type="text" name="name" value={item.name || ''} onChange={handleFieldChange} className="form-input" />
          </div>

          <div className="input-row">
            <div className="input-group">
              <label>Price (MAD)</label>
              <input 
                type="number" 
                name="price" 
                value={isDeal ? computedPrice : (item.price || 0)} 
                onChange={handleFieldChange}
                readOnly={isDeal}
                className="form-input" 
                min="0"
                step="0.01"
                onFocus={clearZero}
              />
            </div>
            <div className="input-group">
              <label>Stock</label>
              <input 
                type="number" 
                name="stock" 
                value={item.stock || 0} 
                onChange={handleFieldChange} 
                className="form-input" 
                min="0"
                onFocus={clearZero}
              />
            </div>
          </div>

          {isDeal && (
            <div className="input-row">
              <div className="input-group">
                <label>Old Price (MAD)</label>
                <input 
                  type="number" 
                  name="oldPrice" 
                  value={item.oldPrice || 0} 
                  onChange={handleFieldChange} 
                  className="form-input" 
                  min="0"
                  onFocus={clearZero}
                />
              </div>
              <div className="input-group">
                <label>Discount (%)</label>
                <input 
                  type="number" 
                  name="discount" 
                  value={item.discount || 0} 
                  onChange={handleFieldChange} 
                  className="form-input" 
                  min="0"
                  max="100"
                  onFocus={clearZero}
                />
              </div>
            </div>
          )}

          <div className="input-group">
            <label>Description</label>
            <div className="lang-fields">
              <div className="lang-field">
                <span className="lang-badge">FR</span>
                <textarea
                  value={getLangValue('description', 'fr')}
                  onChange={(e) => handleLangFieldChange('description', 'fr', e.target.value)}
                  className="form-textarea"
                  rows="3"
                />
              </div>
              <div className="lang-field">
                <span className="lang-badge">EN</span>
                <textarea
                  value={getLangValue('description', 'en')}
                  onChange={(e) => handleLangFieldChange('description', 'en', e.target.value)}
                  className="form-textarea"
                  rows="3"
                />
              </div>
              <div className="lang-field">
                <span className="lang-badge lang-badge-ar">AR</span>
                <textarea
                  value={getLangValue('description', 'ar')}
                  onChange={(e) => handleLangFieldChange('description', 'ar', e.target.value)}
                  className="form-textarea"
                  rows="3"
                  dir="rtl"
                />
              </div>
            </div>
          </div>

          <div className="input-group">
            <label>Reviews</label>
            <div className="lang-fields">
              <div className="lang-field">
                <span className="lang-badge">FR</span>
                <textarea
                  value={getLangValue('reviews', 'fr')}
                  onChange={(e) => handleLangFieldChange('reviews', 'fr', e.target.value)}
                  className="form-textarea"
                  rows="2"
                />
              </div>
              <div className="lang-field">
                <span className="lang-badge">EN</span>
                <textarea
                  value={getLangValue('reviews', 'en')}
                  onChange={(e) => handleLangFieldChange('reviews', 'en', e.target.value)}
                  className="form-textarea"
                  rows="2"
                />
              </div>
              <div className="lang-field">
                <span className="lang-badge lang-badge-ar">AR</span>
                <textarea
                  value={getLangValue('reviews', 'ar')}
                  onChange={(e) => handleLangFieldChange('reviews', 'ar', e.target.value)}
                  className="form-textarea"
                  rows="2"
                  dir="rtl"
                />
              </div>
            </div>
          </div>

          {/* ================= SPECS TABLE EDITOR ================= */}
          <div className="input-group">
              <label>📋 Product Specifications Table</label>
              <p className="field-hint">Add rows for the product details table</p>
              <div className="specs-builder">
                {(item.specs || []).map((row, i) => (
                  <div key={i} className="spec-row-input">
                    <input
                      type="text"
                      placeholder="Label (e.g. Weight)"
                      value={row.label || ''}
                      onChange={(e) => handleSpecChange(i, 'label', e.target.value)}
                      className="form-input spec-label-input"
                    />
                    <input
                      type="text"
                      placeholder="Value (e.g. 250g)"
                      value={row.value || ''}
                      onChange={(e) => handleSpecChange(i, 'value', e.target.value)}
                      className="form-input spec-value-input"
                    />
                    <button
                      type="button"
                      className="spec-remove-btn"
                      onClick={() => removeSpecRow(i)}
                    >✕</button>
                  </div>
                ))}
                <button type="button" className="spec-add-btn" onClick={addSpecRow}>
                  + Add Row
                </button>
              </div>
            </div>

          {/* ================= GALLERY INFO IMAGES EDITOR ================= */}
          <div className="input-group">
              <label>🖼️ Gallery Info Images</label>
              <p className="field-hint">Extra images with descriptions for the product page scroll gallery</p>
              <div className="gallery-builder">
                {(item.gallery || []).map((gItem, i) => (
                  <div key={i} className="gallery-item-input">
                    <div className="gallery-item-header">
                      <span className="gallery-item-number">Gallery Image {i + 1}</span>
                      <button
                        type="button"
                        className="spec-remove-btn"
                        onClick={() => removeGalleryItem(i)}
                      >✕</button>
                    </div>
                    {gItem.image && (
                      <img src={gItem.image} alt={`Gallery ${i+1}`} className="gallery-preview-thumb" />
                    )}
                    <label className="file-upload-box gallery-upload">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleGalleryImageChange(i)}
                      />
                      <div className="upload-content">
                        <span>🖼️</span>
                        <p>{gItem.image ? "Click to replace image" : "Click to choose gallery image"}</p>
                      </div>
                    </label>
                    <div className="lang-fields">
                      <div className="lang-field">
                        <span className="lang-badge">FR</span>
                        <textarea
                          placeholder="Texte sous l'image (optionnel)"
                          value={typeof gItem.text === 'object' ? (gItem.text?.fr || '') : (gItem.text || '')}
                          onChange={(e) => handleGalleryTextChange(i, 'fr', e.target.value)}
                          className="form-textarea"
                          rows="2"
                        />
                      </div>
                      <div className="lang-field">
                        <span className="lang-badge">EN</span>
                        <textarea
                          placeholder="Text below image (optional)"
                          value={typeof gItem.text === 'object' ? (gItem.text?.en || '') : ''}
                          onChange={(e) => handleGalleryTextChange(i, 'en', e.target.value)}
                          className="form-textarea"
                          rows="2"
                        />
                      </div>
                      <div className="lang-field">
                        <span className="lang-badge lang-badge-ar">AR</span>
                        <textarea
                          placeholder="نص أسفل الصورة (اختياري)"
                          value={typeof gItem.text === 'object' ? (gItem.text?.ar || '') : ''}
                          onChange={(e) => handleGalleryTextChange(i, 'ar', e.target.value)}
                          className="form-textarea"
                          rows="2"
                          dir="rtl"
                        />
                      </div>
                    </div>
                  </div>
                ))}
                {(item.gallery || []).length < 10 && (
                  <button type="button" className="spec-add-btn" onClick={addGalleryItem}>
                    + Add Gallery Image
                  </button>
                )}
              </div>
            </div>

          <div className="form-actions">
            <button className="save-button" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : '💾 Save Changes'}
            </button>
            <button className="delete-button" onClick={() => setShowDeleteConfirm(true)}>
              🗑️ Delete
            </button>
          </div>
        </div>
      </div>

      {showDeleteConfirm && (
        <div className="confirm-modal">
          <div className="confirm-content">
            <h3>Confirm Delete</h3>
            <p>Delete "{item.name}"? Cannot be undone.</p>
            <div className="confirm-buttons">
              <button className="confirm-yes" onClick={handleDelete}>Yes</button>
              <button className="confirm-no" onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

