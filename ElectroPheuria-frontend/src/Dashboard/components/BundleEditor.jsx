// Two-item bundle configuration: pick two different items (products or existing deals), enter one pack price.
// The original price is the sum of the two items' regular prices; the discount follows from it.
// Items are referenced as "product:<id>" or "deal:<id>" so a product and a deal with the same id never clash.
import { calcDiscountPercent, formatPrice } from "../../utils/dealPricing";
import { activeVariants, variantLabel } from "../../utils/variants";
import "./BundleEditor.css";

/**
 * Database id of a product or deal. Items added in this dashboard session carry a temporary
 * browser id in `id` and the real one in `dbId`; the server only knows the real one.
 */
// eslint-disable-next-line react-refresh/only-export-components
export const productDbId = (p) => String(p?.dbId ?? p?.id ?? "");

// eslint-disable-next-line react-refresh/only-export-components
export const bundleRef = (kind, id) => (id === undefined || id === null || id === "" ? "" : `${kind}:${id}`);

/** "product:16" → { type: "product", id: 16 } */
// eslint-disable-next-line react-refresh/only-export-components
export const parseBundleRef = (ref) => {
  const [type, id] = String(ref || "").split(":");
  return type && id ? { type, id: Number(id) } : null;
};

/** Refs of a loaded bundle deal (older API answers have no `kind`: those items are products). */
// eslint-disable-next-line react-refresh/only-export-components
export const bundleRefsFromDeal = (deal) =>
  [0, 1].map((i) => {
    const item = deal?.bundle_products?.[i];
    return item ? bundleRef(item.kind || "product", item.id) : "";
  });

/** Everything that can go into a pack: all products, and single deals other than the one being edited. */
// eslint-disable-next-line react-refresh/only-export-components
export const bundleChoices = (productsList, dealsList = [], excludeDealId = null) => [
  ...productsList
    .filter((p) => productDbId(p) !== "")
    .map((p) => ({
      ref: bundleRef("product", productDbId(p)),
      kind: "product",
      name: p.name,
      price: Number(p.price || 0),
      stock: p.stock ?? 0,
      image: p.images?.[0] || null,
      cables: activeVariants(p).map(variantLabel),
    })),
  ...dealsList
    .filter((d) => d.deal_type !== "bundle" && productDbId(d) !== "" && productDbId(d) !== String(excludeDealId ?? ""))
    .map((d) => ({
      ref: bundleRef("deal", productDbId(d)),
      kind: "deal",
      name: d.name,
      price: Number(d.price || 0),
      stock: d.stock ?? 0,
      image: d.images?.[0] || null,
      cables: [],
    })),
];

/** API payload for the two selected items. */
// eslint-disable-next-line react-refresh/only-export-components
export const bundleItemsPayload = (refs) => refs.map(parseBundleRef);

/** Original (combined) price of the two selected items, or null. */
// eslint-disable-next-line react-refresh/only-export-components
export const bundleCombinedPrice = (choices, refs) => {
  const picked = refs.map((ref) => choices.find((c) => c.ref === ref)).filter(Boolean);
  if (picked.length !== 2) return null;
  return Math.round(picked.reduce((sum, c) => sum + c.price, 0) * 100) / 100;
};

/** First problem with the bundle, or "" when it can be saved. */
// eslint-disable-next-line react-refresh/only-export-components
export const validateBundle = (choices, refs, price) => {
  if (!refs[0] || !refs[1]) return "Select the two items of the bundle.";
  if (refs[0] === refs[1]) return "Select two different items.";
  const combined = bundleCombinedPrice(choices, refs);
  if (combined === null) return "One of the selected items no longer exists.";
  const p = Number(price);
  if (!(p > 0)) return "Enter the bundle promotional price.";
  if (p >= combined) return `The bundle price must be lower than the combined price (${formatPrice(combined)} MAD).`;
  return "";
};

export default function BundleEditor({ choices, productIds, onProductsChange, price, onPriceChange }) {
  const products = choices.filter((c) => c.kind === "product");
  const deals = choices.filter((c) => c.kind === "deal");
  const picked = productIds.map((ref) => choices.find((c) => c.ref === ref) || null);
  const combined = bundleCombinedPrice(choices, productIds);
  const discount = combined !== null ? calcDiscountPercent(combined, price) : null;
  const error = productIds[0] && productIds[1] && price !== "" ? validateBundle(choices, productIds, price) : "";

  const setRef = (index, ref) => {
    const next = [...productIds];
    next[index] = ref;
    onProductsChange(next);
  };

  if (choices.length < 2) {
    return (
      <p className="deal-price-error">
        You need at least two products or deals to create a bundle. Add them in “Add Product” first.
      </p>
    );
  }

  const option = (c, i) => (
    <option key={c.ref} value={c.ref} disabled={c.ref === productIds[1 - i]}>
      {c.name} ({formatPrice(c.price)} MAD){c.cables.length > 0 ? " — customer picks cable" : ""}
    </option>
  );

  return (
    <div className="bundle-editor">
      <div className="input-row">
        {[0, 1].map((i) => (
          <div key={i} className="input-group">
            <label>Item {i + 1}</label>
            <select
              value={productIds[i] || ""}
              onChange={(e) => setRef(i, e.target.value)}
              className="form-select deal-input"
            >
              <option value="">— Select item {i + 1} —</option>
              {products.length > 0 && <optgroup label="Products">{products.map((c) => option(c, i))}</optgroup>}
              {deals.length > 0 && <optgroup label="Deals">{deals.map((c) => option(c, i))}</optgroup>}
            </select>
          </div>
        ))}
      </div>

      <div className="bundle-picked">
        {picked.map((c, i) => (
          <div key={i} className={`bundle-picked-card${c ? "" : " empty"}`}>
            {c ? (
              <>
                {c.image ? <img src={c.image} alt="" /> : <span className="bundle-picked-noimg">📦</span>}
                <div>
                  <strong>{c.name}</strong>
                  <span>
                    {c.kind === "deal" ? "Deal · " : ""}{formatPrice(c.price)} MAD · stock {c.stock}
                  </span>
                  {c.cables.length > 0 && <span className="bundle-picked-cables">🔌 Customer chooses: {c.cables.join(" / ")}</span>}
                </div>
              </>
            ) : (
              <span className="bundle-picked-placeholder">Item {i + 1}</span>
            )}
            {i === 0 && <span className="bundle-picked-plus">+</span>}
          </div>
        ))}
      </div>

      <div className="input-row">
        <div className="input-group">
          <label>Original Combined Price (auto)</label>
          <input type="text" readOnly tabIndex={-1} className="form-input deal-input" value={combined !== null ? `${formatPrice(combined)} MAD` : "—"} />
        </div>
        <div className="input-group">
          <label>Bundle Promotional Price (MAD)</label>
          <input
            type="number"
            placeholder="e.g. 199"
            min="0.01"
            step="0.01"
            value={price}
            onChange={(e) => onPriceChange(e.target.value)}
            className={`form-input deal-input${error ? " input-invalid" : ""}`}
          />
        </div>
      </div>

      <div className="deal-preview">
        {combined !== null && discount !== null ? (
          <div className="preview-content">
            <span className="preview-label">Pack Preview (both items together):</span>
            <div className="preview-prices">
              <span className="preview-old">{formatPrice(combined)} MAD</span>
              <span className="preview-discount">-{discount}%</span>
              <span className="preview-new">{formatPrice(price)} MAD</span>
            </div>
          </div>
        ) : (
          <p className="preview-placeholder">Select two items and enter the bundle price to see the discount</p>
        )}
      </div>
      {error && <p className="deal-price-error">{error}</p>}
      <p className="field-hint">
        Stock is taken from the two items: each pack sold removes one unit of each (for a cable product, from the cable type the customer picks).
        A deal inside a pack is sold at its unit price — its own “buy 1, get the 2nd” offer does not apply.
      </p>
    </div>
  );
}
