// Banner editor state: defaults, suggested copy, API payload and a live-preview resolver.
// The resolver mirrors BannerController::resolveOffer so the preview matches the storefront.
import { emptyText, tr } from "../utils/bannerUtils";
import { formatPrice } from "../utils/dealPricing";

export const COLOR_PRESETS = [
  { name: "Noir & Or", background_color: "#0b0b0d", text_color: "#ffffff", accent_color: "#FFD447" },
  { name: "Minuit", background_color: "#0a1020", text_color: "#f4f6ff", accent_color: "#5AB0FF" },
  { name: "Flash rouge", background_color: "#140607", text_color: "#ffffff", accent_color: "#FF3B3B" },
  { name: "Émeraude", background_color: "#04130d", text_color: "#eafff4", accent_color: "#2EE59D" },
  { name: "Ivoire", background_color: "#f6f1e7", text_color: "#121212", accent_color: "#C99A1E" },
];

export const LAYOUT_OPTIONS = [
  { value: "split", label: "Split", hint: "Text left, product right" },
  { value: "centered", label: "Centered", hint: "Product in the spotlight" },
  { value: "duo", label: "Duo offer", hint: "Two offers side by side" },
  { value: "discount", label: "Big discount", hint: "Huge percentage first" },
];

export const emptySecondary = () => ({
  type: "deal",
  product_id: "",
  deal_id: "",
  label: emptyText(),
  headline: emptyText(),
  note: emptyText(),
  badge_text: emptyText(),
  original_price: "",
  promotional_price: "",
  discount_percentage: "",
  url: "",
});

export const emptyDraft = (type = "custom") => ({
  title: "",
  promotion_type: type,
  product_id: "",
  deal_id: "",
  layout: "split",
  headline: emptyText(),
  subtitle: emptyText(),
  description: emptyText(),
  badge_text: emptyText(),
  button_text: emptyText(),
  button_url: "",
  image: null,
  ...COLOR_PRESETS[0],
  original_price: "",
  promotional_price: "",
  discount_percentage: "",
  show_price: true,
  show_discount: true,
  start_date: "",
  end_date: "",
  active: true,
  secondary: null,
});

const fillText = (v) => ({ ...emptyText(), ...(v || {}) });
const numOrEmpty = (v) => (v === null || v === undefined ? "" : String(v));

/** ISO → value for <input type="datetime-local"> in the admin's own timezone. */
export function toLocalInput(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
const fromLocalInput = (v) => (v ? new Date(v).toISOString() : null);

/** Editor state from GET /api/admin/banners/{id} → raw */
export function draftFromRaw(raw) {
  return {
    ...emptyDraft(raw.promotion_type),
    ...raw,
    product_id: numOrEmpty(raw.product_id),
    deal_id: numOrEmpty(raw.deal_id),
    headline: fillText(raw.headline),
    subtitle: fillText(raw.subtitle),
    description: fillText(raw.description),
    badge_text: fillText(raw.badge_text),
    button_text: fillText(raw.button_text),
    button_url: raw.button_url || "",
    original_price: numOrEmpty(raw.original_price),
    promotional_price: numOrEmpty(raw.promotional_price),
    discount_percentage: numOrEmpty(raw.discount_percentage),
    start_date: toLocalInput(raw.start_date),
    end_date: toLocalInput(raw.end_date),
    secondary: raw.secondary
      ? {
          ...emptySecondary(),
          ...raw.secondary,
          product_id: numOrEmpty(raw.secondary.product_id),
          deal_id: numOrEmpty(raw.secondary.deal_id),
          label: fillText(raw.secondary.label),
          headline: fillText(raw.secondary.headline),
          note: fillText(raw.secondary.note),
          badge_text: fillText(raw.secondary.badge_text),
          original_price: numOrEmpty(raw.secondary.original_price),
          promotional_price: numOrEmpty(raw.secondary.promotional_price),
          discount_percentage: numOrEmpty(raw.secondary.discount_percentage),
          url: raw.secondary.url || "",
        }
      : null,
  };
}

const nullable = (v) => (v === "" || v === null || v === undefined ? null : Number(v));

/** Body for POST/PUT /api/banners. The image is only sent when it changed. */
export function payloadFromDraft(d, { imageChanged }) {
  const body = {
    title: d.title.trim(),
    promotion_type: d.promotion_type,
    product_id: d.promotion_type === "product" ? nullable(d.product_id) : null,
    deal_id: d.promotion_type === "deal" ? nullable(d.deal_id) : null,
    layout: d.layout,
    headline: d.headline,
    subtitle: d.subtitle,
    description: d.description,
    badge_text: d.badge_text,
    button_text: d.button_text,
    button_url: d.button_url.trim() || null,
    background_color: d.background_color,
    text_color: d.text_color,
    accent_color: d.accent_color,
    original_price: nullable(d.original_price),
    promotional_price: nullable(d.promotional_price),
    discount_percentage: nullable(d.discount_percentage),
    show_price: d.show_price,
    show_discount: d.show_discount,
    start_date: fromLocalInput(d.start_date),
    end_date: fromLocalInput(d.end_date),
    active: d.active,
    secondary:
      d.layout === "duo" && d.secondary
        ? {
            ...d.secondary,
            product_id: d.secondary.type === "product" ? nullable(d.secondary.product_id) : null,
            deal_id: d.secondary.type === "deal" ? nullable(d.secondary.deal_id) : null,
            original_price: nullable(d.secondary.original_price),
            promotional_price: nullable(d.secondary.promotional_price),
            discount_percentage: nullable(d.secondary.discount_percentage),
            url: d.secondary.url.trim() || null,
          }
        : null,
  };
  if (imageChanged) body.image = d.image || null;
  return body;
}

const firstImage = (item) => (Array.isArray(item?.images) && item.images[0]) || null;
const dealOldPrice = (deal) => Number(deal?.oldPrice ?? deal?.old_price ?? 0);

/** Live product/deal values, before banner overrides. */
export function sourceFacts(type, item) {
  if (!item) return null;
  if (type === "deal") {
    const standard = !item.offer_type || item.offer_type === "standard";
    const price = Number(item.price);
    const old = dealOldPrice(item);
    return {
      name: item.name,
      image: firstImage(item),
      offer_type: item.offer_type || "standard",
      second_item_price: item.second_item_price != null ? Number(item.second_item_price) : null,
      promotional_price: price,
      original_price: standard && old > price ? old : null,
      discount_percentage: standard && Number(item.discount) > 0 ? Number(item.discount) : null,
      url: `/deal/${item.id}`,
      active: item.active !== false && item.active !== 0,
    };
  }
  return {
    name: item.name,
    image: firstImage(item),
    offer_type: null,
    second_item_price: null,
    promotional_price: Number(item.price),
    original_price: null,
    discount_percentage: null,
    url: `/product/${item.id}`,
    active: true,
  };
}

function resolveOffer(type, facts, ov) {
  const pick = (o, f) => (o !== "" && o !== null && o !== undefined ? Number(o) : f ?? null);
  const original = pick(ov.original_price, facts?.original_price);
  const promo = pick(ov.promotional_price, facts?.promotional_price);
  let discount = pick(ov.discount_percentage, facts?.discount_percentage);
  if (discount === null && original && promo !== null && promo < original) {
    discount = Math.round(((original - promo) / original) * 100);
  }
  return {
    name: facts?.name || null,
    original_price: original,
    promotional_price: promo,
    discount_percentage: discount,
    offer_type: facts?.offer_type || null,
    second_item_price: facts?.second_item_price ?? null,
    button_url: (ov.url || "").trim() || facts?.url || "/products",
  };
}

/** A bundle deal's two item pictures (same rule as BannerController::bundleImageSources). */
function bundleImages(deal) {
  if (deal?.deal_type !== "bundle") return [];
  const items = (deal.bundle_products || []).map((p) => ({ name: p.name, image_url: p.image || null }));
  return items.length === 2 && items.every((i) => i.image_url) ? items : [];
}

/** Banner object for <PromoBanner> built from the editor state. */
export function previewBanner(d, { products, deals, existingImageUrl }) {
  const find = (type, id) =>
    type === "product" ? products.find((p) => String(p.id) === String(id))
    : type === "deal" ? deals.find((x) => String(x.id) === String(id))
    : null;

  const main = d.promotion_type === "custom" ? null : sourceFacts(d.promotion_type, find(d.promotion_type, d.promotion_type === "product" ? d.product_id : d.deal_id));
  const banner = {
    ...d,
    ...resolveOffer(d.promotion_type, main, { ...d, url: d.button_url }),
    image_url: d.image || existingImageUrl || main?.image || null,
    bundle_images: d.image || existingImageUrl ? [] : bundleImages(d.promotion_type === "deal" ? find("deal", d.deal_id) : null),
    secondary: null,
  };

  if (d.layout === "duo" && d.secondary) {
    const s = d.secondary;
    const facts = s.type === "custom" ? null : sourceFacts(s.type, find(s.type, s.type === "product" ? s.product_id : s.deal_id));
    banner.secondary = { ...s, ...resolveOffer(s.type, facts, s), image_url: facts?.image || null };
  }
  return banner;
}

/** Ready-made trilingual copy for a product or deal. Starred words are drawn in the accent colour. */
export function suggestCopy(type, item) {
  const f = sourceFacts(type, item);
  if (!f) return null;
  const name = f.name || "";
  const t3 = (fr, en, ar) => ({ fr, en, ar });
  const button = t3("Commandez maintenant", "Order now", "اطلب دابا");
  const duoSub = t3("Achetez-en un, le 2ème presque offert", "Buy one, the second is almost free", "شري وحدة، والثانية بثمن صغير");
  const duoBadge = t3("Offre duo", "Duo offer", "عروض الجوج");

  if (f.offer_type === "bogo_fixed" && f.second_item_price != null) {
    const x = formatPrice(f.second_item_price);
    return {
      layout: "split",
      headline: t3(`Le 2ème à *${x} DH.*`, `The 2nd one for *${x} MAD.*`, `الثانية غير ب *${x} درهم*`),
      subtitle: duoSub, badge_text: duoBadge, button_text: button,
    };
  }
  if (f.offer_type === "bogo_half") {
    return {
      layout: "split",
      headline: t3("Le 2ème à *moitié prix.*", "The 2nd one *half price.*", "الثانية *بنص الثمن*"),
      subtitle: duoSub, badge_text: duoBadge, button_text: button,
    };
  }
  if (f.discount_percentage) {
    const pct = f.discount_percentage;
    return {
      layout: pct >= 30 ? "discount" : "split",
      headline: t3(`*-${pct}%* sur ${name}`, `*${pct}% off* ${name}`, `تخفيض *${pct}%* على ${name}`),
      subtitle: t3("Offre limitée — profitez-en maintenant", "Limited-time offer — grab it now", "عرض محدود — استافد دابا"),
      badge_text: t3("Promo", "Sale", "تخفيضات"),
      button_text: button,
    };
  }
  const price = formatPrice(f.promotional_price);
  return {
    layout: "split",
    headline: t3(`${name}, *à ${price} DH.*`, `${name}, *only ${price} MAD.*`, `${name} *غير ب ${price} درهم*`),
    subtitle: t3("Qualité premium, livrée chez vous", "Premium quality, delivered to your door", "جودة عالية، توصل لباب دارك"),
    badge_text: t3("Nouveauté", "New", "جديد"),
    button_text: button,
  };
}

/** Text used to name a banner in the list when the admin left the title empty. */
export const autoTitle = (d, item) => tr(d.headline, "fr").replace(/\*/g, "") || item?.name || "Banner";
