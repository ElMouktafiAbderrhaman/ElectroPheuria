// src/Components/Navbar.jsx
import React, { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useCart } from "../context/CartContext";
import SearchIcon from "../icons/Search.svg";
import CartIcon from "../icons/Cart.svg";
import LanguageIcon from "../icons/Languages.svg";
import LightModeIcon from "../icons/LightMode.svg";
import DarkModeIcon from "../icons/DarkMode.svg";
import { applyTheme, getStoredTheme, storeTheme } from "../utils/theme";
import ElectroPheuriaLogo from "../assets/images/ElectroPheuriaLOGO.png";


import "./Navbar.css";

const languages = [
  { code: "en", label: "English" },
  { code: "fr", label: "Français" },
  { code: "ar", label: "عربية" },
];

const Navbar = () => {
  const { cart } = useCart();
  const { t, i18n } = useTranslation();
  const cartCount = cart.length;

  const location = useLocation();
  const navigate = useNavigate();
  const searchRef = useRef(null);
  const languageRef = useRef(null);

  const [isSearchOpen, setIsSearchOpen] = useState(() => {
    const queryParams = new URLSearchParams(location.search);
    return !!queryParams.get("search");
  });
  const [isLanguageOpen, setIsLanguageOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState(() => {
    const queryParams = new URLSearchParams(location.search);
    return queryParams.get("search") || "";
  });
  const [debounceTimer, setDebounceTimer] = useState(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  // Update window width on resize
  useEffect(() => {  
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);







  // Close mobile menu when route changes OR window resized to desktop
  useEffect(() => {
    const handleResizeOrRoute = () => {
      if (window.innerWidth >= 769) {
        setIsMobileMenuOpen(false);
      }
    };
    
    handleResizeOrRoute();
    window.addEventListener('resize', handleResizeOrRoute);
    return () => window.removeEventListener('resize', handleResizeOrRoute);
  }, [location.pathname]);

  // Close search and language dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        const queryParams = new URLSearchParams(location.search);
        if (!queryParams.get("search")) {
          setIsSearchOpen(false);
        }
      }
      if (languageRef.current && !languageRef.current.contains(event.target)) {
        setIsLanguageOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [location.search]);

  // Colour theme: dark by default, light when chosen with the sun icon (remembered).
  const [theme, setTheme] = useState(getStoredTheme);
  useEffect(() => {
    applyTheme(theme);
    // The navbar is not shown on the dashboard, which always stays dark.
    return () => applyTheme("dark", "/dashboard");
  }, [theme]);
  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    storeTheme(next);
    setTheme(next);
  };
  
  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  }, [debounceTimer]);

  const toggleSearch = () => {
    setIsSearchOpen(!isSearchOpen);
    if (!isSearchOpen) {
      setTimeout(() => {
        document.querySelector(".search-input")?.focus();
      }, 100);
    }
  };

  const toggleLanguage = () => {
    setIsLanguageOpen(!isLanguageOpen);
  };

  const changeLanguage = (langCode) => {
    i18n.changeLanguage(langCode);
    localStorage.setItem("ElectroPheuria_lang", langCode);
    document.documentElement.dir = langCode === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = langCode;
    setIsLanguageOpen(false);
  };

  // Dynamic search - triggers as user types (debounced)
  const handleSearchChange = (e) => {
    const query = e.target.value;
    setSearchQuery(query);

    if (debounceTimer) clearTimeout(debounceTimer);

    const timer = setTimeout(() => {
      if (query.trim()) {
        navigate({
          pathname: "/products",
          search: `?search=${encodeURIComponent(query.trim())}`
        });
      } else {
        navigate("/products");
      }
      // Don't close search — let user keep typing
    }, 300);

    setDebounceTimer(timer);
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (debounceTimer) clearTimeout(debounceTimer);
      
      const trimmedQuery = searchQuery.trim();
      if (trimmedQuery) {
        navigate({
          pathname: "/products",
          search: `?search=${encodeURIComponent(trimmedQuery)}`
        });
      } else {
        navigate("/products");
      }
      setIsSearchOpen(false);
    }
  };

  const handleScrollLink = (hash) => {
    setIsMobileMenuOpen(false);
    if (location.pathname === "/") {
      const element = document.getElementById(hash);
      if (element) {
        const navbarHeight = document.querySelector('.navbar')?.offsetHeight || 80;
        const elementPosition = element.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - navbarHeight;

        window.scrollTo({
          top: offsetPosition,
          behavior: "smooth"
        });
      }
    } else {
      navigate(`/#${hash}`);
      setTimeout(() => {
        const element = document.getElementById(hash);
        if (element) {
          const navbarHeight = document.querySelector('.navbar')?.offsetHeight || 80;
          const elementPosition = element.getBoundingClientRect().top;
          const offsetPosition = elementPosition + window.pageYOffset - navbarHeight;
          window.scrollTo({
            top: offsetPosition,
            behavior: "smooth"
          });
        }
      }, 100);
    }
  };

  const handleMobileMenuClick = () => {
    if (windowWidth < 769) {
      setIsMobileMenuOpen(!isMobileMenuOpen);
    }
  };

  const isMobile = windowWidth < 769;

  return (
    <nav className="navbar">
      <div className="navbar-content">
        {/* LEFT */}
        <div className="left">
          <div className="logo">
            <Link to="/">ELECTROPHEURIA</Link>
          </div>

          {!isMobile && (
            <ul className="menu">
              <li>
                <span onClick={() => handleScrollLink("deals")} className="menu-link">
                  {t("deals")}
                </span>
              </li>
              <li><Link to="/products">{t("products")}</Link></li>
              <li>
                <span onClick={() => handleScrollLink("categories")} className="menu-link">
                  {t("categories")}
                </span>
              </li>
              <li>
                <span onClick={() => handleScrollLink("about")} className="menu-link">
                  {t("about")}
                </span>
              </li>
            </ul>
          )}
        </div>

        {/* RIGHT */}
        <div className="right" ref={searchRef}>
          {/* Search Input */}
          <div className={`search-container ${isSearchOpen ? "open" : ""}`}>
            <input
              type="text"
              placeholder={t("searchPlaceholder")}
              className="search-input"
              value={searchQuery}
              onChange={handleSearchChange}
              onKeyDown={handleSearchKeyDown}
            />
          </div>

          {/* Search Button */}
          <div className="search-icon" onClick={toggleSearch}>
            <div className="nav-icon-btn">
              <img src={SearchIcon} alt="Search" className="nav-icon" />
            </div>
          </div>

          {/* Cart Button */}
          <Link to="/cart" className="cart-link">
            <div className="cart-icon-wrapper">
              <div className="nav-icon-btn">
                <img src={CartIcon} alt="Cart" className="nav-icon" />
              </div>
              {cartCount > 0 && (
                <span className="cart-badge">
                  {cartCount > 99 ? '99+' : cartCount}
                </span>
              )}
            </div>
          </Link>

          {/* Light / dark mode */}
          <button
            type="button"
            className="nav-icon-btn theme-toggle"
            onClick={toggleTheme}
            aria-label={theme === "light" ? t("darkMode") : t("lightMode")}
            title={theme === "light" ? t("darkMode") : t("lightMode")}
            aria-pressed={theme === "light"}
            data-testid="theme-toggle"
          >
            <img src={theme === "light" ? DarkModeIcon : LightModeIcon} alt="" className="nav-icon" />
          </button>

          {/* Language Button */}
          <div 
            className="language-container" 
            ref={languageRef} 
          >
            <div className="nav-icon-btn" onClick={toggleLanguage}>
              <img src={LanguageIcon} alt="Language" className="nav-icon" />
            </div>
            <div className={`language-dropdown ${isLanguageOpen ? "open" : ""}`}>
              <div className="language-dropdown-header">{t("language")}</div>
              {languages.map((lang) => (
                <div
                  key={lang.code}
                  className={`language-option ${i18n.language === lang.code ? "active" : ""}`}
                  onClick={() => changeLanguage(lang.code)}
                >
                  <span className="language-label">{lang.label}</span>
                  {i18n.language === lang.code && (
                    <span className="language-check">✓</span>
                  )}
                </div>
              ))}
            </div>
          </div>



          {/* Mobile Menu Toggle - DESKTOP HIDDEN */}
          {isMobile && (
            <div className="mobile-menu-toggle" onClick={handleMobileMenuClick}>
              <span className={`hamburger ${isMobileMenuOpen ? "open" : ""}`}>
                <span></span>
                <span></span>
                <span></span>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Menu Dropdown - DESKTOP HIDDEN */}
      {isMobile && (
        <div className={`mobile-menu ${isMobileMenuOpen ? "open" : ""}`}>
          <ul className="mobile-menu-list">
            <li>
              <span onClick={() => handleScrollLink("deals")} className="mobile-menu-link">
                🔥 {t("deals")}
              </span>
            </li>
            <li>
              <Link to="/products" className="mobile-menu-link" onClick={() => setIsMobileMenuOpen(false)}>
                📦 {t("products")}
              </Link>
            </li>
            <li>
              <span onClick={() => handleScrollLink("categories")} className="mobile-menu-link">
                📂 {t("categories")}
              </span>
            </li>
            <li>
              <span onClick={() => handleScrollLink("about")} className="mobile-menu-link">
                ℹ️ {t("about")}
              </span>
            </li>
            <li className="mobile-menu-divider"></li>
            <li>
              <Link to="/cart" className="mobile-menu-link" onClick={() => setIsMobileMenuOpen(false)}>
                🛒 {t("cart")} ({cartCount})
              </Link>
            </li>
          </ul>
        </div>
      )}
    </nav>
  );
};

export default Navbar;

