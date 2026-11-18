// "Coming soon" visuals shared by every store card and the detail pages.
import { useTranslation } from "react-i18next";
import "./ComingSoon.css";

/** Overlay placed inside a card's .product-image / .similar-product-image. */
export function ComingSoonOverlay({ compact = false }) {
  const { t } = useTranslation();
  return (
    <div className={`coming-soon-overlay${compact ? " compact" : ""}`}>
      <div className="coming-soon-center">
        <span className="coming-soon-icon" aria-hidden="true">⏳</span>
        <span className="coming-soon-title">{t("comingSoon")}</span>
        {!compact && <span className="coming-soon-sub">{t("comingSoonStayTuned")}</span>}
      </div>
    </div>
  );
}

/** Notice shown on the detail page under the price. */
export function ComingSoonNotice() {
  const { t } = useTranslation();
  return (
    <div className="coming-soon-notice" role="status">
      <span className="coming-soon-icon" aria-hidden="true">⏳</span>
      <div>
        <strong>{t("comingSoon")}</strong>
        <p>{t("comingSoonDetail")}</p>
      </div>
    </div>
  );
}
