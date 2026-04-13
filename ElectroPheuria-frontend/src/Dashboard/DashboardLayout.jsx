  // src/Dashboard/DashboardLayout.jsx
import { Outlet } from "react-router-dom";
import DashboardNavbar from "./components/DashboardNavbar.jsx";
import DashboardFooter from "./components/DashboardFooter.jsx";
import "./Dashboard.css";

export default function DashboardLayout({ 
  products, 
  setProducts,
  deals,
  setDeals
}) {
  return (
    <div className="dashboard-wrapper">
      <DashboardNavbar />
        <div className="dashboard-main dashboard-animate-up">
        <Outlet
          context={{
            productsList: products,
            setProductsList: setProducts,
            dealsList: deals,
            setDealsList: setDeals,
          }}
        />
      </div>
      <DashboardFooter />
    </div>
  );
}
