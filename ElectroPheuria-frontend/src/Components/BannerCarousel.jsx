// src/Components/BannerCarousel.jsx
// Homepage promotional banners, loaded from GET /api/banners (active + scheduled only).
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import api, { apiAssetUrl } from "../services/api";
import PromoBanner from "./PromoBanner";
import { isBannerLive, isExternalUrl } from "../utils/bannerUtils";
import "./BannerCarousel.css";

const ROTATE_MS = 6000;
const SWIPE_PX = 45;

const withAbsoluteImages = (b) => ({
  ...b,
  image_url: apiAssetUrl(b.image_url),
  bundle_images: (b.bundle_images || []).map((i) => ({ ...i, image_url: apiAssetUrl(i.image_url) })),
  secondary: b.secondary ? { ...b.secondary, image_url: apiAssetUrl(b.secondary.image_url) } : null,
});

export default function BannerCarousel() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const lang = ["fr", "en", "ar"].includes(i18n.language) ? i18n.language : "fr";
  const rtl = lang === "ar";

  const [banners, setBanners] = useState([]);
  const [status, setStatus] = useState("loading"); // loading | ready | error
  const [now, setNow] = useState(() => Date.now());
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [pageHidden, setPageHidden] = useState(document.hidden);
  const touch = useRef(null);

  useEffect(() => {
    let cancelled = false;
    api.getBanners()
      .then((data) => {
        if (cancelled) return;
        setBanners(data.map(withAbsoluteImages));
        setStatus("ready");
      })
      .catch(() => !cancelled && setStatus("error"));
    return () => { cancelled = true; };
  }, []);

  // Re-check schedules every 30s so a banner disappears the moment it expires.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    const onVisibility = () => setPageHidden(document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const live = banners.filter((b) => isBannerLive(b, now));
  const count = live.length;
  const current = count ? index % count : 0;

  const go = useCallback((next) => {
    if (!count) return;
    setIndex(((next % count) + count) % count);
  }, [count]);

  // Auto-rotation is driven by the active dot's progress animation (see .bc-dot span):
  // pausing the animation on hover / hidden tab pauses the rotation at the same point.

  const onNavigate = (url) => {
    if (isExternalUrl(url)) window.open(url, "_blank", "noopener");
    else navigate(url || "/products");
  };

  const onTouchStart = (e) => {
    const p = e.touches[0];
    touch.current = { x: p.clientX, y: p.clientY };
    setPaused(true);
  };
  const onTouchEnd = (e) => {
    const start = touch.current;
    touch.current = null;
    setPaused(false);
    if (!start || count < 2) return;
    const p = e.changedTouches[0];
    const dx = p.clientX - start.x;
    if (Math.abs(dx) < SWIPE_PX || Math.abs(dx) < Math.abs(p.clientY - start.y)) return;
    // Swiping toward the reading direction's start reveals the next offer.
    const forward = rtl ? dx > 0 : dx < 0;
    go(current + (forward ? 1 : -1));
  };

  const onKeyDown = (e) => {
    if (count < 2) return;
    if (e.key === "ArrowRight") go(current + (rtl ? -1 : 1));
    if (e.key === "ArrowLeft") go(current + (rtl ? 1 : -1));
  };

  if (status === "loading") {
    return (
      <section className="bc bc--loading" aria-hidden="true">
        <div className="bc-skeleton" />
      </section>
    );
  }
  // The homepage keeps working without banners: errors and an empty list render nothing.
  if (status === "error" || count === 0) return null;

  // Mouse hover and keyboard focus pause; touch taps must not (phones emit a sticky mouseenter).
  return (
    <section
      className="bc"
      dir={rtl ? "rtl" : "ltr"}
      aria-roledescription="carousel"
      aria-label={t("bannerRegion")}
      onPointerEnter={(e) => e.pointerType === "mouse" && setPaused(true)}
      onPointerLeave={(e) => e.pointerType === "mouse" && setPaused(false)}
      onFocus={(e) => e.target.matches?.(":focus-visible") && setPaused(true)}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setPaused(false)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onKeyDown={onKeyDown}
    >
      <div className="bc-stage">
        {live.map((b, i) => (
          <div
            key={b.id}
            className={`bc-slide ${i === current ? "is-active" : ""} ${i < current ? "is-before" : ""}`}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} / ${count}`}
            aria-hidden={i !== current}
            inert={i !== current}
          >
            {/* Re-keying the active slide replays its entrance animation. */}
            <PromoBanner
              key={i === current ? `on-${lang}` : `off-${lang}`}
              banner={b}
              lang={lang}
              onNavigate={onNavigate}
              eager={i === 0}
              active={i === current}
            />
          </div>
        ))}
      </div>

      {count > 1 && (
        <>
          <button type="button" className="bc-arrow bc-arrow--prev" onClick={() => go(current - 1)} aria-label={t("bannerPrev")}>
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
          </button>
          <button type="button" className="bc-arrow bc-arrow--next" onClick={() => go(current + 1)} aria-label={t("bannerNext")}>
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
          </button>
          <div className="bc-dots">
            {live.map((b, i) => (
              <button
                key={b.id}
                type="button"
                className={`bc-dot ${i === current ? "is-active" : ""} ${paused || pageHidden ? "is-paused" : ""}`}
                style={{ "--bc-ms": `${ROTATE_MS}ms` }}
                onClick={() => go(i)}
                aria-label={t("bannerGoTo", { n: i + 1 })}
                aria-current={i === current}
              >
                <span
                  key={i === current ? `run-${current}` : "idle"}
                  onAnimationEnd={i === current ? () => go(current + 1) : undefined}
                />
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
