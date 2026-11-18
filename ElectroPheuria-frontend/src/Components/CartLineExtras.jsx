// Extra details under a cart / checkout line: the chosen cable type, or the two products of a pack.
import { useTranslation } from "react-i18next";
import { isBundleDeal, bundleProducts, bundleItemKey } from "../utils/variants";
import "./CartLineExtras.css";

/** Image for a cart line: the chosen cable variant's image first. */
// eslint-disable-next-line react-refresh/only-export-components
export const cartLineImage = (item) => item?.variant_image || item?.images?.[0] || item?.image;

export default function CartLineExtras({ item }) {
  const { t } = useTranslation();

  if (item?.variant_label) {
    return (
      <span className="line-variant-tag">
        🔌 {t("cableTypeLabel")}: <bdi>{item.variant_label}</bdi>
      </span>
    );
  }

  if (isBundleDeal(item)) {
    const products = bundleProducts(item);
    const cableOf = (p) => (p.kind || "product") === "product" ? (item.bundle_choice_labels || []).find((c) => String(c.id) === String(p.id))?.label : null;
    return (
      <span className="line-bundle-info">
        <span className="line-bundle-tag">🎁 {t("bundleDeal")}</span>
        {products.length > 0 && (
          <span className="line-bundle-items">
            {products.map((p, i) => (
              <span key={bundleItemKey(p)}>
                {i > 0 && " + "}
                <bdi>{p.name}</bdi>
                {cableOf(p) && <> (🔌 <bdi>{cableOf(p)}</bdi>)</>}
              </span>
            ))}
          </span>
        )}
      </span>
    );
  }

  return null;
}
