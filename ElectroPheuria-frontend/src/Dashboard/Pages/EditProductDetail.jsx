import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate, useOutletContext } from "react-router-dom";
import api from "../../services/api.js";
import { calcDiscountPercent, validateDealPrices, isBogoDeal, isBogoFixedDeal, validateSecondItemPrice, OFFER_STANDARD, OFFER_BOGO_HALF, OFFER_BOGO_FIXED } from "../../utils/dealPricing";
import CableVariantsEditor, { emptyVariantsState, variantsStateFromProduct, variantsPayload, validateVariants } from "../components/CableVariantsEditor";
import BundleEditor, { validateBundle, bundleChoices, bundleItemsPayload, bundleRefsFromDeal } from "../components/BundleEditor";
import { VARIANT_CATEGORIES } from "../../utils/variants";
import "./AddProducts.css";
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
        resolve(canvas.toDataURL("image/jpeg", quality));
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
  const productsList = context.productsList || [];
  const dealsList = context.dealsList || [];
  const setProductsList = context.setProductsList || (() => {});
  const setDealsList = context.setDealsList || (() => {});

  const itemFoundRef = useRef(false);
  const [item, setItem] = useState(null);
  const [isDeal, setIsDeal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [variantsState, setVariantsState] = useState(emptyVariantsState);
  const [bundleIds, setBundleIds] = useState(["", ""]);

  useEffect(() => {
    if (itemFoundRef.current) return;

    const dealType = id.startsWith('deal-');
    const realId = dealType ? id.slice(5) : id;
    setIsDeal(dealType);

    const contextList = dealType ? dealsList : productsList;

    // Try context (App-level state) first — works even when localStorage is full
    let found = contextList.find(p => String(p.id) === realId || String(p.dbId) === realId);

    if (!found) {
      // Fallback to localStorage
      const key = dealType ? "ElectroPheuria_deals" : "ElectroPheuria_products";
      try {
        const items = JSON.parse(localStorage.getItem(key) || "[]");
        found = items.find(p => String(p.id) === realId);
      } catch (e) {
        console.error('localStorage read error:', e);
      }
    }

    if (found) {
      itemFoundRef.current = true;
      const loaded = { ...found };
      if (dealType && loaded.deal_type === 'bundle') {
        setBundleIds(bundleRefsFromDeal(loaded));
        // Images shown from the two products are not the pack's own images: don't save them back.
        if (loaded.images_from_products) loaded.images = [];
      }
      setVariantsState(variantsStateFromProduct(loaded));
      setItem(loaded);
      setLoading(false);
    } else if (contextList.length > 0) {
      // List is loaded but item not found — redirect
      navigate("/dashboard/edit-products", { replace: true });
      setLoading(false);
    }
    // If contextList is still empty, wait for next render when data loads
  }, [id, navigate, productsList, dealsList]);

  // Deals: the promotional price is entered manually; the discount follows from it.
  const isBundle = isDeal && item?.deal_type === 'bundle';
  const isBogo = isDeal && !isBundle && isBogoDeal(item);
  const isBogoFixed = isDeal && !isBundle && isBogoFixedDeal(item);
  const dealDiscount = isDeal && !isBogo ? calcDiscountPercent(item?.oldPrice, item?.price) : null;
  // Products in cable categories, and every single deal (deal cables share the deal's price and stock).
  const showVariants = !!item && (isDeal
    ? !isBundle
    : VARIANT_CATEGORIES.includes(item.category) || !!item.has_variants || (item.variants || []).length > 0);
  // Products and other single deals that can go into this pack.
  const packChoices = isBundle ? bundleChoices(productsList, dealsList, item?.dbId || item?.id) : [];
  // Bundles that contain this product / deal (they become unavailable if it is deleted).
  const itemKind = isDeal ? 'deal' : 'product';
  const bundlesWithItem = item && !isBundle
    ? dealsList.filter((d) => d.deal_type === 'bundle' && (d.bundle_products || []).some((p) => (p.kind || 'product') === itemKind && String(p.id) === String(item.dbId || item.id)))
    : [];
  const bogoPriceError = (it) => (Number(it?.price) > 0
    ? (isBogoFixedDeal(it) ? validateSecondItemPrice(it.price, it.second_item_price ?? "") : "")
    : "Unit price must be a positive number.");
  const dealPriceError = isDeal && item
    ? (isBundle ? "" : isBogo ? bogoPriceError(item) : validateDealPrices(item.oldPrice, item.price))
    : "";

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
    const dealType = id.startsWith('deal-');
    const bundle = dealType && item.deal_type === 'bundle';
    const bogo = dealType && !bundle && isBogoDeal(item);
    if (dealType) {
      const priceError = bundle
        ? validateBundle(packChoices, bundleIds, item.price)
        : bogo
        ? bogoPriceError(item)
        : validateDealPrices(item.oldPrice, item.price);
      if (priceError) {
        alert(priceError);
        return;
      }
    } else if (showVariants) {
      const variantsError = validateVariants(variantsState);
      if (variantsError) {
        alert(variantsError);
        return;
      }
    }
    setSaving(true);
    const realId = dealType ? id.slice(5) : id;
    const key = dealType ? "ElectroPheuria_deals" : "ElectroPheuria_products";
    try {
      // Update in database using the DB id
      const dbId = item.dbId || item.id;
      if (dealType) {
        // A 1+1 deal has no promotional price, so the two offers never stack.
        const payload = bundle
          ? {
              ...item,
              deal_type: 'bundle',
              bundle_items: bundleItemsPayload(bundleIds),
              offer_type: OFFER_STANDARD,
              second_item_price: null,
              images: (item.images || []).filter(Boolean),
            }
          : bogo
          ? { ...item, deal_type: 'single', oldPrice: item.price, discount: 0, second_item_price: isBogoFixedDeal(item) ? Number(item.second_item_price) : null }
          : { ...item, deal_type: 'single', offer_type: OFFER_STANDARD, discount: calcDiscountPercent(item.oldPrice, item.price), second_item_price: null };
        delete payload.bundle_products;
        delete payload.images_from_products;
        delete payload.variants;
        await api.updateDeal({ ...payload, id: dbId, ...(showVariants && !bundle ? variantsPayload(variantsState) : {}) });
      } else {
        const { variants: _ignored, ...rest } = item;
        // Only send variants when the section is shown, so other products are never touched.
        await api.updateProduct({ ...rest, id: dbId, ...(showVariants ? variantsPayload(variantsState) : {}) });
      }

      // Bundles and variants are rebuilt by the server (combined price, images, labels): reload them.
      if (bundle || showVariants) {
        try {
          const fresh = dealType ? await api.getDeals() : await api.getProducts();
          (dealType ? setDealsList : setProductsList)(fresh);
          try { localStorage.setItem(key, JSON.stringify(fresh)); } catch { /* full */ }
          window.dispatchEvent(new Event(dealType ? 'dealsUpdated' : 'productsUpdated'));
          navigate("/dashboard/edit-products");
          setSaving(false);
          return;
        } catch (reloadErr) {
          console.warn('Reload after save failed:', reloadErr);
        }
      }

      // Update context state (source of truth)
      const replaceFn = (i) => (String(i.id) === realId || String(i.dbId) === realId) ? item : i;
      if (dealType) {
        setDealsList(prev => prev.map(replaceFn));
      } else {
        setProductsList(prev => prev.map(replaceFn));
      }

      // Also update localStorage (best-effort)
      try {
        const items = JSON.parse(localStorage.getItem(key) || "[]");
        const updatedItems = items.map(i => String(i.id) === realId ? item : i);
        localStorage.setItem(key, JSON.stringify(updatedItems));
      } catch (storageErr) {
        console.warn('localStorage full, save not cached locally');
      }
      navigate("/dashboard/edit-products");
    } catch (e) {
      console.error('Save error:', e);
      alert(`Failed to save changes: ${e?.message || 'Please try again.'}`);
    }
    setSaving(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item, id, navigate, setProductsList, setDealsList, isDeal, bundleIds, variantsState, showVariants, packChoices]);

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

      // Update context state (source of truth)
      const filterFn = (i) => String(i.id) !== String(realId) && String(i.dbId) !== String(realId);
      if (dealType) {
        setDealsList(prev => prev.filter(filterFn));
      } else {
        setProductsList(prev => prev.filter(filterFn));
      }

      // Delete from localStorage (best-effort)
      try {
        const items = JSON.parse(localStorage.getItem(key) || "[]");
        const updated = items.filter(i => String(i.id) !== String(realId));
        localStorage.setItem(key, JSON.stringify(updated));
      } catch (storageErr) {
        console.warn('localStorage full, delete not cached locally');
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
        <h1>Edit {isBundle ? 'Bundle Deal' : isDeal ? 'Deal' : 'Product'}: {item.name}</h1>
      </div>

      <div className="edit-detail-card">
        <div className="detail-image-section">
          <label>{isBundle ? 'Pack images (optional — leave empty to show the two product images)' : 'Images (click to change) — minimum 3, add more below'}</label>
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
          {isDeal && !isBundle && (
            <div className="input-group">
              <label>Offer Type</label>
              <select
                value={isBogoFixed ? OFFER_BOGO_FIXED : isBogo ? OFFER_BOGO_HALF : OFFER_STANDARD}
                onChange={(e) => setItem(prev => ({ ...prev, offer_type: e.target.value }))}
                className="form-input"
              >
                <option value={OFFER_STANDARD}>Standard Discount (promotional price)</option>
                <option value={OFFER_BOGO_HALF}>Buy 1, Get the 2nd at 50% Off</option>
                <option value={OFFER_BOGO_FIXED}>Buy 1, Get the 2nd for a Fixed Price</option>
              </select>
              {isBogoFixed && (
                <>
                  <label style={{ marginTop: 12 }}>Price of the 2nd Item (MAD)</label>
                  <input
                    type="number"
                    name="second_item_price"
                    value={item.second_item_price ?? ''}
                    onChange={handleFieldChange}
                    className="form-input"
                    placeholder="e.g. 50"
                    min="0"
                    step="0.01"
                  />
                  <p style={{ fontSize: '0.8125rem', margin: '8px 0 0', opacity: 0.85 }}>
                    Every second unit of this item costs exactly this price (e.g. 199 MAD with 2nd at 50: 1 = 199, 2 = 249, 3 = 448, 4 = 498).
                    No rounding and no promotional price is applied on top.
                  </p>
                </>
              )}
              {isBogo && !isBogoFixed && (
                <p style={{ fontSize: '0.8125rem', margin: '8px 0 0', opacity: 0.85 }}>
                  Every second unit of this item is half price, and the total is rounded down to a price ending in 9 (e.g. 199 MAD: 1 = 199, 2 = 289, 3 = 489, 4 = 589).
                  No promotional price is applied on top.
                </p>
              )}
            </div>
          )}

          <div className="input-group">
            <label>Name</label>
            <input type="text" name="name" value={item.name || ''} onChange={handleFieldChange} className="form-input" />
          </div>

          {isBundle && (
            <div className="input-group">
              <label>🎁 Two-Item Bundle</label>
              <BundleEditor
                choices={packChoices}
                productIds={bundleIds}
                onProductsChange={setBundleIds}
                price={item.price ?? ''}
                onPriceChange={(v) => setItem(prev => ({ ...prev, price: v }))}
              />
            </div>
          )}

          {!isBundle && (
          <div className="input-row">
            <div className="input-group">
              <label>{isBogo ? "Unit Price (MAD)" : isDeal ? "Promotional Price (MAD)" : "Price (MAD)"}</label>
              <input
                type="number"
                name="price"
                value={item.price ?? ''}
                onChange={handleFieldChange}
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
                title="Negative = units sold that still have to be bought"
                onFocus={clearZero}
              />
            </div>
          </div>
          )}

          {showVariants && (
            <CableVariantsEditor
              value={variantsState}
              onChange={setVariantsState}
              productPrice={item.price}
              productStock={item.stock}
              forDeal={isDeal}
            />
          )}

          {isDeal && !isBogo && !isBundle && (
            <div className="input-row">
              <div className="input-group">
                <label>Original Price (MAD)</label>
                <input
                  type="number"
                  name="oldPrice"
                  value={item.oldPrice ?? ''}
                  onChange={handleFieldChange}
                  className="form-input"
                  min="0.01"
                  step="0.01"
                  onFocus={clearZero}
                />
              </div>
              <div className="input-group">
                <label>Discount (auto-calculated)</label>
                <input
                  type="text"
                  value={dealDiscount !== null ? `-${dealDiscount}%` : "—"}
                  className="form-input"
                  readOnly
                  tabIndex={-1}
                />
              </div>
            </div>
          )}

          {isDeal && dealPriceError && (
            <p style={{ color: '#f87171', fontSize: '0.8125rem', margin: '-8px 0 16px' }}>{dealPriceError}</p>
          )}

          <div className="input-group">
            <label>Status</label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: 'inherit' }}>
              <input
                type="checkbox"
                checked={item.active !== false}
                onChange={(e) => setItem(prev => ({ ...prev, active: e.target.checked }))}
                style={{ width: 16, height: 16, accentColor: '#D4AF37' }}
              />
              <span>{item.active !== false ? "Active — visible in store" : isDeal ? "Inactive — hidden from store" : "Hidden — not shown in store (packs that include it still work)"}</span>
            </label>
          </div>

          <div className="input-group">
            <label>Coming soon</label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: 'inherit' }}>
              <input
                type="checkbox"
                checked={item.coming_soon === true || item.coming_soon === 1}
                onChange={(e) => setItem(prev => ({ ...prev, coming_soon: e.target.checked }))}
                style={{ width: 16, height: 16, accentColor: '#D4AF37' }}
              />
              <span>
                {item.coming_soon === true || item.coming_soon === 1
                  ? "⏳ Set as coming soon — shown in store with a \"Coming soon\" design, cannot be ordered"
                  : "Set as coming soon product"}
              </span>
            </label>
          </div>

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
            {isBundle && <p>Only the bundle is deleted — its two items stay in your catalogue.</p>}
            {bundlesWithItem.length > 0 && (
              <p style={{ color: '#f87171' }}>
                This {isDeal ? "deal" : "product"} is part of {bundlesWithItem.length === 1 ? 'the bundle' : 'the bundles'} {bundlesWithItem.map((d) => `"${d.name}"`).join(', ')},
                which will no longer be orderable.
              </p>
            )}
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

