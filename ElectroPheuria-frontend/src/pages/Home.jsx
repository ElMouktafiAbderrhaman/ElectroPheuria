// src/pages/Home.jsx
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import "./Home.css";

import batteriesImg from "../assets/images/powerbankCat.webp";
import watchesImg from "../assets/images/watchesCat.avif";
import headphonesImg from "../assets/images/headphonesCat.jpeg";
import podsImg from "../assets/images/podsCat.jpg";
import speakersImg from "../assets/images/speakerCat.jpg";
import gamingImg from "../assets/images/GamingAcc.jpg";
import HeroPodsImg from "../assets/images/HeroPods.png";
import HeroHeadphonesImg from "../assets/images/HeroHeadphones.png";
import HeroWatchImg from "../assets/images/HeroWatch.png";
import HeroBatteryImg from "../assets/images/HeroBattery.png";
import HeroSpeakerImg from "../assets/images/speakerHero.webp";
import HeroGamingImg from "../assets/images/gamingHero.jpeg";
import ElectroPheuriaLogo from "../assets/images/ElectroPheuriaLOGO.png";

export default function Home() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  
  // Get deals from localStorage
  const [dealsList, setDealsList] = useState(() => {
    const saved = localStorage.getItem("ElectroPheuria_deals");
    return saved ? JSON.parse(saved) : [];
  });

  // Listen for deal updates
  useEffect(() => {
    const handleStorageChange = () => {
      const saved = localStorage.getItem("ElectroPheuria_deals");
      setDealsList(saved ? JSON.parse(saved) : []);
    };
    
    window.addEventListener('dealsUpdated', handleStorageChange);
    window.addEventListener('focus', handleStorageChange);
    
    return () => {
      window.removeEventListener('dealsUpdated', handleStorageChange);
      window.removeEventListener('focus', handleStorageChange);
    };
  }, []);

  const marqueeItems = [
    t("marquee1"),
    t("marquee2"),
    t("marquee3"),
    t("marquee4"),
    t("marquee5"),
    t("marquee6"),
  ];

  const heroImages = [
    { src: HeroHeadphonesImg, title: t("heroHeadphones") },
    { src: HeroPodsImg, title: t("heroPods") },
    { src: HeroWatchImg, title: t("heroWatches") },
    { src: HeroBatteryImg, title: t("heroBattery") },
    { src: HeroSpeakerImg, title: t("heroSpeaker") },
    { src: HeroGamingImg, title: t("heroGaming") },
  ];

  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % heroImages.length);
    }, 3500);

    return () => clearInterval(interval);
  }, [heroImages.length]);

  return (
    <div className="home-container">
      {/* Hero Section */}
      <section className="hero">
        {/* Background slideshow */}
        <div className="hero-bg-slideshow">
          {heroImages.map((img, index) => (
            <img 
              key={index}
              src={img.src} 
              alt={img.title}
              className={`hero-bg-slide ${index === currentIndex ? 'active' : ''}`}
            />
          ))}
        </div>
        <div className="hero-bg-overlay" />

        <span className="hero-tag">{t("heroTag")}</span>
        <div className="hero-image-label">{heroImages[currentIndex].title}</div>

        <div className="hero-content">
          <h1 className="gold-text">ELECTROPHEURIA</h1>
          <p className="hero-description">
            {t("heroDescription")}
          </p>

          <div className="hero-buttons">
            <button className="btn-primary" onClick={() => navigate("/products")}>
              {t("shopNow")}
            </button>
            <button className="btn-outline" onClick={() => {
              const element = document.getElementById("deals");
              if (element) {
                const navbarHeight = document.querySelector('.navbar')?.offsetHeight || 80;
                const elementPosition = element.getBoundingClientRect().top;
                const offsetPosition = elementPosition + window.pageYOffset - navbarHeight;
                window.scrollTo({
                  top: offsetPosition,
                  behavior: "smooth"
                });
              }
            }}>
              {t("viewDeals")}
            </button>
          </div>
        </div>

        {/* Marquee Bar inside Hero */}
        <div className="marquee-bar">
          <div className="marquee-track">
            {marqueeItems.map((item, index) => (
              <span key={index} className="marquee-item">{item}</span>
            ))}
            {marqueeItems.map((item, index) => (
              <span key={`dup-${index}`} className="marquee-item">{item}</span>
            ))}
          </div>
        </div>
      </section>

      {/* Deals Section */}
      <section id="deals" className="deals">
        <div className="section-header">
          <h2>{t("specialDeals")}</h2>
        </div>

        {dealsList.filter(d => d.stock > 0).length === 0 ? (
          <div className="empty-deals">
            <p>{t("noDeals")}</p>
          </div>
        ) : (
          <div className="deals-grid">
{dealsList.filter(d => d.stock > 0).slice(0, 3).map((deal) => (
<div 
                key={deal.id} 
                className="product-card golden-card"
                onClick={() => navigate(`/deal/${deal.id}`)}
                style={{cursor: 'pointer'}}
              >
                <div className="product-image">
                  {deal.images?.[0] || deal.image ? (
                    <img src={deal.images?.[0] || deal.image} alt={deal.name} />
                  ) : (
                    <div className="image-placeholder">🔥</div>
                  )}
                  <span className="promo-sticker">{t("promotion")}</span>
                </div>
                
                <div className="product-info">
                  <h4>{deal.name}</h4>
                  <div className="deal-bottom">
                    {deal.discount && (
                      <span className="discount-badge-bottom">-{deal.discount}%</span>
                    )}
                    <div className="deal-prices-stacked">
                      <span className="old-price">{deal.oldPrice} MAD</span>
                      <span className="new-price">{deal.price} MAD</span>
                    </div>
                  </div>
                </div>
                <span className="click-details-tag">{t("clickDetails")}</span>
              </div>
            ))}
            <div className="see-more-deals" onClick={() => navigate('/products?category=golden')}>
              <div className="see-more-icon">➔</div>
              <button className="see-more-button">{t("viewMoreDeals")}</button>
            </div>
          </div>
        )}
      </section>

      {/* Categories Section */}
      <section id="categories" className="categories">
        <div className="section-header">
          <h2>{t("categories")}</h2>
        </div>
        <div className="categories-container">
          {[
            { name: t("catBatteries"), key: "batteries", image: batteriesImg },
            { name: t("catWatches"), key: "watches", image: watchesImg },
            { name: t("catHeadphones"), key: "headphones", image: headphonesImg },
            { name: t("catPods"), key: "pods", image: podsImg },
            { name: t("catSpeakers"), key: "speakers", image: speakersImg },
            { name: t("catGaming"), key: "gaming", image: gamingImg },
          ].map((cat, index) => (
            <div
              key={index}
              className="category-card"
              style={{ backgroundImage: `url(${cat.image})` }}
              onClick={() => navigate(`/products?category=${cat.key}`)}
            >
              <div className="category-overlay"></div>
              <div className="category-info">
                <h4>{cat.name}</h4>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Why Choose Us */}
      <section className="features">
        <div className="section-header">
          <h2>{t("whyChooseUs")}</h2>
        </div>
        <div className="features-container">
          <div className="feature-item">
            <div className="feature-icon">⭐</div>
            <div className="feature-content">
              <h4>{t("premiumQuality")}</h4>
              <p>{t("premiumQualityDesc")}</p>
            </div>
          </div>
          <div className="feature-item">
            <div className="feature-icon">🚚</div>
            <div className="feature-content">
              <h4>{t("fastShipping")}</h4>
              <p>{t("fastShippingDesc")}</p>
            </div>
          </div>
          <div className="feature-item">
            <div className="feature-icon">🛠️</div>
            <div className="feature-content">
              <h4>{t("support247")}</h4>
              <p>{t("support247Desc")}</p>
            </div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="about">
  <div className="section-header">
    <h2>{t("aboutTitle")}</h2>
  </div>
  <div className="about-content">
    <div className="about-text">
  <p dangerouslySetInnerHTML={{ __html: t("aboutP1") }} />
  <p>{t("aboutP2")}</p>
  <p>{t("aboutP3")}</p>
</div>
    <div className="about-image">
      <img src={ElectroPheuriaLogo} alt="ElectroPheuria Logo" />
    </div>
  </div>
</section>
    </div>
  );
}