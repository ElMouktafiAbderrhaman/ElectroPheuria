// Helpers shared by the homepage banner carousel and the dashboard banner editor.
import { charmPrice, formatPrice } from "./dealPricing";

export const BANNER_LANGS = ["fr", "en", "ar"];
export const BANNER_LAYOUTS = ["split", "centered", "duo", "discount"];

export const emptyText = () => ({ fr: "", en: "", ar: "" });

/** Text in the requested language, falling back to any filled translation. */
export function tr(value, lang) {
  if (!value) return "";
  if (typeof value === "string") return value;
  return (value[lang] || value.fr || value.en || value.ar || "").trim();
}

const num = (v) => (v === null || v === undefined || v === "" ? null : Number(v));

/**
 * What the big promotional figure of an offer shows.
 * Returns { big, unit, note, old, chip } or null when there is nothing to show.
 */
export function offerDisplay(offer, t, { preferDiscount = false, showPrice = true, showDiscount = true } = {}) {
  if (!offer) return null;
  const cur = t("bannerCurrency");
  const promo = num(offer.promotional_price);
  const orig = num(offer.original_price);
  const disc = num(offer.discount_percentage);
  const second = num(offer.second_item_price);

  if (offer.offer_type === "bogo_fixed" && second !== null && showPrice) {
    return {
      big: formatPrice(second),
      unit: cur,
      note: t("bannerSecondFor"),
      chip: promo ? t("bannerPairFor", { price: formatPrice(promo + second) }) : null,
    };
  }
  if (offer.offer_type === "bogo_half" && showDiscount) {
    return {
      big: "-50",
      unit: "%",
      note: t("bannerSecondHalf"),
      chip: promo && showPrice ? t("bannerPairFrom", { price: formatPrice(charmPrice(promo * 1.5)) }) : null,
    };
  }

  if (disc && showDiscount && (preferDiscount || !showPrice || promo === null)) {
    return {
      big: `-${disc}`,
      unit: "%",
      note: showPrice && promo !== null ? `${formatPrice(promo)} ${cur}` : null,
      old: showPrice && orig ? t("bannerInsteadOf", { price: formatPrice(orig) }) : null,
    };
  }
  if (promo !== null && showPrice) {
    return {
      big: formatPrice(promo),
      unit: cur,
      old: orig && orig > promo ? `${formatPrice(orig)} ${cur}` : null,
      chip: disc && showDiscount ? `-${disc}%` : null,
    };
  }
  return null;
}

/** Dark or light text, whichever reads better on the given background. */
export function contrastText(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
  if (!m) return "#0b0b0d";
  const n = parseInt(m[1], 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.35 ? "#0b0b0d" : "#ffffff";
}

/** Same rule as Banner::scopeLive, re-checked in the browser so a page left open never shows an expired banner. */
export function isBannerLive(banner, now = Date.now()) {
  if (banner.start_date && new Date(banner.start_date).getTime() > now) return false;
  if (banner.end_date && new Date(banner.end_date).getTime() <= now) return false;
  return true;
}

export const isExternalUrl = (url) => /^https?:\/\//i.test(url || "");
