// src/Dashboard/Pages/AddProducts.jsx
import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import api from "../../services/api";
import "./AddProducts.css";

/* ================= SAFE ID GENERATOR ================= */
const generateId = () => {
  try {
    return crypto.randomUUID();
  } catch {
    // Fallback for insecure contexts (HTTP over IP)
    return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 11);
  }
};

/* ================= IMAGE COMPRESSION ================= */
const compressImage = (file, maxWidth = 600, quality = 0.7) => {
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

        // Resize if too large
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        const compressedDataUrl = canvas.toDataURL("image/png");
        resolve(compressedDataUrl);
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
};

export default function AddProduct() {
  const context = useOutletContext() || {};
  const setProductsList = context.setProductsList || (() => {});
  const setDealsList = context.setDealsList || (() => {});

  const categories = [
    { value: "batteries", label: "Power Banks & Chargers" },
    { value: "watches", label: "Smart watches" },
    { value: "headphones", label: "Headphones" },
    { value: "pods", label: "Bluetooth earbuds" },
    { value: "speakers", label: "Speakers" },
    { value: "gaming", label: "Gaming Accessories" },
    { value: "golden", label: "Best Deals" }
  ];

  const [selectedDealCategories, setSelectedDealCategories] = useState(["golden"]); // Best Deals is always included

  /* ================= NORMAL PRODUCTS ================= */

  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState({ fr: "", en: "", ar: "" });
  const [stock, setStock] = useState("");
  const [productImages, setProductImages] = useState([null, null, null]);
  const [reviews, setReviews] = useState({ fr: "", en: "", ar: "" });
  const [category, setCategory] = useState(categories[0].value);

  // Dynamic specs table rows
  const [specs, setSpecs] = useState([{ label: "", value: "" }]);

  // Gallery info images (separate from product images)
  const [galleryItems, setGalleryItems] = useState([{ image: null, text: { fr: "", en: "", ar: "" } }]);

  /* ================= DEALS ================= */

  const [dealName, setDealName] = useState("");
  const [dealOldPrice, setDealOldPrice] = useState("");
  const [dealDiscount, setDealDiscount] = useState("");

  const [dealDescription, setDealDescription] = useState({ fr: "", en: "", ar: "" });
  const [dealStock, setDealStock] = useState("");

  const [dealImages, setDealImages] = useState([null, null, null]);
  const [dealReviews, setDealReviews] = useState({ fr: "", en: "", ar: "" }); 

  // Deal specs & gallery
  const [dealSpecs, setDealSpecs] = useState([{ label: "", value: "" }]);
  const [dealGalleryItems, setDealGalleryItems] = useState([{ image: null, text: { fr: "", en: "", ar: "" } }]);


  /* ================= ADD PRODUCT ================= */

  const handleAddProduct = async () => {
    if (!name.trim() || !price) {
      alert("Enter product name and price");
      return;
    }

    const numericPrice = parseFloat(price);

    if (numericPrice <= 0) {
      alert("Price must be greater than 0");
      return;
    }

    // Compress images
    const images = [];
    for (const imgFile of productImages.filter(Boolean)) {
      try {
        const base64 = await compressImage(imgFile, 600, 0.7);
        images.push(base64);
      } catch (error) {
        console.error("Error compressing image:", error);
      }
    }

    // Compress gallery info images
    const galleryData = [];
    for (const item of galleryItems) {
      if (item.image) {
        try {
          const base64 = await compressImage(item.image, 800, 0.75);
          galleryData.push({
            image: base64,
            text: {
              fr: (item.text?.fr || '').trim(),
              en: (item.text?.en || '').trim(),
              ar: (item.text?.ar || '').trim(),
            }
          });
        } catch (error) {
          console.error("Error compressing gallery image:", error);
        }
      }
    }

    // Filter out empty spec rows
    const specsData = specs
      .filter(s => s.label.trim() || s.value.trim())
      .map(s => ({ label: s.label.trim(), value: s.value.trim() }));

    const newProduct = {
      id: generateId(),
      name: name.trim(),
      price: numericPrice,
      description: {
        fr: description.fr.trim(),
        en: description.en.trim(),
        ar: description.ar.trim(),
      },
      stock: stock ? parseInt(stock) : 0,
      category,
      images,
      reviews: {
        fr: reviews.fr.trim(),
        en: reviews.en.trim(),
        ar: reviews.ar.trim(),
      },
      specs: specsData,
      gallery: galleryData,
    };

    try {
      // Save to database
      const dbResult = await api.addProduct(newProduct);
      
      // Also save to localStorage for instant UI update
      let currentProducts = [];
      try {
        const saved = localStorage.getItem("ElectroPheuria_products");
        if (saved) {
          currentProducts = JSON.parse(saved);
        }
      } catch (e) {
        console.error("Error reading products:", e);
        currentProducts = [];
      }

      const productWithDbId = { ...newProduct, dbId: dbResult.id };
      localStorage.setItem("ElectroPheuria_products", JSON.stringify([...currentProducts, productWithDbId]));
      setProductsList((prev) => [...prev, productWithDbId]);
      window.dispatchEvent(new CustomEvent('productsUpdated'));

      alert('Product added successfully!');

      // Reset fields
      setName("");
      setPrice("");
      setDescription({ fr: "", en: "", ar: "" });
      setStock("");
      setProductImages([null, null, null]);
      setReviews({ fr: "", en: "", ar: "" });
      setCategory(categories[0].value);
      setSpecs([{ label: "", value: "" }]);
      setGalleryItems([{ image: null, text: { fr: "", en: "", ar: "" } }]);
    } catch (error) {
      if (error.name === "QuotaExceededError") {
        alert("Storage full! Please clear some products or use smaller images.");
      } else {
        console.error("Error saving product:", error);
        alert("Error saving product. Please try again.");
      }
    }
  };

  /* ================= ADD DEAL ================= */

  const handleAddDeal = async () => {
    if (!dealName.trim() || !dealOldPrice || !dealDiscount) {
      alert("Please fill deal name, original price, and discount");
      return;
    }

    const oldPrice = parseFloat(dealOldPrice);
    const discountValue = parseFloat(dealDiscount);

    if (oldPrice <= 0) {
      alert("Original price must be greater than 0");
      return;
    }

    if (discountValue < 0 || discountValue > 90) {
      alert("Discount must be between 0% and 90%");
      return;
    }

    const discountedPrice = oldPrice - (oldPrice * discountValue) / 100;

    // Compress images
    const images = [];
    for (const imgFile of dealImages.filter(Boolean)) {
      try {
        const base64 = await compressImage(imgFile, 600, 0.7);
        images.push(base64);
      } catch (error) {
        console.error("Error compressing image:", error);
      }
    }

    // Compress deal gallery info images
    const dealGalleryData = [];
    for (const item of dealGalleryItems) {
      if (item.image) {
        try {
          const base64 = await compressImage(item.image, 800, 0.75);
          dealGalleryData.push({
            image: base64,
            text: {
              fr: (item.text?.fr || '').trim(),
              en: (item.text?.en || '').trim(),
              ar: (item.text?.ar || '').trim(),
            }
          });
        } catch (error) {
          console.error("Error compressing deal gallery image:", error);
        }
      }
    }

    // Filter out empty deal spec rows
    const dealSpecsData = dealSpecs
      .filter(s => s.label.trim() || s.value.trim())
      .map(s => ({ label: s.label.trim(), value: s.value.trim() }));

    const newDeal = {
      id: generateId(),
      name: dealName.trim(),
      oldPrice,
      discount: discountValue,
      price: parseFloat(discountedPrice.toFixed(2)),
      description: {
        fr: dealDescription.fr.trim(),
        en: dealDescription.en.trim(),
        ar: dealDescription.ar.trim(),
      },
      stock: dealStock ? parseInt(dealStock) : 0,
      categories: selectedDealCategories,
      images,
      reviews: {
        fr: dealReviews.fr.trim(),
        en: dealReviews.en.trim(),
        ar: dealReviews.ar.trim(),
      },
      specs: dealSpecsData,
      gallery: dealGalleryData,
    };

    try {
      // Save to database
      const dbResult = await api.addDeal(newDeal);

      // Also save to localStorage for instant UI update
      let currentDeals = [];
      try {
        const saved = localStorage.getItem("ElectroPheuria_deals");
        if (saved) {
          currentDeals = JSON.parse(saved);
        }
      } catch (e) {
        console.error("Error reading deals:", e);
        currentDeals = [];
      }

      const dealWithDbId = { ...newDeal, dbId: dbResult.id };
      localStorage.setItem("ElectroPheuria_deals", JSON.stringify([...currentDeals, dealWithDbId]));
      setDealsList((prev) => [...prev, dealWithDbId]);

      // Dispatch event to notify Home page
      window.dispatchEvent(new Event('dealsUpdated'));

      alert('Deal added successfully!');

      // Reset fields
      setDealName("");
      setDealOldPrice("");
      setDealDiscount("");
      setDealImages([null, null, null]);
      setDealDescription({ fr: "", en: "", ar: "" });
      setDealStock("");
      setSelectedDealCategories(["golden"]);
      setDealReviews({ fr: "", en: "", ar: "" });
      setDealSpecs([{ label: "", value: "" }]);
      setDealGalleryItems([{ image: null, text: { fr: "", en: "", ar: "" } }]);
    } catch (error) {
      if (error.name === "QuotaExceededError") {
        alert("Storage full! Please clear some deals or use smaller images.");
      } else {
        console.error("Error saving deal:", error);
        alert(`Error saving deal: ${error.data?.message || error.message || 'Unknown error'}`);
      }
    }
  };

  /* ================= PREVIEW CALCULATION ================= */

  const calculatePreview = () => {
    if (!dealOldPrice || !dealDiscount) return null;

    const oldP = parseFloat(dealOldPrice);
    const discount = parseFloat(dealDiscount);
    const newP = oldP - (oldP * discount) / 100;

    return { oldP, discount, newP: newP.toFixed(2) };
  };

  const [activeTab, setActiveTab] = useState("product");

  const preview = calculatePreview();

  return (
    <main className="add-product-main">
      {/* ================= PAGE TITLE ================= */}
      <div className="section-header">
        <h2 className="section-title">{activeTab === "product" ? "Add Product" : "Add Deals"}</h2>
      </div>

      {/* ================= MODE SWITCH ================= */}
      <div className="mode-switch-wrapper">
        <div className="mode-switch">
          <button
            className={`mode-switch-btn ${activeTab === "product" ? "active" : ""}`}
            onClick={() => setActiveTab("product")}
          >
            <span className="mode-icon">📦</span> Add Product
          </button>
          <button
            className={`mode-switch-btn ${activeTab === "deal" ? "active" : ""}`}
            onClick={() => setActiveTab("deal")}
          >
            <span className="mode-icon">⚡</span> Add Deal
          </button>
          <div className={`mode-switch-slider ${activeTab === "deal" ? "slide-right" : ""}`} />
        </div>
      </div>

      {/* ================= PRODUCTS ================= */}

      {activeTab === "product" && (
      <section className="add-product-section">

        <div className="form-card product-form-card">
          <div className="form-icon">📦</div>

          <div className="form-container">
            <div className="input-group">
              <label>Product Name</label>
              <input
                type="text"
                placeholder="Enter product name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="form-input"
              />
            </div>

            <div className="input-row">
              <div className="input-group">
                <label>Price (MAD)</label>
                <input
                  type="number"
                  placeholder="0.00"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="form-input"
                />
              </div>

              <div className="input-group">
                <label>Stock</label>
                <input
                  type="number"
                  placeholder="0"
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                  className="form-input"
                />
              </div>
            </div>

            <div className="input-group">
              <label>Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="form-select"
              >
                {categories.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>

            <div className="input-group">
              <label>Description</label>
              <div className="lang-fields">
                <div className="lang-field">
                  <span className="lang-badge">FR</span>
                  <textarea
                    placeholder="Description en français"
                    value={description.fr}
                    onChange={(e) => setDescription(prev => ({ ...prev, fr: e.target.value }))}
                    className="form-textarea"
                    rows="2"
                  />
                </div>
                <div className="lang-field">
                  <span className="lang-badge">EN</span>
                  <textarea
                    placeholder="Description in English"
                    value={description.en}
                    onChange={(e) => setDescription(prev => ({ ...prev, en: e.target.value }))}
                    className="form-textarea"
                    rows="2"
                  />
                </div>
                <div className="lang-field">
                  <span className="lang-badge lang-badge-ar">AR</span>
                  <textarea
                    placeholder="الوصف بالعربية"
                    value={description.ar}
                    onChange={(e) => setDescription(prev => ({ ...prev, ar: e.target.value }))}
                    className="form-textarea"
                    rows="2"
                    dir="rtl"
                  />
                </div>
              </div>
            </div>

            <div className="input-group">
              <label>Product Images (minimum 3, add more below)</label>
              {productImages.map((img, i) => (
                <div key={i} className="dynamic-image-row">
                  <label className="file-upload-box">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const updated = [...productImages];
                        updated[i] = e.target.files?.[0] || null;
                        setProductImages(updated);
                      }}
                    />
                    <div className="upload-content">
                      <span>📁</span>
                      <p>{img ? `Selected: ${img.name}` : `Click to choose image ${i + 1}`}</p>
                    </div>
                  </label>
                  {productImages.length > 3 && (
                    <button type="button" className="spec-remove-btn" onClick={() => setProductImages(productImages.filter((_, j) => j !== i))}>✕</button>
                  )}
                </div>
              ))}
              <button type="button" className="spec-add-btn" onClick={() => setProductImages([...productImages, null])}>+ Add Image</button>
            </div>

            <div className="input-group">
              <label>Additional Product Info (optional)</label>
              <div className="lang-fields">
                <div className="lang-field">
                  <span className="lang-badge">FR</span>
                  <textarea
                    placeholder="Plus d'infos sur le produit"
                    value={reviews.fr}
                    onChange={(e) => setReviews(prev => ({ ...prev, fr: e.target.value }))}
                    className="form-textarea"
                    rows="2"
                  />
                </div>
                <div className="lang-field">
                  <span className="lang-badge">EN</span>
                  <textarea
                    placeholder="More info about the product"
                    value={reviews.en}
                    onChange={(e) => setReviews(prev => ({ ...prev, en: e.target.value }))}
                    className="form-textarea"
                    rows="2"
                  />
                </div>
                <div className="lang-field">
                  <span className="lang-badge lang-badge-ar">AR</span>
                  <textarea
                    placeholder="معلومات إضافية عن المنتج"
                    value={reviews.ar}
                    onChange={(e) => setReviews(prev => ({ ...prev, ar: e.target.value }))}
                    className="form-textarea"
                    rows="2"
                    dir="rtl"
                  />
                </div>
              </div>
            </div>

            {/* ================= SPECS TABLE BUILDER ================= */}
            <div className="input-group">
              <label>📋 Product Specifications Table</label>
              <p className="field-hint">Add rows for the product details table (e.g. Weight, Color, Battery...)</p>
              <div className="specs-builder">
                {specs.map((row, i) => (
                  <div key={i} className="spec-row-input">
                    <input
                      type="text"
                      placeholder="Label (e.g. Weight)"
                      value={row.label}
                      onChange={(e) => {
                        const updated = [...specs];
                        updated[i] = { ...updated[i], label: e.target.value };
                        setSpecs(updated);
                      }}
                      className="form-input spec-label-input"
                    />
                    <input
                      type="text"
                      placeholder="Value (e.g. 250g)"
                      value={row.value}
                      onChange={(e) => {
                        const updated = [...specs];
                        updated[i] = { ...updated[i], value: e.target.value };
                        setSpecs(updated);
                      }}
                      className="form-input spec-value-input"
                    />
                    {specs.length > 1 && (
                      <button
                        type="button"
                        className="spec-remove-btn"
                        onClick={() => setSpecs(specs.filter((_, j) => j !== i))}
                      >✕</button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  className="spec-add-btn"
                  onClick={() => setSpecs([...specs, { label: "", value: "" }])}
                >
                  + Add Row
                </button>
              </div>
            </div>

            {/* ================= GALLERY INFO IMAGES ================= */}
            <div className="input-group">
              <label>🖼️ Gallery Info Images</label>
              <p className="field-hint">Add extra images with descriptions that show while scrolling the product page (separate from main product images)</p>
              <div className="gallery-builder">
                {galleryItems.map((item, i) => (
                  <div key={i} className="gallery-item-input">
                    <div className="gallery-item-header">
                      <span className="gallery-item-number">Image {i + 1}</span>
                      {galleryItems.length > 1 && (
                        <button
                          type="button"
                          className="spec-remove-btn"
                          onClick={() => setGalleryItems(galleryItems.filter((_, j) => j !== i))}
                        >✕</button>
                      )}
                    </div>
                    <label className="file-upload-box gallery-upload">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const updated = [...galleryItems];
                          updated[i] = { ...updated[i], image: e.target.files?.[0] || null };
                          setGalleryItems(updated);
                        }}
                      />
                      <div className="upload-content">
                        <span>🖼️</span>
                        <p>{item.image ? `Selected: ${item.image.name}` : "Click to choose gallery image"}</p>
                      </div>
                    </label>
                    <div className="lang-fields">
                      <div className="lang-field">
                        <span className="lang-badge">FR</span>
                        <textarea
                          placeholder="Texte sous l'image (optionnel)"
                          value={item.text?.fr || ''}
                          onChange={(e) => {
                            const updated = [...galleryItems];
                            updated[i] = { ...updated[i], text: { ...(updated[i].text || {}), fr: e.target.value } };
                            setGalleryItems(updated);
                          }}
                          className="form-textarea"
                          rows="2"
                        />
                      </div>
                      <div className="lang-field">
                        <span className="lang-badge">EN</span>
                        <textarea
                          placeholder="Text below this image (optional)"
                          value={item.text?.en || ''}
                          onChange={(e) => {
                            const updated = [...galleryItems];
                            updated[i] = { ...updated[i], text: { ...(updated[i].text || {}), en: e.target.value } };
                            setGalleryItems(updated);
                          }}
                          className="form-textarea"
                          rows="2"
                        />
                      </div>
                      <div className="lang-field">
                        <span className="lang-badge lang-badge-ar">AR</span>
                        <textarea
                          placeholder="نص أسفل الصورة (اختياري)"
                          value={item.text?.ar || ''}
                          onChange={(e) => {
                            const updated = [...galleryItems];
                            updated[i] = { ...updated[i], text: { ...(updated[i].text || {}), ar: e.target.value } };
                            setGalleryItems(updated);
                          }}
                          className="form-textarea"
                          rows="2"
                          dir="rtl"
                        />
                      </div>
                    </div>
                  </div>
                ))}
                {galleryItems.length < 10 && (
                  <button
                    type="button"
                    className="spec-add-btn"
                    onClick={() => setGalleryItems([...galleryItems, { image: null, text: { fr: "", en: "", ar: "" } }])}
                  >
                    + Add Gallery Image
                  </button>
                )}
              </div>
            </div>

            <button onClick={handleAddProduct} className="form-button product-btn">
              <span>➕</span> Add Product
            </button>
          </div>
        </div>
      </section>
      )}

      {/* ================= DEALS ================= */}

      {activeTab === "deal" && (
      <section className="add-deal-section">

        <div className="form-card deal-form-card">
          <div className="deal-badge">� EXCLUSIVE OFFER</div>
          <div className="form-icon deal-icon">⚡</div>

          <div className="form-container">
            <div className="input-group">
              <label>Deal Name</label>
              <input
                type="text"
                placeholder="Enter deal name"
                value={dealName}
                onChange={(e) => setDealName(e.target.value)}
                className="form-input deal-input"
              />
            </div>

            <div className="input-row">
              <div className="input-group">
                <label>Original Price (MAD)</label>
                <input
                  type="number"
                  placeholder="0.00"
                  value={dealOldPrice}
                  onChange={(e) => setDealOldPrice(e.target.value)}
                  className="form-input deal-input"
                  min="0"
                />
              </div>

              <div className="input-group">
                <label>Discount (%)</label>
                <input
                  type="number"
                  placeholder="0"
                  value={dealDiscount}
                  onChange={(e) => setDealDiscount(e.target.value)}
                  className="form-input deal-input"
                />
              </div>
            </div>

            <div className="deal-preview">
              {preview ? (
                <div className="preview-content">
                  <span className="preview-label">Price Preview:</span>
                  <div className="preview-prices">
                    <span className="preview-old">{preview.oldP.toFixed(2)} MAD</span>
                    <span className="preview-discount">-{preview.discount}%</span>
                    <span className="preview-new">{preview.newP} MAD</span>
                  </div>
                </div>
              ) : (
                <p className="preview-placeholder">Enter original price and discount to see preview</p>
              )}
            </div>

            <div className="input-group">
              <label>Description</label>
              <div className="lang-fields">
                <div className="lang-field">
                  <span className="lang-badge">FR</span>
                  <textarea
                    placeholder="Description en français"
                    value={dealDescription.fr}
                    onChange={(e) => setDealDescription(prev => ({ ...prev, fr: e.target.value }))}
                    className="form-textarea deal-textarea"
                    rows="2"
                  />
                </div>
                <div className="lang-field">
                  <span className="lang-badge">EN</span>
                  <textarea
                    placeholder="Description in English"
                    value={dealDescription.en}
                    onChange={(e) => setDealDescription(prev => ({ ...prev, en: e.target.value }))}
                    className="form-textarea deal-textarea"
                    rows="2"
                  />
                </div>
                <div className="lang-field">
                  <span className="lang-badge lang-badge-ar">AR</span>
                  <textarea
                    placeholder="الوصف بالعربية"
                    value={dealDescription.ar}
                    onChange={(e) => setDealDescription(prev => ({ ...prev, ar: e.target.value }))}
                    className="form-textarea deal-textarea"
                    rows="2"
                    dir="rtl"
                  />
                </div>
              </div>
            </div>

            <div className="input-group">
              <label>Stock</label>
              <input
                type="number"
                placeholder="0"
                value={dealStock}
                onChange={(e) => setDealStock(e.target.value)}
                className="form-input deal-input"
              />
            </div>

            <div className="input-group">
              <label>Categories (Multi-select for deals) - Best Deals is automatic</label>
              <div className="categories-checkboxes">
                {categories.filter(cat => cat.value !== "golden").map((cat) => (
                  <label key={cat.value} className="category-checkbox">
                    <input
                      type="checkbox"
                      value={cat.value}
                      checked={selectedDealCategories.includes(cat.value)}
                      onChange={(e) => {
                        const value = e.target.value;
                        setSelectedDealCategories(prev =>
                          prev.includes(value)
                            ? prev.filter(c => c !== value)
                            : [...prev, value]
                        );
                      }}
                    />
                    {cat.label}
                  </label>
                ))}
              </div>
            </div>

            <div className="input-group">
              <label>Additional Product Info (optional)</label>
              <div className="lang-fields">
                <div className="lang-field">
                  <span className="lang-badge">FR</span>
                  <textarea
                    placeholder="Plus d'infos sur le produit"
                    value={dealReviews.fr}
                    onChange={(e) => setDealReviews(prev => ({ ...prev, fr: e.target.value }))}
                    className="form-textarea deal-textarea"
                    rows="2"
                  />
                </div>
                <div className="lang-field">
                  <span className="lang-badge">EN</span>
                  <textarea
                    placeholder="More info about the product"
                    value={dealReviews.en}
                    onChange={(e) => setDealReviews(prev => ({ ...prev, en: e.target.value }))}
                    className="form-textarea deal-textarea"
                    rows="2"
                  />
                </div>
                <div className="lang-field">
                  <span className="lang-badge lang-badge-ar">AR</span>
                  <textarea
                    placeholder="معلومات إضافية عن المنتج"
                    value={dealReviews.ar}
                    onChange={(e) => setDealReviews(prev => ({ ...prev, ar: e.target.value }))}
                    className="form-textarea deal-textarea"
                    rows="2"
                    dir="rtl"
                  />
                </div>
              </div>
            </div>

            <div className="input-group">
              <label>Deal Images (minimum 3, add more below)</label>
              {dealImages.map((img, i) => (
                <div key={i} className="dynamic-image-row">
                  <label className="file-upload-box">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const updated = [...dealImages];
                        updated[i] = e.target.files?.[0] || null;
                        setDealImages(updated);
                      }}
                    />
                    <div className="upload-content">
                      <span>📁</span>
                      <p>{img ? `Selected: ${img.name}` : `Click to choose image ${i + 1}`}</p>
                    </div>
                  </label>
                  {dealImages.length > 3 && (
                    <button type="button" className="spec-remove-btn" onClick={() => setDealImages(dealImages.filter((_, j) => j !== i))}>✕</button>
                  )}
                </div>
              ))}
              <button type="button" className="spec-add-btn" onClick={() => setDealImages([...dealImages, null])}>+ Add Image</button>
            </div>

            {/* ================= DEAL SPECS TABLE BUILDER ================= */}
            <div className="input-group">
              <label>📋 Product Specifications Table</label>
              <p className="field-hint">Add rows for the product details table (e.g. Weight, Color, Battery...)</p>
              <div className="specs-builder">
                {dealSpecs.map((row, i) => (
                  <div key={i} className="spec-row-input">
                    <input
                      type="text"
                      placeholder="Label (e.g. Weight)"
                      value={row.label}
                      onChange={(e) => {
                        const updated = [...dealSpecs];
                        updated[i] = { ...updated[i], label: e.target.value };
                        setDealSpecs(updated);
                      }}
                      className="form-input spec-label-input"
                    />
                    <input
                      type="text"
                      placeholder="Value (e.g. 250g)"
                      value={row.value}
                      onChange={(e) => {
                        const updated = [...dealSpecs];
                        updated[i] = { ...updated[i], value: e.target.value };
                        setDealSpecs(updated);
                      }}
                      className="form-input spec-value-input"
                    />
                    {dealSpecs.length > 1 && (
                      <button
                        type="button"
                        className="spec-remove-btn"
                        onClick={() => setDealSpecs(dealSpecs.filter((_, j) => j !== i))}
                      >✕</button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  className="spec-add-btn"
                  onClick={() => setDealSpecs([...dealSpecs, { label: "", value: "" }])}
                >
                  + Add Row
                </button>
              </div>
            </div>

            {/* ================= DEAL GALLERY INFO IMAGES ================= */}
            <div className="input-group">
              <label>🖼️ Gallery Info Images</label>
              <p className="field-hint">Add extra images with descriptions that show while scrolling the deal page</p>
              <div className="gallery-builder">
                {dealGalleryItems.map((item, i) => (
                  <div key={i} className="gallery-item-input">
                    <div className="gallery-item-header">
                      <span className="gallery-item-number">Image {i + 1}</span>
                      {dealGalleryItems.length > 1 && (
                        <button
                          type="button"
                          className="spec-remove-btn"
                          onClick={() => setDealGalleryItems(dealGalleryItems.filter((_, j) => j !== i))}
                        >✕</button>
                      )}
                    </div>
                    <label className="file-upload-box gallery-upload">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const updated = [...dealGalleryItems];
                          updated[i] = { ...updated[i], image: e.target.files?.[0] || null };
                          setDealGalleryItems(updated);
                        }}
                      />
                      <div className="upload-content">
                        <span>🖼️</span>
                        <p>{item.image ? `Selected: ${item.image.name}` : "Click to choose gallery image"}</p>
                      </div>
                    </label>
                    <div className="lang-fields">
                      <div className="lang-field">
                        <span className="lang-badge">FR</span>
                        <textarea
                          placeholder="Texte sous l'image (optionnel)"
                          value={item.text?.fr || ''}
                          onChange={(e) => {
                            const updated = [...dealGalleryItems];
                            updated[i] = { ...updated[i], text: { ...(updated[i].text || {}), fr: e.target.value } };
                            setDealGalleryItems(updated);
                          }}
                          className="form-textarea deal-textarea"
                          rows="2"
                        />
                      </div>
                      <div className="lang-field">
                        <span className="lang-badge">EN</span>
                        <textarea
                          placeholder="Text below this image (optional)"
                          value={item.text?.en || ''}
                          onChange={(e) => {
                            const updated = [...dealGalleryItems];
                            updated[i] = { ...updated[i], text: { ...(updated[i].text || {}), en: e.target.value } };
                            setDealGalleryItems(updated);
                          }}
                          className="form-textarea deal-textarea"
                          rows="2"
                        />
                      </div>
                      <div className="lang-field">
                        <span className="lang-badge lang-badge-ar">AR</span>
                        <textarea
                          placeholder="نص أسفل الصورة (اختياري)"
                          value={item.text?.ar || ''}
                          onChange={(e) => {
                            const updated = [...dealGalleryItems];
                            updated[i] = { ...updated[i], text: { ...(updated[i].text || {}), ar: e.target.value } };
                            setDealGalleryItems(updated);
                          }}
                          className="form-textarea deal-textarea"
                          rows="2"
                          dir="rtl"
                        />
                      </div>
                    </div>
                  </div>
                ))}
                {dealGalleryItems.length < 10 && (
                  <button
                    type="button"
                    className="spec-add-btn"
                    onClick={() => setDealGalleryItems([...dealGalleryItems, { image: null, text: { fr: "", en: "", ar: "" } }])}
                  >
                    + Add Gallery Image
                  </button>
                )}
              </div>
            </div>

            <button onClick={handleAddDeal} className="form-button deal-btn">
              <span>⚡</span> Add Deal
            </button>
          </div>
        </div>
      </section>
      )}
    </main>
  );
}