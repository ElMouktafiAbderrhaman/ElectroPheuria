// src/context/CartContext.jsx
import { createContext, useContext, useState, useEffect, useCallback } from "react";
import api from "../services/api";
import { variantCartItem, bundleChoiceKey, bundleCartItem } from "../utils/variants";
import { clampQuantity } from "../utils/quantity";

const CartContext = createContext();

// eslint-disable-next-line react-refresh/only-export-components
export function useCart() {
  return useContext(CartContext);
}

// Products and deals have separate id ranges, so a cart line is identified by kind + id
// (+ the chosen cable variant: Lightning and Type-C of the same cable are separate lines,
// also for the cable chosen inside a pack).
const isDealLine = (item) => !!(item?.isDeal || item?.oldPrice !== undefined || item?.old_price !== undefined);
// eslint-disable-next-line react-refresh/only-export-components
export const cartLineKey = (item) =>
  `${isDealLine(item) ? "deal" : "product"}-${item?.id}${item?.variant_id ? `-v${item.variant_id}` : ""}${bundleChoiceKey(item)}`;
// Accepts a cart item (preferred) or a bare id (legacy callers).
const matches = (item, target) =>
  target !== null && typeof target === "object" ? cartLineKey(item) === cartLineKey(target) : item.id === target;

export function CartProvider({ children }) {
  // Load cart safely from localStorage
  const [cart, setCart] = useState(() => {
    try {
      const savedCart = localStorage.getItem("ElectroPheuria-cart");

      if (!savedCart || savedCart === "undefined") {
        return [];
      }

      return JSON.parse(savedCart);
    } catch (error) {
      console.error("Failed to load cart from localStorage:", error);
      return [];
    }
  });

  // Save cart whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(
        "ElectroPheuria-cart",
        JSON.stringify(cart)
      );
    } catch (error) {
      console.error("Failed to save cart to localStorage:", error);
    }
  }, [cart]);

  // ADD TO CART — any quantity; stock never limits what a customer can order.
  const addToCart = (product, quantity = 1) => {
    setCart((prev) => {
      const existing = prev.find((item) => matches(item, product));

      if (existing) {
        return prev.map((item) =>
          matches(item, product)
            ? { ...item, quantity: clampQuantity(item.quantity + quantity) }
            : item
        );
      }

      return [...prev, { ...product, quantity: clampQuantity(quantity) }];
    });

    return true;
  };

  // UPDATE QUANTITY — any whole number ≥ 1.
  const updateQuantity = (target, newQuantity) => {
    setCart((prev) =>
      prev.map((item) =>
        matches(item, target) ? { ...item, quantity: clampQuantity(newQuantity) } : item
      )
    );
  };

  // REMOVE ITEM (FIXED — was missing in your code)
  const removeFromCart = (target) => {
    setCart((prev) => prev.filter((item) => !matches(item, target)));
  };

  // Refresh price / offer data of cart items from the live catalog, so the cart shows
  // what the server will actually charge. Unavailable items are kept; the server rejects them.
  const syncWithCatalog = useCallback(async () => {
    try {
      const [products, deals] = await Promise.all([api.getProducts(), api.getDeals()]);
      setCart((prev) =>
        prev.map((item) => {
          const isDeal = item.isDeal || item.oldPrice !== undefined || item.old_price !== undefined;
          const latest = (isDeal ? deals : products).find((x) => String(x.id) === String(item.id));
          if (!latest) return item;
          // Cable variant line: price / stock come from the chosen variant.
          if (!isDeal && item.variant_id) {
            const variant = (latest.variants || []).find((v) => String(v.id) === String(item.variant_id));
            if (!variant) return item; // removed variant: the server rejects the line
            const fresh = variantCartItem(latest, variant);
            return { ...item, price: fresh.price, stock: fresh.stock, variant_label: fresh.variant_label, variant_image: fresh.variant_image };
          }
          return {
            ...item,
            price: Number(latest.price),
            ...(isDeal ? { oldPrice: Number(latest.oldPrice), offer_type: latest.offer_type, second_item_price: latest.second_item_price, active: latest.active } : {}),
            ...(isDeal && latest.deal_type === "bundle"
              ? { deal_type: "bundle", bundle_products: latest.bundle_products, bundle_complete: latest.bundle_complete, discount: latest.discount }
              : {}),
            stock: latest.stock,
            // Pack with chosen cables: labels and stock follow the chosen cable types.
            ...(isDeal && latest.deal_type === "bundle" && item.bundle_variants
              ? (({ stock, bundle_variants, bundle_choice_labels }) => ({ stock, bundle_variants, bundle_choice_labels }))(bundleCartItem(latest, item.bundle_variants))
              : {}),
          };
        })
      );
    } catch (error) {
      console.warn("Could not refresh cart prices:", error);
    }
  }, []);

  // CLEAR CART
  const clearCart = () => {
    setCart([]);
    localStorage.removeItem("ElectroPheuria-cart");
  };

  return (
    <CartContext.Provider
      value={{
        cart,
        addToCart,
        updateQuantity,
        removeFromCart,
        clearCart,
        syncWithCatalog,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}
