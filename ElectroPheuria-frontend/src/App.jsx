// src/App.jsx
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useLocation,
} from "react-router-dom";
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
import Banners from "./Dashboard/Pages/Banners";
import BannerEditor from "./Dashboard/Pages/BannerEditor";
import Tracker from "./Dashboard/Pages/Tracker";
import PrepareProducts from "./Dashboard/Pages/PrepareProducts";
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

export default function App() {
  const [products, setProducts] = useState([]);
  const [deals, setDeals] = useState([]);

  // 🔥 refresh deals (used after create/edit/delete)
  const refreshDeals = async () => {
    try {
      const data = await api.getDeals();
      setDeals(data || []);
    } catch (err) {
      console.error("Failed to refresh deals", err);
    }
  };

  // 🚀 load everything from API ONLY (no localStorage)
  useEffect(() => {
    const loadData = async () => {
      try {
        const productsData = await api.getProducts();
        setProducts(productsData || []);
      } catch (error) {
        console.error("Products API failed:", error);
      }

      try {
        const dealsData = await api.getDeals();
        setDeals(dealsData || []);
      } catch (error) {
        console.error("Deals API failed:", error);
      }
    };

    loadData();
  }, []);

  return (
    <Router>
      <ScrollToTop />
      <ConditionalNavbar />

      <div className="app-container">
        <Routes>
          {/* Public */}
          <Route path="/" element={<Home />} />
          <Route path="/products" element={<Products />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/product/:id" element={<ProductDetail />} />
          <Route path="/deal/:id" element={<DealDetail />} />
          <Route path="/info" element={<Info />} />

          {/* Auth */}
          <Route path="/dashboard/login" element={<DashboardLogin />} />
          <Route path="/dashboard/reset-password" element={<ResetPassword />} />

          {/* Client */}
          <Route path="/client" element={<ClientDashboard />} />

          {/* Dashboard */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardLayout
                  products={products}
                  setProducts={setProducts}
                  deals={deals}
                  setDeals={setDeals}
                  refreshDeals={refreshDeals}
                />
              </ProtectedRoute>
            }
          >
            <Route index element={<DashboardHome />} />
            <Route path="add-product" element={<AddProduct />} />
            <Route path="orders" element={<Orders />} />
            <Route path="prepare" element={<PrepareProducts />} />
            <Route path="clients" element={<Clients />} />
            <Route path="sales" element={<SalesHistory />} />
            <Route path="banners" element={<Banners />} />
            <Route path="banners/new" element={<BannerEditor />} />
            <Route path="banners/:id" element={<BannerEditor />} />
            <Route path="tracker" element={<Tracker />} />

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