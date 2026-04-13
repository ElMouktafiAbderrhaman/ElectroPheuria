import { createContext, useContext, useState, useEffect } from "react";

const DashboardAuthContext = createContext();

export function DashboardAuthProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return !!sessionStorage.getItem("dashboard_token");
  });

  const login = (token) => {
    sessionStorage.setItem("dashboard_token", token);
    setIsAuthenticated(true);
  };

  const logout = () => {
    sessionStorage.removeItem("dashboard_token");
    setIsAuthenticated(false);
  };

  const getToken = () => sessionStorage.getItem("dashboard_token");

  return (
    <DashboardAuthContext.Provider value={{ isAuthenticated, login, logout, getToken }}>
      {children}
    </DashboardAuthContext.Provider>
  );
}

export function useDashboardAuth() {
  return useContext(DashboardAuthContext);
}
