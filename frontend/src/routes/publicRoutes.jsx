import { Navigate, Outlet } from "react-router-dom";

const PublicRoute = () => {
  // If already logged in, redirect to dashboard
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
};

export default PublicRoute;