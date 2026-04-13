// src/Components/Footer.jsx
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import "./Footer.css";

// Import social icons
import whatsappIcon from "../icons/whatsapp.svg";
import instagramIcon from "../icons/instagram.svg";
import facebookIcon from "../icons/facebook.svg";
import tiktokIcon from "../icons/tiktok.svg";

import locationIcon from "../icons/Location.svg";
import phoneIcon from "../icons/Phone.svg";
import mailIcon from "../icons/Mail.svg";
import ElectroPheuriaLogo from "../assets/images/ElectroPheuriaLOGO.png";

export default function Footer() {
  const { t } = useTranslation();
  const scrollToSection = (id) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <footer className="footer">
      <div className="footer-content">
        {/* Brand */}
        <div className="footer-brand">
          <img src={ElectroPheuriaLogo} alt="ElectroPheuria" className="footer-logo-img" />
          <h3 className="footer-logo">ELECTROPHEURIA</h3>
          <p className="footer-desc">
            {t("footerDesc")}
          </p>
        </div>

        {/* Quick Links */}
        <div className="footer-links">
          <h4>{t("quickLinks")}</h4>
          <ul>
            <li><Link to="/">{t("home")}</Link></li>
            <li><Link to="/products">{t("products")}</Link></li>
            <li><span onClick={() => scrollToSection("deals")}>{t("deals")}</span></li>
            <li><span onClick={() => scrollToSection("about")}>{t("about")}</span></li>
          </ul>
        </div>

        {/* Service */}
        <div className="footer-service">
          <h4>{t("services")}</h4>
          <ul>
            <li><Link to="/info#faq">FAQ</Link></li>
            <li><Link to="/info#shipping">{t("shipping")}</Link></li>
            <li><Link to="/info#returns">{t("returns")}</Link></li>
            <li><Link to="/info#privacy">{t("privacy")}</Link></li>
          </ul>
        </div>

        {/* Contact */}
        <div className="footer-contact">
          <h4>{t("contact")}</h4>
          <ul>
            <li>
              <img src={locationIcon} className="footer-icon-svg" alt="Adresse" />
              {t("location")}
            </li>
            <li>
              <img src={phoneIcon} className="footer-icon-svg" alt="Phone" />
              +212 680 552 555
            </li>
            <li>
              <img src={mailIcon} className="footer-icon-svg" alt="Mail" />
              electropheuria@gmail.com
            </li>
          </ul>
        </div>

        {/* Social - USER FEEDBACK STRUCTURE */}
        <div className="footer-social">
          <h4>{t("followUs")}</h4>
          <div className="social-icons">
            <a href="https://www.facebook.com/profile.php?id=61573390212893&locale=fr_FR" target="_blank" rel="noopener noreferrer" className="social-link" data-name="Facebook">
              <img src={facebookIcon} alt="Facebook" className="social-icon" />
              <span className="social-name">Facebook</span>
            </a>
            <a href="https://www.instagram.com/electropheuria?igsh=MWczbnNuZDlidHFpag==" target="_blank" rel="noopener noreferrer" className="social-link" data-name="Instagram">
              <img src={instagramIcon} alt="Instagram" className="social-icon" />
              <span className="social-name">Instagram</span>
            </a>
            <a href="https://www.tiktok.com/@electropheuria7?_r=1&_t=ZS-95Qo0w5KjrN" target="_blank" rel="noopener noreferrer" className="social-link" data-name="TikTok">
              <img src={tiktokIcon} alt="TikTok" className="social-icon" />
              <span className="social-name">TikTok</span>
            </a>
            <a href="https://wa.me/212680552555" target="_blank" rel="noopener noreferrer" className="social-link" data-name="WhatsApp">
              <img src={whatsappIcon} alt="WhatsApp" className="social-icon" />
              <span className="social-name">WhatsApp</span>
            </a>
          </div>
        </div>
      </div>

      {/* Bottom */}
      <div className="footer-bottom">
        <p>
          {t("copyright")}
        </p>
      </div>
    </footer>
  );
}
