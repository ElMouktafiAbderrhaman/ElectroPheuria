// src/App.jsx
import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import api from "./services/api.js";

import Navbar from "./Components/Navbar";
import Home from "./pages/Home";
import Products from "./pages/Products";
import Cart from "./pages/Cart";
import Checkout from "./pages/Checkout";
import ProductDetail from "./pages/ProductDetail";
import DealDetail from "./pages/DealDetail";
import Info from "./pages/Info";
import Footer from "./Components/Footer";
import ScrollToTop from "./Components/ScrollToTop";


import DashboardLayout from "./Dashboard/DashboardLayout";
import DashboardHome from "./Dashboard/Pages/DashboardHome";
import AddProduct from "./Dashboard/Pages/AddProducts";
import Orders from "./Dashboard/Pages/Orders";
import SalesHistory from "./Dashboard/Pages/SalesHistory";
import Clients from "./Dashboard/Pages/Clients";
import EditProductsList from "./Dashboard/Pages/EditProductsList";
import EditProductDetail from "./Dashboard/Pages/EditProductDetail";
import DashboardLogin from "./Dashboard/Pages/DashboardLogin";
import ResetPassword from "./Dashboard/Pages/ResetPassword";
import ClientDashboard from "./pages/ClientDashboard";
import ProtectedRoute from "./Dashboard/components/ProtectedRoute";

function ConditionalNavbar() {
  const location = useLocation();
  if (location.pathname.startsWith("/dashboard")) return null;
  return <Navbar />;
}

function ConditionalFooter() {
  const location = useLocation();
  if (location.pathname.startsWith("/dashboard")) return null;
  return <Footer />;
}

// Safe localStorage getter with error handling
const getSafeStorage = (key, defaultValue) => {
  try {
    const saved = localStorage.getItem(key);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Verify it's an array
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (e) {
    console.error(`Error reading ${key} from localStorage:`, e);
    // Clear corrupted data
    try {
      localStorage.removeItem(key);
    } catch (clearError) {
      console.error(`Error clearing ${key}:`, clearError);
    }
  }
  return defaultValue;
};

export default function App() {
  const [products, setProducts] = useState([]);
  const [deals, setDeals] = useState([]);

  // Load products and deals from the database on startup
  useEffect(() => {
    api.getProducts()
      .then((data) => {
        setProducts(data);
        localStorage.setItem("ElectroPheuria_products", JSON.stringify(data));
      })
      .catch((e) => {
        console.error("Failed to load products from DB, falling back to localStorage:", e);
        setProducts(getSafeStorage("ElectroPheuria_products", []));
      });

    api.getDeals()
      .then((data) => {
        setDeals(data);
        localStorage.setItem("ElectroPheuria_deals", JSON.stringify(data));
      })
      .catch((e) => {
        console.error("Failed to load deals from DB, falling back to localStorage:", e);
        setDeals(getSafeStorage("ElectroPheuria_deals", []));
      });
  }, []);

  // Save to localStorage when state changes
  useEffect(() => {
    try {
      localStorage.setItem("ElectroPheuria_products", JSON.stringify(products));
    } catch (e) {
      console.error("Error saving products:", e);
    }
  }, [products]);

  useEffect(() => {
    try {
      localStorage.setItem("ElectroPheuria_deals", JSON.stringify(deals));
    } catch (e) {
      console.error("Error saving deals:", e);
    }
  }, [deals]);

  return (
    <Router>
      <ScrollToTop />
      <ConditionalNavbar />

      <div className="app-container">
        <Routes>
          {/* Public pages */}
          <Route path="/" element={<Home />} />
          <Route path="/products" element={<Products />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/product/:id" element={<ProductDetail />} />
          <Route path="/deal/:id" element={<DealDetail />} />
          <Route path="/info" element={<Info />} />

          {/* Dashboard login */}
          <Route path="/dashboard/login" element={<DashboardLogin />} />
          <Route path="/dashboard/reset-password" element={<ResetPassword />} />

          {/* Client Dashboard */}
          <Route path="/client" element={<ClientDashboard />} />

          {/* Admin Dashboard */}
          <Route 
            path="/dashboard" 
            element={
              <ProtectedRoute>
                <DashboardLayout 
                  products={products} 
                  setProducts={setProducts}
                  deals={deals}
                  setDeals={setDeals}
                />
              </ProtectedRoute>
            }
          >
            <Route index element={<DashboardHome />} />
            <Route path="add-product" element={<AddProduct />} />
            <Route path="orders" element={<Orders />} />
            <Route path="clients" element={<Clients />} />
            <Route path="sales" element={<SalesHistory />} />
            <Route path="edit-products">
              <Route index element={<EditProductsList />} />
              <Route path=":id" element={<EditProductDetail />} />
            </Route>
          </Route>
        </Routes>
      </div>

      <ConditionalFooter />
    </Router>
  );
}

