import { Navigate } from "react-router-dom";
import { useDashboardAuth } from "../../context/DashboardAuthContext";

export default function ProtectedRoute({ children }) {
  const { isAuthenticated } = useDashboardAuth();

  if (!isAuthenticated) {
    return <Navigate to="/dashboard/login" replace />;
  }

  return children;
}
