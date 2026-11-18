// "Cable Variants" section of the product form: Lightning / USB Type-C, each with its own
// image (uploaded as a file to Laravel storage), optional price, optional stock and an on/off switch.
import { useState } from "react";
import api, { apiAssetUrl } from "../../services/api";
import { VARIANT_TYPES } from "../../utils/variants";
import "./CableVariantsEditor.css";

const blankVariant = (enabled = true) => ({ enabled, image_path: "", image_url: "", price: "", stock: "" });

/** Empty editor state for a new product. */
// eslint-disable-next-line react-refresh/only-export-components
export const emptyVariantsState = () => ({
  enabled: false,
  items: Object.fromEntries(VARIANT_TYPES.map(({ type }) => [type, blankVariant()])),
});

/** Editor state from a product returned by the API. */
// eslint-disable-next-line react-refresh/only-export-components
export const variantsStateFromProduct = (product) => {
  const state = emptyVariantsState();
  state.enabled = !!product?.has_variants;
  for (const v of product?.variants || []) {
    if (!state.items[v.type]) continue;
    state.items[v.type] = {
      enabled: v.active !== false && v.active !== 0,
      image_path: v.image_path || "",
      image_url: v.image_url || "",
      price: v.price ?? "",
      stock: v.stock ?? "",
    };
  }
  // Types the product doesn't have yet start switched off.
  if ((product?.variants || []).length) {
    for (const { type } of VARIANT_TYPES) {
      if (!(product.variants || []).some((v) => v.type === type)) state.items[type].enabled = false;
    }
  }
  return state;
};

/** Request fields for the product API. Variants without an image are not saved. */
// eslint-disable-next-line react-refresh/only-export-components
export const variantsPayload = (state) => ({
  has_variants: !!state.enabled,
  variants: VARIANT_TYPES.filter(({ type }) => state.items[type]?.image_path).map(({ type }) => {
    const v = state.items[type];
    return {
      type,
      image_path: v.image_path,
      price: v.price === "" || v.price === null ? null : Number(v.price),
      stock: v.stock === "" || v.stock === null ? null : parseInt(v.stock, 10),
      active: !!v.enabled,
    };
  }),
});

/** First problem with the variants, or "" when they can be saved. */
// eslint-disable-next-line react-refresh/only-export-components
export const validateVariants = (state) => {
  if (!state?.enabled) return "";
  const enabled = VARIANT_TYPES.filter(({ type }) => state.items[type]?.enabled);
  if (!enabled.length) return "Cable variants: enable at least one cable type, or turn cable variants off.";
  for (const { type, label } of enabled) {
    const v = state.items[type];
    if (!v.image_path) return `Cable variants: upload an image for ${label}.`;
    if (v.price !== "" && v.price !== null && !(Number(v.price) > 0)) return `Cable variants: the ${label} price must be greater than 0.`;
    if (v.stock !== "" && v.stock !== null && !(Number.isInteger(Number(v.stock)) && Number(v.stock) >= 0)) return `Cable variants: the ${label} stock must be 0 or more.`;
  }
  return "";
};

/** Resize to max 900px wide JPEG before upload (keeps files small, like the other product images). */
const compressToBlob = (file, maxWidth = 900, quality = 0.82) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#ffffff"; // transparent PNGs get a white background in JPEG
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not read image"))), "image/jpeg", quality);
      };
      img.onerror = reject;
      img.src = event.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

export default function CableVariantsEditor({ value, onChange, productPrice, productStock }) {
  const [uploading, setUploading] = useState({});
  const [errors, setErrors] = useState({});

  const setItem = (type, patch) =>
    onChange({ ...value, items: { ...value.items, [type]: { ...value.items[type], ...patch } } });

  const handleFile = async (type, file) => {
    if (!file) return;
    setUploading((u) => ({ ...u, [type]: true }));
    setErrors((e) => ({ ...e, [type]: "" }));
    try {
      const blob = await compressToBlob(file);
      const res = await api.uploadVariantImage(blob, `${type}.jpg`);
      onChange({ ...value, items: { ...value.items, [type]: { ...value.items[type], image_path: res.path, image_url: res.url } } });
    } catch (err) {
      setErrors((e) => ({ ...e, [type]: err?.message || "Upload failed. Please try again." }));
    } finally {
      setUploading((u) => ({ ...u, [type]: false }));
    }
  };

  return (
    <div className="input-group cable-variants">
      <label>🔌 Cable Variants (optional)</label>
      <p className="field-hint">
        Sell one cable listing with a choice of connector. Customers pick Lightning or USB Type-C on the product page and the
        chosen type is saved in the order.
      </p>

      <label className="cv-toggle">
        <input type="checkbox" checked={!!value.enabled} onChange={(e) => onChange({ ...value, enabled: e.target.checked })} />
        <span>{value.enabled ? "Cable variants enabled" : "Enable cable variants for this product"}</span>
      </label>

      {value.enabled && (
        <div className="cv-grid">
          {VARIANT_TYPES.map(({ type, label }) => {
            const v = value.items[type];
            const preview = apiAssetUrl(v.image_url);
            return (
              <div key={type} className={`cv-card${v.enabled ? "" : " cv-card--off"}`}>
                <div className="cv-card-head">
                  <strong>{label}</strong>
                  <label className="cv-switch">
                    <input type="checkbox" checked={!!v.enabled} onChange={(e) => setItem(type, { enabled: e.target.checked })} />
                    <span>{v.enabled ? "Available" : "Disabled"}</span>
                  </label>
                </div>

                <label className={`file-upload-box cv-upload${preview ? " has-image" : ""}`}>
                  <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => { handleFile(type, e.target.files?.[0]); e.target.value = ""; }} />
                  {preview ? (
                    <img src={preview} alt={`${label} cable`} className="cv-preview" />
                  ) : (
                    <div className="upload-content">
                      <span>📁</span>
                      <p>{uploading[type] ? "Uploading…" : `Upload ${label} image`}</p>
                    </div>
                  )}
                  {preview && <span className="cv-replace">{uploading[type] ? "Uploading…" : "Click to replace"}</span>}
                </label>
                {errors[type] && <p className="cv-error">{errors[type]}</p>}

                <div className="input-row">
                  <div className="input-group">
                    <label>Price (MAD)</label>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      placeholder={productPrice ? `${productPrice} (product price)` : "Product price"}
                      value={v.price}
                      onChange={(e) => setItem(type, { price: e.target.value })}
                      className="form-input"
                    />
                  </div>
                  <div className="input-group">
                    <label>Stock</label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      placeholder={productStock !== undefined && productStock !== "" ? `${productStock} (shared)` : "Shared stock"}
                      value={v.stock}
                      onChange={(e) => setItem(type, { stock: e.target.value })}
                      className="form-input"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {value.enabled && (
        <p className="field-hint">Leave price or stock empty to use the product's own price / stock.</p>
      )}
    </div>
  );
}
