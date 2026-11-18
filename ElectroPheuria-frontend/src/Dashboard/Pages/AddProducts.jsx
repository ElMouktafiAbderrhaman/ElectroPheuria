// src/Dashboard/Pages/AddProducts.jsx
import { useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import api from "../../services/api";
import { calcDiscountPercent, validateDealPrices, lineTotal, formatPrice, OFFER_STANDARD, OFFER_BOGO_HALF, OFFER_BOGO_FIXED, validateSecondItemPrice } from "../../utils/dealPricing";
import CableVariantsEditor, { emptyVariantsState, variantsPayload, validateVariants } from "../components/CableVariantsEditor";
import BundleEditor, { validateBundle, bundleCombinedPrice, bundleChoices, bundleItemsPayload } from "../components/BundleEditor";
import { VARIANT_CATEGORIES } from "../../utils/variants";
import "./AddProducts.css";
import "./Banners.css";

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

        const compressedDataUrl = canvas.toDataURL("image/jpeg", quality);
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
  const productsList = context.productsList || [];
  const dealsList = context.dealsList || [];

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

  // Cable variants (Lightning / USB Type-C) — only for the chargers category
  const [variantsState, setVariantsState] = useState(emptyVariantsState);
  const showVariants = VARIANT_CATEGORIES.includes(category);

  /* ================= DEALS ================= */

  const [dealName, setDealName] = useState("");
  const [dealOldPrice, setDealOldPrice] = useState("");
  const [dealPrice, setDealPrice] = useState("");
  const [dealActive, setDealActive] = useState(true);
  const [dealOfferType, setDealOfferType] = useState(OFFER_STANDARD);
  const isBogoFixed = dealOfferType === OFFER_BOGO_FIXED;
  const isBogo = dealOfferType === OFFER_BOGO_HALF || isBogoFixed;
  const [dealSecondPrice, setDealSecondPrice] = useState("");
  const [dealBaseProduct, setDealBaseProduct] = useState("");
  // "single" = existing one-product deal, "bundle" = two different products for one price
  const [dealType, setDealType] = useState("single");
  const isBundle = dealType === "bundle";
  const [bundleIds, setBundleIds] = useState(["", ""]);
  // Products and existing single deals that can go into a pack.
  const packChoices = bundleChoices(productsList, dealsList);

  // Discount is always derived from the two prices the admin typed.
  const dealDiscount = calcDiscountPercent(dealOldPrice, dealPrice);
  const dealPriceError = isBogo
    ? (dealPrice !== "" && !(parseFloat(dealPrice) > 0) ? "Unit price must be a positive number."
      : isBogoFixed && dealSecondPrice !== "" ? validateSecondItemPrice(dealPrice, dealSecondPrice) : "")
    : dealOldPrice !== "" && dealPrice !== "" ? validateDealPrices(dealOldPrice, dealPrice) : "";

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

    const variantsError = showVariants ? validateVariants(variantsState) : "";
    if (variantsError) {
      alert(variantsError);
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
      ...(showVariants ? variantsPayload(variantsState) : { has_variants: false, variants: [] }),
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
      setProductsList((prev) => [...prev, productWithDbId]);
      window.dispatchEvent(new CustomEvent('productsUpdated'));
      try {
        localStorage.setItem("ElectroPheuria_products", JSON.stringify([...currentProducts, productWithDbId]));
      } catch (storageErr) {
        console.warn('localStorage full, product not cached locally');
      }

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
      setVariantsState(emptyVariantsState());
    } catch (error) {
      if (error.name === "QuotaExceededError") {
        alert("Storage full! Please clear some products or use smaller images.");
      } else {
        console.error("Error saving product:", error);
        alert(`Error saving product: ${error.message || "Please try again."}`);
      }
    }
  };

  /* ================= ADD DEAL ================= */

  const handleAddDeal = async () => {
    if (isBundle) {
      const bundleError = validateBundle(packChoices, bundleIds, dealPrice);
      if (bundleError) {
        alert(bundleError);
        return;
      }
    } else if (!dealName.trim() || !dealPrice || (!isBogo && !dealOldPrice) || (isBogoFixed && dealSecondPrice === "")) {
      alert(isBogoFixed
        ? "Please fill deal name, unit price, and the price of the second item"
        : isBogo
        ? "Please fill deal name and unit price"
        : "Please fill deal name, original price, and promotional price");
      return;
    }

    const priceError = isBundle ? "" : isBogo
      ? (parseFloat(dealPrice) > 0 ? (isBogoFixed ? validateSecondItemPrice(dealPrice, dealSecondPrice) : "") : "Unit price must be a positive number.")
      : validateDealPrices(dealOldPrice, dealPrice);
    if (priceError) {
      alert(priceError);
      return;
    }

    const promoPrice = parseFloat(parseFloat(dealPrice).toFixed(2));
    // A 1+1 deal has no promotional price, so the two offers never stack.
    // A bundle's original price is the two products' combined price (recomputed by the server).
    const oldPrice = isBundle ? bundleCombinedPrice(packChoices, bundleIds) : isBogo ? promoPrice : parseFloat(parseFloat(dealOldPrice).toFixed(2));
    const discountValue = isBogo && !isBundle ? 0 : calcDiscountPercent(oldPrice, promoPrice);

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
      price: promoPrice,
      active: dealActive,
      offer_type: isBundle ? OFFER_STANDARD : dealOfferType,
      second_item_price: isBogoFixed && !isBundle ? parseFloat(parseFloat(dealSecondPrice).toFixed(2)) : null,
      deal_type: dealType,
      ...(isBundle ? { bundle_items: bundleItemsPayload(bundleIds) } : {}),
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
      const createdDeal = await api.addDeal(newDeal);

      setDealsList((prev) => [...prev, createdDeal]);

      try {
        const saved = localStorage.getItem("ElectroPheuria_deals");
        const currentDeals = saved ? JSON.parse(saved) : [];
        localStorage.setItem("ElectroPheuria_deals", JSON.stringify([...currentDeals, createdDeal]));
      } catch (storageErr) {
        console.warn('localStorage full, deal not cached locally');
      }

      window.dispatchEvent(new Event('dealsUpdated'));
      // Offer to feature the new deal on the homepage; nothing is published without confirmation.
      setFeaturePrompt({ id: createdDeal?.id, name: dealName.trim() || newDeal.name || "Bundle" });
      // The server builds the bundle's name / prices / images: reload the list from it.
      if (isBundle) {
        api.getDeals().then((deals) => {
          setDealsList(deals);
          try { localStorage.setItem("ElectroPheuria_deals", JSON.stringify(deals)); } catch { /* full */ }
          window.dispatchEvent(new Event('dealsUpdated'));
        }).catch(() => {});
      }
      setDealType("single");
      setBundleIds(["", ""]);

      setDealName("");
      setDealOldPrice("");
      setDealPrice("");
      setDealActive(true);
      setDealOfferType(OFFER_STANDARD);
      setDealSecondPrice("");
      setDealBaseProduct("");
      setDealImages([null, null, null]);
      setDealDescription({ fr: "", en: "", ar: "" });
      setDealStock("");
      setSelectedDealCategories(["golden"]);
      setDealReviews({ fr: "", en: "", ar: "" });
      setDealSpecs([{ label: "", value: "" }]);
      setDealGalleryItems([{ image: null, text: { fr: "", en: "", ar: "" } }]);
    } catch (error) {
      console.error("Failed to create deal:", error);
      alert(`Error saving deal: ${error.message || "Unknown error"}`);
    }
  };

  /* ================= PREVIEW CALCULATION ================= */

  const calculatePreview = () => {
    if (dealDiscount === null) return null;
    return {
      oldP: parseFloat(dealOldPrice),
      discount: dealDiscount,
      newP: parseFloat(dealPrice).toFixed(2),
    };
  };

  // Optional: start a deal from an existing catalog product.
  const handleBaseProductChange = (productId) => {
    setDealBaseProduct(productId);
    const product = productsList.find((p) => String(p.id) === String(productId));
    if (!product) return;
    setDealName(product.name || "");
    if (product.price) {
      setDealOldPrice(String(product.price));
      if (isBogo) setDealPrice(String(product.price));
    }
    const desc = product.description;
    setDealDescription(
      desc && typeof desc === "object"
        ? { fr: desc.fr || "", en: desc.en || "", ar: desc.ar || "" }
        : { fr: desc || "", en: "", ar: "" }
    );
    if (Array.isArray(product.specs) && product.specs.length) {
      setDealSpecs(product.specs.map((s) => ({ label: s.label || "", value: s.value || "" })));
    }
  };

  const [activeTab, setActiveTab] = useState("product");
  const [featurePrompt, setFeaturePrompt] = useState(null);
  const navigate = useNavigate();

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

            {showVariants && (
              <CableVariantsEditor
                value={variantsState}
                onChange={setVariantsState}
                productPrice={price}
                productStock={stock}
              />
            )}

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
              <label>Deal Type</label>
              <div className="offer-type-switch" role="radiogroup">
                <label className={`offer-type-option${!isBundle ? " active" : ""}`}>
                  <input type="radio" name="dealType" checked={!isBundle} onChange={() => setDealType("single")} />
                  <span className="offer-type-title">Single Product Deal</span>
                  <span className="offer-type-desc">One product with a promotional price or a 1+1 offer</span>
                </label>
                <label className={`offer-type-option${isBundle ? " active" : ""}`}>
                  <input type="radio" name="dealType" checked={isBundle} onChange={() => setDealType("bundle")} />
                  <span className="offer-type-title">Two-Product Bundle Deal</span>
                  <span className="offer-type-desc">Two products or deals in one card, one price for both</span>
                </label>
              </div>
            </div>

            {!isBundle && (
            <div className="input-group">
              <label>Offer Type</label>
              <div className="offer-type-switch" role="radiogroup">
                <label className={`offer-type-option${!isBogo ? " active" : ""}`}>
                  <input
                    type="radio"
                    name="offerType"
                    checked={!isBogo}
                    onChange={() => setDealOfferType(OFFER_STANDARD)}
                  />
                  <span className="offer-type-title">Standard Discount</span>
                  <span className="offer-type-desc">Promotional price with a discount percentage</span>
                </label>
                <label className={`offer-type-option${dealOfferType === OFFER_BOGO_HALF ? " active" : ""}`}>
                  <input
                    type="radio"
                    name="offerType"
                    checked={dealOfferType === OFFER_BOGO_HALF}
                    onChange={() => setDealOfferType(OFFER_BOGO_HALF)}
                  />
                  <span className="offer-type-title">Buy 1, Get the 2nd at 50% Off</span>
                  <span className="offer-type-desc">Every second unit of this item is half price</span>
                </label>
                <label className={`offer-type-option${isBogoFixed ? " active" : ""}`}>
                  <input
                    type="radio"
                    name="offerType"
                    checked={isBogoFixed}
                    onChange={() => setDealOfferType(OFFER_BOGO_FIXED)}
                  />
                  <span className="offer-type-title">Buy 1, Get the 2nd for a Fixed Price</span>
                  <span className="offer-type-desc">You enter the price of the second unit (e.g. 50 MAD)</span>
                </label>
              </div>
            </div>
            )}

            {!isBundle && productsList.length > 0 && (
              <div className="input-group">
                <label>{isBogo ? "Product for this offer (optional pre-fill)" : "Base Product (optional)"}</label>
                <select
                  value={dealBaseProduct}
                  onChange={(e) => handleBaseProductChange(e.target.value)}
                  className="form-select deal-input"
                >
                  <option value="">— Start from scratch —</option>
                  {productsList.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.price} MAD)
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="input-group">
              <label>{isBundle ? "Pack Name (optional)" : "Deal Name"}</label>
              <input
                type="text"
                placeholder={isBundle ? "Leave empty for “Item 1 + Item 2”" : "Enter deal name"}
                value={dealName}
                onChange={(e) => setDealName(e.target.value)}
                className="form-input deal-input"
              />
            </div>

            {isBundle ? (
              <>
                <BundleEditor
                  choices={packChoices}
                  productIds={bundleIds}
                  onProductsChange={setBundleIds}
                  price={dealPrice}
                  onPriceChange={setDealPrice}
                />
                <div className="input-group">
                  <label>Status</label>
                  <label className="category-checkbox deal-active-toggle">
                    <input
                      type="checkbox"
                      checked={dealActive}
                      onChange={(e) => setDealActive(e.target.checked)}
                    />
                    <span>{dealActive ? "Active — visible in store" : "Inactive — hidden from store"}</span>
                  </label>
                </div>
              </>
            ) : isBogo ? (
              <>
                <div className="input-row">
                  <div className="input-group">
                    <label>Unit Price (MAD)</label>
                    <input
                      type="number"
                      placeholder="0.00"
                      value={dealPrice}
                      onChange={(e) => setDealPrice(e.target.value)}
                      className={`form-input deal-input${dealPriceError ? " input-invalid" : ""}`}
                      min="0.01"
                      step="0.01"
                    />
                  </div>

                  {isBogoFixed && (
                    <div className="input-group">
                      <label>Price of the 2nd Item (MAD)</label>
                      <input
                        type="number"
                        placeholder="e.g. 50"
                        value={dealSecondPrice}
                        onChange={(e) => setDealSecondPrice(e.target.value)}
                        className={`form-input deal-input${dealPriceError ? " input-invalid" : ""}`}
                        min="0"
                        step="0.01"
                      />
                    </div>
                  )}
                </div>

                <div className="input-row">
                  <div className="input-group">
                    <label>Status</label>
                    <label className="category-checkbox deal-active-toggle">
                      <input
                        type="checkbox"
                        checked={dealActive}
                        onChange={(e) => setDealActive(e.target.checked)}
                      />
                      <span>{dealActive ? "Active — visible in store" : "Inactive — hidden from store"}</span>
                    </label>
                  </div>
                </div>

                {dealPriceError && <p className="deal-price-error">{dealPriceError}</p>}

                <div className="deal-preview">
                  <div className="preview-content">
                    <span className="preview-label">How this offer works</span>
                    {isBogoFixed ? (
                      <p className="bogo-explain">
                        The customer pays full price for the first item and <strong>exactly {dealSecondPrice !== "" ? formatPrice(dealSecondPrice) : "X"} MAD for the second</strong>.
                        It repeats for every pair of the same item in the cart. No rounding and no promotional price is applied on top.
                      </p>
                    ) : (
                      <p className="bogo-explain">
                        The customer pays full price for the first item and <strong>50% of the price for the second</strong>.
                        It repeats for every pair of the same item in the cart, and the total is rounded down to a price ending in 9 (e.g. 298.50 → 289). No promotional price is applied on top.
                      </p>
                    )}
                    {parseFloat(dealPrice) > 0 && (!isBogoFixed || (dealSecondPrice !== "" && !dealPriceError)) ? (
                      <table className="bogo-preview-table">
                        <tbody>
                          {[1, 2, 3, 4].map((q) => {
                            const l = lineTotal({ price: dealPrice, quantity: q, offer_type: dealOfferType, second_item_price: dealSecondPrice });
                            return (
                              <tr key={q}>
                                <td>{q} item{q > 1 ? "s" : ""}</td>
                                <td className="preview-old">{l.discount > 0 ? `${formatPrice(l.subtotal)} MAD` : ""}</td>
                                <td className="preview-new">{formatPrice(l.total)} MAD</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    ) : (
                      <p className="preview-placeholder">{isBogoFixed ? "Enter the unit price and the 2nd item price" : "Enter the unit price"} to see the totals for 1–4 items</p>
                    )}
                  </div>
                </div>
              </>
            ) : (
            <>
            <div className="input-row">
              <div className="input-group">
                <label>Original Price (MAD)</label>
                <input
                  type="number"
                  placeholder="0.00"
                  value={dealOldPrice}
                  onChange={(e) => setDealOldPrice(e.target.value)}
                  className={`form-input deal-input${dealPriceError ? " input-invalid" : ""}`}
                  min="0.01"
                  step="0.01"
                />
              </div>

              <div className="input-group">
                <label>Promotional Price (MAD)</label>
                <input
                  type="number"
                  placeholder="0.00"
                  value={dealPrice}
                  onChange={(e) => setDealPrice(e.target.value)}
                  className={`form-input deal-input${dealPriceError ? " input-invalid" : ""}`}
                  min="0.01"
                  step="0.01"
                />
              </div>
            </div>

            <div className="input-row">
              <div className="input-group">
                <label>Discount (auto-calculated)</label>
                <input
                  type="text"
                  value={dealDiscount !== null ? `-${dealDiscount}%` : "—"}
                  className="form-input deal-input"
                  readOnly
                  tabIndex={-1}
                />
              </div>

              <div className="input-group">
                <label>Status</label>
                <label className="category-checkbox deal-active-toggle">
                  <input
                    type="checkbox"
                    checked={dealActive}
                    onChange={(e) => setDealActive(e.target.checked)}
                  />
                  <span>{dealActive ? "Active — visible in store" : "Inactive — hidden from store"}</span>
                </label>
              </div>
            </div>

            {dealPriceError && <p className="deal-price-error">{dealPriceError}</p>}

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
                <p className="preview-placeholder">Enter original and promotional prices to see preview</p>
              )}
            </div>
            </>
            )}

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

            {!isBundle && (
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
            )}

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
              <label>{isBundle ? "Pack Images (optional — leave empty to show the two product images)" : "Deal Images (minimum 3, add more below)"}</label>
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

      {featurePrompt && (
        <div className="bn-modal" role="dialog" aria-modal="true" aria-labelledby="feature-deal-title" onClick={() => setFeaturePrompt(null)}>
          <div className="bn-modal-box" onClick={(e) => e.stopPropagation()}>
            <h3 id="feature-deal-title">✅ Deal “{featurePrompt.name}” added</h3>
            <p>Would you like to feature this deal in a homepage banner? The banner editor opens pre-filled with the deal’s image and prices; nothing is published until you click Publish.</p>
            <div className="bn-modal-actions">
              <button type="button" className="bn-btn bn-btn--ghost" onClick={() => setFeaturePrompt(null)}>No, maybe later</button>
              <button type="button" className="bn-btn" disabled={!featurePrompt.id} onClick={() => navigate(`/dashboard/banners/new?deal=${featurePrompt.id}`)}>Yes, create a banner</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
