// src/Components/PromoBanner.jsx
// One promotional banner (an advertisement), rendered from a resolved banner payload.
// Used by the homepage carousel and by the dashboard live preview.
import { useMemo } from "react";
import i18n from "../i18n/i18n";
import { tr, offerDisplay, contrastText } from "../utils/bannerUtils";
import "./PromoBanner.css";

/** "La 2ème presque *offerte.*" → the starred part is drawn in the accent colour. */
function AccentText({ text }) {
  const parts = String(text || "").split(/\*([^*]+)\*/g);
  return parts.map((part, i) => (i % 2 ? <em key={i} className="pb-accent">{part}</em> : part));
}

function Brand() {
  return (
    <div className="pb-brand" dir="ltr">
      <span className="pb-brand-dot" />
      <span className="pb-brand-name">ELECTRO<br />PHEURIA</span>
    </div>
  );
}

function TruckIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 6h11v9H2zM13 9h4l3 3v3h-7z" />
      <circle cx="6" cy="17.5" r="1.8" />
      <circle cx="16.5" cy="17.5" r="1.8" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg className="pb-arrow" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

/** Placeholder art when a banner has no image: concentric rings in the accent colour. */
function Rings() {
  return (
    <svg className="pb-rings" viewBox="0 0 200 200" aria-hidden="true">
      <circle cx="100" cy="100" r="92" />
      <circle cx="100" cy="100" r="66" />
      <circle cx="100" cy="100" r="40" />
      <circle cx="100" cy="100" r="12" className="pb-rings-core" />
    </svg>
  );
}

function Figure({ offer, size = "lg" }) {
  if (!offer) return null;
  return (
    <div className={`pb-figure pb-figure--${size}`}>
      <div className={`pb-figure-main ${offer.unit === "%" ? "pb-figure-main--pct" : ""}`}>
        <bdi dir="ltr" className="pb-big">{offer.big}</bdi>
        <span className="pb-unit">{offer.unit}</span>
      </div>
      {(offer.note || offer.old) && (
        <div className="pb-figure-note">
          {offer.note && <span>{offer.note}</span>}
          {offer.old && <s className="pb-old">{offer.old}</s>}
        </div>
      )}
      {offer.chip && <span className="pb-chip">{offer.chip}</span>}
    </div>
  );
}

/** A two-product bundle: both pictures, slightly overlapped, joined by a "+" badge. */
function BundleVisual({ items, eager, onClick }) {
  return (
    <div className="pb-visual pb-visual--bundle" onClick={onClick}>
      <div className="pb-halo" />
      <div className="pb-bundle" dir="ltr">
        {items.map((item, i) => (
          <div key={i} className={`pb-bundle-item pb-bundle-item--${i ? "b" : "a"}`}>
            <img
              src={item.image_url}
              alt={item.name || ""}
              className="pb-img"
              loading={eager ? "eager" : "lazy"}
              decoding="async"
              fetchPriority={eager ? "high" : "auto"}
              draggable="false"
            />
          </div>
        ))}
        <span className="pb-bundle-plus" aria-hidden="true">+</span>
      </div>
    </div>
  );
}

function Visual({ src, alt, eager, onClick, bundle }) {
  if (bundle?.length === 2) return <BundleVisual items={bundle} eager={eager} onClick={onClick} />;
  return (
    <div className="pb-visual" onClick={onClick}>
      <div className="pb-halo" />
      {src ? (
        <img
          src={src}
          alt={alt}
          className="pb-img"
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          fetchPriority={eager ? "high" : "auto"}
          draggable="false"
        />
      ) : (
        <Rings />
      )}
    </div>
  );
}

/**
 * @param banner   resolved banner (public API shape; image_url may be a data URL in previews)
 * @param lang     fr | en | ar — the banner sets its own direction from it
 * @param onNavigate(url) called by the CTA, the image and the duo panels
 * @param eager    load the image eagerly (first slide)
 */
export default function PromoBanner({ banner, lang, onNavigate = () => {}, eager = false, active = true }) {
  const t = useMemo(() => i18n.getFixedT(lang), [lang]);
  const layout = banner.layout || "split";
  const showOpts = { showPrice: banner.show_price !== false, showDiscount: banner.show_discount !== false };

  const headline = tr(banner.headline, lang) || banner.name || "";
  const subtitle = tr(banner.subtitle, lang);
  const description = tr(banner.description, lang);
  const badge = tr(banner.badge_text, lang);
  const cta = tr(banner.button_text, lang) || t("bannerShopNow");
  const label = banner.name || "";
  const mainOffer = offerDisplay(banner, t, { ...showOpts, preferDiscount: layout === "discount" || layout === "duo" });

  const accent = banner.accent_color || "#FFD447";
  const style = {
    "--pb-bg": banner.background_color || "#0b0b0d",
    "--pb-text": banner.text_color || "#ffffff",
    "--pb-accent": accent,
    "--pb-on-accent": contrastText(accent),
  };
  const go = (url) => (e) => {
    e?.stopPropagation?.();
    if (url) onNavigate(url);
  };

  const ctaButton = (
    <button type="button" className="pb-cta" onClick={go(banner.button_url)} tabIndex={active ? 0 : -1}>
      <span>{cta}</span>
      <ArrowIcon />
    </button>
  );

  const footer = (withCta) => (
    <div className="pb-foot pb-anim">
      <span className="pb-foot-info">
        <TruckIcon />
        <span>{t("bannerDelivery")}</span>
        <span className="pb-foot-sep">·</span>
        <span>{t("bannerCod")}</span>
      </span>
      {withCta && ctaButton}
    </div>
  );

  const top = (
    <div className="pb-top pb-anim">
      <Brand />
      {badge && <span className="pb-badge">{badge}</span>}
    </div>
  );

  let body;

  if (layout === "duo") {
    const s = banner.secondary;
    const secondaryOffer = s ? offerDisplay(s, t, { ...showOpts, preferDiscount: true }) : null;
    const panels = [
      { key: "a", label, offer: mainOffer, note: description, img: banner.image_url, bundle: banner.bundle_images, url: banner.button_url },
      s && {
        key: "b",
        label: tr(s.label, lang) || s.name || "",
        heading: tr(s.headline, lang),
        offer: secondaryOffer,
        note: tr(s.note, lang),
        badge: tr(s.badge_text, lang),
        img: s.image_url,
        url: s.button_url,
      },
    ].filter(Boolean);

    body = (
      <>
        {top}
        <div className="pb-duo-head pb-anim">
          <h2 className="pb-headline"><AccentText text={headline} /></h2>
          {subtitle && <p className="pb-sub">{subtitle}</p>}
        </div>
        <div className={`pb-panels pb-anim ${panels.length === 1 ? "is-single" : ""}`}>
          {panels.map((p) => (
            <div key={p.key} className="pb-panel" onClick={go(p.url)} role="link" tabIndex={active ? 0 : -1}
              onKeyDown={(e) => e.key === "Enter" && go(p.url)(e)}>
              <div className="pb-panel-copy">
                {p.label && <p className="pb-label">{p.label}</p>}
                {p.heading && <p className="pb-panel-heading">{p.heading}</p>}
                {p.offer ? <Figure offer={p.offer} size="md" /> : null}
                {p.note && <p className="pb-panel-note">{p.note}</p>}
                {p.badge && <span className="pb-chip pb-chip--ghost">{p.badge}</span>}
              </div>
              <div className="pb-panel-visual">
                {p.bundle?.length === 2 ? (
                  <div className="pb-panel-bundle" dir="ltr">
                    {p.bundle.map((item, i) => (
                      <img key={i} src={item.image_url} alt={item.name || ""} loading={eager ? "eager" : "lazy"} decoding="async" draggable="false" />
                    ))}
                    <span className="pb-bundle-plus" aria-hidden="true">+</span>
                  </div>
                ) : p.img ? <img src={p.img} alt={p.label} loading={eager ? "eager" : "lazy"} decoding="async" draggable="false" /> : <Rings />}
              </div>
            </div>
          ))}
        </div>
        {footer(true)}
      </>
    );
  } else if (layout === "centered") {
    body = (
      <>
        {top}
        <div className="pb-centered">
          <div className="pb-centered-copy pb-anim">
            {label && <p className="pb-label">{label}</p>}
            <h2 className="pb-headline"><AccentText text={headline} /></h2>
            {subtitle && <p className="pb-sub">{subtitle}</p>}
          </div>
          <Visual src={banner.image_url} alt={label || headline} eager={eager} onClick={go(banner.button_url)} bundle={banner.bundle_images} />
          <div className="pb-centered-offer pb-anim">
            <Figure offer={mainOffer} />
            {description && <p className="pb-desc">{description}</p>}
            {ctaButton}
          </div>
        </div>
        {footer(false)}
      </>
    );
  } else if (layout === "discount") {
    const pct = mainOffer?.unit === "%" ? mainOffer : null;
    body = (
      <>
        {top}
        <div className="pb-discount">
          <div className="pb-mega pb-anim" aria-hidden={!pct}>
            {pct ? (
              <>
                <bdi dir="ltr" className="pb-mega-num">{pct.big}<small>%</small></bdi>
                <span className="pb-mega-off">{t("bannerOff")}</span>
              </>
            ) : mainOffer ? (
              <bdi dir="ltr" className="pb-mega-num pb-mega-num--price">{mainOffer.big}<small>{mainOffer.unit}</small></bdi>
            ) : null}
          </div>
          <div className="pb-copy pb-anim">
            {label && <p className="pb-label">{label}</p>}
            <h2 className="pb-headline pb-headline--md"><AccentText text={headline} /></h2>
            {subtitle && <p className="pb-sub">{subtitle}</p>}
            {description && <p className="pb-desc">{description}</p>}
            {pct && (pct.note || pct.old) && (
              <p className="pb-price-line">
                {pct.note && <strong>{pct.note}</strong>} {pct.old && <s className="pb-old">{pct.old}</s>}
              </p>
            )}
            {ctaButton}
          </div>
          <Visual src={banner.image_url} alt={label || headline} eager={eager} onClick={go(banner.button_url)} bundle={banner.bundle_images} />
        </div>
        {footer(false)}
      </>
    );
  } else {
    body = (
      <>
        {top}
        <div className="pb-split">
          <div className="pb-copy pb-anim">
            {label && <p className="pb-label">{label}</p>}
            <h2 className="pb-headline"><AccentText text={headline} /></h2>
            {subtitle && <p className="pb-sub">{subtitle}</p>}
            {description && <p className="pb-desc">{description}</p>}
            <div className="pb-offer-row">
              <Figure offer={mainOffer} />
              {ctaButton}
            </div>
          </div>
          <Visual src={banner.image_url} alt={label || headline} eager={eager} onClick={go(banner.button_url)} bundle={banner.bundle_images} />
        </div>
        {footer(false)}
      </>
    );
  }

  return (
    <div className="pb-wrap">
      <article className={`pb pb--${layout}`} dir={lang === "ar" ? "rtl" : "ltr"} lang={lang} style={style}>
        <div className="pb-bg-art" aria-hidden="true" />
        <div className="pb-inner">{body}</div>
      </article>
    </div>
  );
}
