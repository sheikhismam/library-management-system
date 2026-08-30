import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import AuthLayout from "./layouts/AuthLayout";
import DashboardLayout from "./layouts/DashboardLayout";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import BooksPage from "./pages/BooksPage";
import BookDetailPage from "./pages/BookDetailPage";
import BookCreatePage from "./pages/BookCreatePage";
import BookEditPage from "./pages/BookEditPage";
import MembersPage from "./pages/MembersPage";
import MemberDetailPage from "./pages/MemberDetailPage";
import MemberCreatePage from "./pages/MemberCreatePage";
import MemberEditPage from "./pages/MemberEditPage";
import CirculationPage from "./pages/CirculationPage";
import FinesPage from "./pages/FinesPage";
import ReservationsPage from "./pages/ReservationsPage";
import ReportsPage from "./pages/ReportsPage";
import AuditLogsPage from "./pages/AuditLogsPage";
import GuidePage from "./pages/GuidePage";

const App = () => {
  const { isAuthenticated, isInitializing } = useAuth();

  // Prevent the login page from flashing while the stored session is being
  // restored on hard refresh / initial load.
  if (isInitializing) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  const protectedLayout = isAuthenticated ? (
    <DashboardLayout />
  ) : (
    <Navigate to="/login" replace />
  );

  return (
    <Router>
      <Routes>
        <Route
          path="/login"
          element={
            isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginPage />
          }
        />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        {/* All main sections share the DashboardLayout via its Outlet */}
        <Route element={protectedLayout}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/books" element={<BooksPage />} />
          <Route path="/books/create" element={<BookCreatePage />} />
          <Route path="/books/:id" element={<BookDetailPage />} />
          <Route path="/books/:id/edit" element={<BookEditPage />} />
          <Route path="/members" element={<MembersPage />} />
          <Route path="/members/create" element={<MemberCreatePage />} />
          <Route path="/members/:id" element={<MemberDetailPage />} />
          <Route path="/members/:id/edit" element={<MemberEditPage />} />
          <Route path="/circulation" element={<CirculationPage />} />
          <Route path="/fines" element={<FinesPage />} />
          <Route path="/reservations" element={<ReservationsPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/audit-logs" element={<AuditLogsPage />} />
          <Route path="/guide" element={<GuidePage />} />
        </Route>
      </Routes>
    </Router>
  );
};

export default App;