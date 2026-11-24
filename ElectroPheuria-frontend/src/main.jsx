import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { CartProvider } from "./context/CartContext";
import { DashboardAuthProvider } from "./context/DashboardAuthContext";
import "./i18n/i18n"
import "./theme-light.css";
import { applyTheme, getStoredTheme } from "./utils/theme";

// Before the first paint, so a visitor who chose light never sees a dark flash.
applyTheme(getStoredTheme());

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <DashboardAuthProvider>
      <CartProvider>
        <App />
      </CartProvider>
    </DashboardAuthProvider>
  </React.StrictMode>
);

