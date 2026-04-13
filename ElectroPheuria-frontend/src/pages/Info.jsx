import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import "./Info.css";

export default function Info() {
  const { t } = useTranslation();
  const location = useLocation();

  useEffect(() => {
    const hash = location.hash.replace("#", "");
    if (hash) {
      setTimeout(() => {
        const el = document.getElementById(hash);
        if (el) {
          const navbarHeight = document.querySelector('.navbar')?.offsetHeight || 80;
          const top = el.getBoundingClientRect().top + window.pageYOffset - navbarHeight - 20;
          window.scrollTo({ top, behavior: "smooth" });
        }
      }, 100);
    }
  }, [location]);

  return (
    <main className="info-main">
      {/* FAQ */}
      <section id="faq" className="info-section">
        <h2 className="info-title">{t("faqTitle")}</h2>
        <div className="info-cards">
          <div className="info-card">
            <h4>{t("faq1Q")}</h4>
            <p>{t("faq1A")}</p>
          </div>
          <div className="info-card">
            <h4>{t("faq2Q")}</h4>
            <p>{t("faq2A")}</p>
          </div>
          <div className="info-card">
            <h4>{t("faq3Q")}</h4>
            <p>{t("faq3A")}</p>
          </div>
          <div className="info-card">
            <h4>{t("faq4Q")}</h4>
            <p>{t("faq4A")}</p>
          </div>
        </div>
      </section>

      {/* Shipping */}
      <section id="shipping" className="info-section">
        <h2 className="info-title">{t("shippingTitle")}</h2>
        <div className="info-content-box">
          <p>{t("shippingP1")}</p>
          <p>{t("shippingP2")}</p>
          <p>{t("shippingP3")}</p>
        </div>
      </section>

      {/* Returns */}
      <section id="returns" className="info-section">
        <h2 className="info-title">{t("returnsTitle")}</h2>
        <div className="info-content-box">
          <p>{t("returnsP1")}</p>
          <p>{t("returnsP2")}</p>
          <p>{t("returnsP3")}</p>
        </div>
      </section>

      {/* Privacy */}
      <section id="privacy" className="info-section">
        <h2 className="info-title">{t("privacyTitle")}</h2>
        <div className="info-content-box">
          <p>{t("privacyP1")}</p>
          <p>{t("privacyP2")}</p>
          <p>{t("privacyP3")}</p>
        </div>
      </section>
    </main>
  );
}
