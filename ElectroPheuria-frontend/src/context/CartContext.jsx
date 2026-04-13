// src/context/CartContext.jsx
import { createContext, useContext, useState, useEffect } from "react";

const CartContext = createContext();

// eslint-disable-next-line react-refresh/only-export-components
export function useCart() {
  return useContext(CartContext);
}

export function CartProvider({ children }) {
  // Load cart from localStorage during initialization (user suggestion)
  const [cart, setCart] = useState(() => {
    try {
      const savedCart = localStorage.getItem('ElectroPheuria-cart');
      return savedCart ? JSON.parse(savedCart) : [];
    } catch (error) {
      console.error('Failed to load cart from localStorage:', error);
      return [];
    }
  });

  // Save cart to localStorage whenever cart changes (user suggestion)
  useEffect(() => {
    try {
      localStorage.setItem('ElectroPheuria-cart', JSON.stringify(cart));
    } catch (error) {
      console.error('Failed to save cart to localStorage:', error);
    }
  }, [cart]);

  const addToCart = (product, quantity = 1) => {
    if (product.stock !== undefined && product.stock <= 0) {
      return false;
    }
    setCart((prev) => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item =>
          item.id === product.id
            ? { ...item, quantity: Math.min(item.quantity + quantity, item.stock || 999) }
            : item
        );
      }
      return [...prev, { ...product, quantity: Math.min(quantity, product.stock || 999) }];
    });
    return true;
  };

  const updateQuantity = (id, newQuantity) => {
    setCart((prev) => {
      return prev.map(item =>
        item.id === id
          ? { ...item, quantity: Math.max(1, Math.min(newQuantity, item.stock || 999)) }
          : item
      ).filter(item => item.quantity > 0);
    });
  };

  const removeFromCart = (id) => {
    setCart((prev) => prev.filter(item => item.id !== id));
  };

  const clearCart = () => {
    setCart([]);
    localStorage.removeItem('ElectroPheuria-cart');
  };

  return (
    <CartContext.Provider value={{ cart, addToCart, updateQuantity, removeFromCart, clearCart }}>
      {children}
    </CartContext.Provider>
  );
}
