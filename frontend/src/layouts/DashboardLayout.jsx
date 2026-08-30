import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useI18n } from "../context/I18nContext";
import { Link, Outlet, useLocation } from "react-router-dom";
import { Modal, Input } from "../components";
import { api } from "../api/api";

const NAV_ITEMS = [
  { to: "/dashboard", key: "nav.dashboard", icon: "📊" },
  { to: "/books", key: "nav.books", icon: "📚" },
  { to: "/members", key: "nav.members", icon: "👥" },
  { to: "/circulation", key: "nav.circulation", icon: "📖" },
  { to: "/fines", key: "nav.fines", icon: "💰" },
  { to: "/reservations", key: "nav.reservations", icon: "⏳" },
  { to: "/reports", key: "nav.reports", icon: "📄" },
  { to: "/audit-logs", key: "nav.auditLogs", icon: "📋" },
];

const DashboardLayout = () => {
  const { isAuthenticated, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { lang, setLanguage, t } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [pwdCurrent, setPwdCurrent] = useState("");
  const [pwdNew, setPwdNew] = useState("");
  const [pwdConfirm, setPwdConfirm] = useState("");
  const [pwdError, setPwdError] = useState(null);
  const [pwdFieldErrors, setPwdFieldErrors] = useState({});
  const [pwdSuccess, setPwdSuccess] = useState(null);
  const [pwdSaving, setPwdSaving] = useState(false);
  const location = useLocation();
  const menuRef = useRef(null);

  // Close the menu when the route changes (nav selection, back button, etc.).
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  // Close the menu when clicking outside or pressing Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const handleOutsideClick = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  const isActive = (to) => location.pathname === to;

  const resetPasswordForm = () => {
    setPwdCurrent("");
    setPwdNew("");
    setPwdConfirm("");
    setPwdError(null);
    setPwdFieldErrors({});
    setPwdSuccess(null);
    setPwdSaving(false);
  };

  const openChangePassword = () => {
    resetPasswordForm();
    setPasswordOpen(true);
  };

  const closeChangePassword = () => {
    setPasswordOpen(false);
    resetPasswordForm();
  };

  const handleSubmitPassword = async (e) => {
    e.preventDefault();
    setPwdSaving(true);
    setPwdError(null);
    setPwdFieldErrors({});
    setPwdSuccess(null);

    if (pwdNew !== pwdConfirm) {
      setPwdFieldErrors({ confirm_password: t("auth.passwordMismatch") });
      setPwdSaving(false);
      return;
    }

    try {
      await api.post("/api/v1/auth/change-password/", {
        old_password: pwdCurrent,
        new_password: pwdNew,
        confirm_password: pwdConfirm,
      });
      setPwdSuccess(t("auth.passwordChanged"));
      setPwdCurrent("");
      setPwdNew("");
      setPwdConfirm("");
    } catch (err) {
      const data = err?.response?.data;
      if (data && typeof data === "object") {
        const fieldErrors = {};
        if (data.old_password) {
          fieldErrors.old_password = Array.isArray(data.old_password)
            ? data.old_password[0]
            : data.old_password;
        }
        if (data.new_password) {
          fieldErrors.new_password = Array.isArray(data.new_password)
            ? data.new_password[0]
            : data.new_password;
        }
        if (data.confirm_password) {
          fieldErrors.confirm_password = Array.isArray(data.confirm_password)
            ? data.confirm_password[0]
            : data.confirm_password;
        }
        if (Object.keys(fieldErrors).length) {
          setPwdFieldErrors(fieldErrors);
        } else {
          setPwdError(t("auth.passwordChangeFailed"));
        }
      } else {
        setPwdError(t("auth.passwordChangeFailed"));
      }
    } finally {
      setPwdSaving(false);
    }
  };

  const navItems = NAV_ITEMS.map((item) => ({ ...item, label: t(item.key) }));
  const visibleNavItems =
    location.pathname === "/dashboard"
      ? navItems.filter((item) => item.to !== "/dashboard")
      : navItems;

  if (!isAuthenticated) {
    return <div>{t("common.loading")}</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Top navbar */}
      <header className="bg-gray-900 text-white shadow">
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-4">
            {/* Menu control */}
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                className="inline-flex items-center gap-2 rounded-md border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm font-medium text-gray-200 hover:bg-gray-700 hover:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <span aria-hidden="true">☰</span>
                <span>{t("nav.menu")}</span>
                <svg
                  className={`w-4 h-4 transition-transform ${menuOpen ? "rotate-180" : ""}`}
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>

              {menuOpen && (
                <div
                  role="menu"
                  className="absolute left-0 top-full mt-2 z-50 w-56 overflow-hidden rounded-md border border-gray-700 bg-gray-800 shadow-lg"
                >
                  <ul className="py-1">
                    {visibleNavItems.map((item) => (
                      <li key={item.to}>
                        <Link
                          to={item.to}
                          role="menuitem"
                          aria-current={isActive(item.to) ? "page" : undefined}
                          onClick={() => setMenuOpen(false)}
                          className={`flex items-center px-3 py-2 text-sm ${
                            isActive(item.to)
                              ? "bg-gray-700 text-white"
                              : "text-gray-300 hover:bg-gray-700 hover:text-white focus:outline-none"
                          }`}
                        >
                          <span className="mr-2">{item.icon}</span>
                          {item.label}
                        </Link>
                      </li>
                    ))}

                    {/* Admin Guide, visually separated at the bottom */}
                    <li className="mt-1 border-t border-gray-700">
                      <Link
                        to="/guide"
                        role="menuitem"
                        aria-current={isActive("/guide") ? "page" : undefined}
                        onClick={() => setMenuOpen(false)}
                        className={`flex items-center px-3 py-2 text-sm ${
                          isActive("/guide")
                            ? "bg-gray-700 text-white"
                            : "text-gray-300 hover:bg-gray-700 hover:text-white focus:outline-none"
                        }`}
                      >
                        <span className="mr-2">📘</span>
                        {t("nav.guide")}
                      </Link>
                    </li>
                  </ul>
                </div>
              )}
            </div>

            <h1 className="text-lg font-bold">
              <span className="text-indigo-400">LMS</span> ·{" "}
              {lang === "bn" ? "লাইব্রেরি ম্যানেজমেন্ট সিস্টেম" : "Library Management System"}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            {/* Theme toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              title={t("nav.tooltip.theme")}
              aria-label={t("nav.tooltip.theme")}
              className="inline-flex items-center justify-center rounded-md border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-gray-200 hover:bg-gray-700 hover:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {theme === "dark" ? (
                <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path
                    fillRule="evenodd"
                    d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.21-5.95a1 1 0 011-1h1a1 1 0 110 2h-1a1 1 0 01-1-1zm-10 4.536a1 1 0 011.414 0l.707.707a1 1 0 01-1.414 1.414l-.707-.707a1 1 0 010-1.414zM12.95 4.95l.707-.707a1 1 0 111.414 1.414l-.707.707a1 1 0 01-1.414-1.414zM10 6a4 4 0 014 4 4 4 0 11-8 0 4 4 0 014-4z"
                    clipRule="evenodd"
                  />
                </svg>
              ) : (
                <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                </svg>
              )}
            </button>

            {/* Language toggle */}
            <button
              type="button"
              onClick={() => setLanguage(lang === "en" ? "bn" : "en")}
              title={t("nav.tooltip.lang")}
              aria-label={t("nav.tooltip.lang")}
              className="inline-flex items-center justify-center rounded-md border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm font-medium text-gray-200 hover:bg-gray-700 hover:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-[3.5rem]"
            >
              {lang === "en" ? "বাংলা" : "EN"}
            </button>

            {/* Change Password */}
            <button
              type="button"
              onClick={openChangePassword}
              title={t("auth.changePassword")}
              className="inline-flex items-center justify-center rounded-md border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm font-medium text-gray-200 hover:bg-gray-700 hover:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {t("auth.changePassword")}
            </button>

            {/* Logout */}
            <button
              type="button"
              onClick={() => setLogoutOpen(true)}
              title={t("nav.tooltip.logout")}
              className="inline-flex items-center justify-center rounded-md px-3 py-1.5 text-sm font-medium bg-red-600 hover:bg-red-700 text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              {t("auth.logout")}
            </button>
          </div>
        </div>
      </header>

      {/* Logout confirmation */}
      {logoutOpen && (
        <Modal onClose={() => setLogoutOpen(false)} maxWidth="max-w-sm">
          <div className="p-6">
            <h3 className="text-lg font-semibold mb-2">{t("auth.logout")}</h3>
            <p className="text-sm mb-6">{t("auth.logoutConfirm")}</p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setLogoutOpen(false)}
                className="rounded-md bg-gray-100 hover:bg-gray-200 px-4 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400"
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setLogoutOpen(false);
                  logout();
                }}
                className="rounded-md bg-red-600 hover:bg-red-700 px-4 py-2 text-sm text-white font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                {t("auth.logout")}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Change Password */}
      {passwordOpen && (
        <Modal onClose={closeChangePassword} maxWidth="max-w-md">
          <form onSubmit={handleSubmitPassword} className="p-6">
            <h3 className="text-lg font-semibold mb-4">{t("auth.changePassword")}</h3>

            {pwdSuccess && (
              <div className="bg-green-100 border-green-400 text-green-700 px-3 py-2 rounded-md mb-4 text-sm">
                {pwdSuccess}
              </div>
            )}
            {pwdError && (
              <div className="bg-red-100 border-red-400 text-red-700 px-3 py-2 rounded-md mb-4 text-sm">
                {pwdError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t("auth.currentPassword")}
                </label>
                <Input
                  type="password"
                  value={pwdCurrent}
                  onChange={(e) => setPwdCurrent(e.target.value)}
                  autoComplete="current-password"
                  required
                />
                {pwdFieldErrors.old_password && (
                  <p className="text-sm text-red-600 mt-1">{pwdFieldErrors.old_password}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t("auth.newPassword")}
                </label>
                <Input
                  type="password"
                  value={pwdNew}
                  onChange={(e) => setPwdNew(e.target.value)}
                  autoComplete="new-password"
                  required
                />
                {pwdFieldErrors.new_password && (
                  <p className="text-sm text-red-600 mt-1">{pwdFieldErrors.new_password}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t("auth.confirmNewPassword")}
                </label>
                <Input
                  type="password"
                  value={pwdConfirm}
                  onChange={(e) => setPwdConfirm(e.target.value)}
                  autoComplete="new-password"
                  required
                />
                {pwdFieldErrors.confirm_password && (
                  <p className="text-sm text-red-600 mt-1">{pwdFieldErrors.confirm_password}</p>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                type="button"
                onClick={closeChangePassword}
                className="rounded-md bg-gray-100 hover:bg-gray-200 px-4 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400"
              >
                {t("common.cancel")}
              </button>
              <button
                type="submit"
                disabled={pwdSaving}
                className="inline-flex items-center justify-center rounded-md bg-indigo-600 hover:bg-indigo-700 px-4 py-2 text-sm text-white font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                {pwdSaving ? t("common.processing") : t("auth.changePassword")}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Content area */}
      <main className="flex-1 p-6">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white px-6 py-3 text-center text-sm text-gray-500">
        {t("footer.portal")}
      </footer>
    </div>
  );
};

export default DashboardLayout;