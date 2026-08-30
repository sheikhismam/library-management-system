import React from "react";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../context/I18nContext";

const AuthLayout = ({ onLogin }) => {
  const { t } = useI18n();
  const [form, setForm] = React.useState({ username: "", password: "" });
  const { isAuthenticated, login: loginContext } = useAuth();

  if (isAuthenticated) {
    // If already logged in, redirect to dashboard
    onLogin();
    return null;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await loginContext(form);
      onLogin();
    } catch (error) {
      console.error("Login error:", error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-lg shadow-md">
        <h2 className="text-2xl font-bold text-center text-gray-900">
          {t("auth.title")}
        </h2>

        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          <div>
            <label className="block mb-2 text-sm font-medium text-gray-700 uppercase tracking-wider">
              {t("auth.username")}
            </label>
            <input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              required=""
              className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              placeholder="admin"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
            />
          </div>

          <div>
            <label className="block mb-2 text-sm font-medium text-gray-700 uppercase tracking-wider">
              {t("auth.password")}
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required=""
              className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              placeholder="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>

          <button
            type="submit"
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 auto-animate"
          >
            {t("auth.signIn")}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AuthLayout;