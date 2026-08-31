import axios from "axios";

// Base API URL - overridden by Vite environment variables.
// In production the SPA and API share one origin (nginx proxies /api to Django),
// so an unset VITE_API_URL means same-origin relative requests. The localhost
// fallback below is for the Vite dev server only.
const API_BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? "" : "http://127.0.0.1:8000");

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
    "Accept": "application/json",
  },
  withCredentials: false, // Use header-based auth (JWT token)
});

// Attach JWT token to every request if present
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("access_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Automatically refresh the access token and retry the request once when the backend
// returns 401, so a logged-in user survives token expiry without re-authenticating.
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const refresh = localStorage.getItem("refresh_token");
    if (
      error.response?.status === 401 &&
      refresh &&
      !originalRequest._retry
    ) {
      originalRequest._retry = true;
      try {
        const { data } = await axios.post(`${API_BASE_URL}/api/v1/auth/refresh/`, {
          refresh,
        });
        localStorage.setItem("access_token", data.access);
        originalRequest.headers.Authorization = `Bearer ${data.access}`;
        return api(originalRequest);
      } catch (refreshError) {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  }
);

// Helper to get auth headers
export const getAuthHeaders = () => {
  const token = localStorage.getItem("access_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// Extract a user-facing message from a failed API request.
// Prefers the server `detail` (DRF 409/4xx/5xx), then JSON/plain-text bodies,
// and finally returns the provided fallback so UI never shows a raw technical error.
export const apiErrorMessage = (err, fallback) => {
  const data = err?.response?.data;
  if (data == null) return fallback;
  if (typeof data === "string" && data.trim()) return data.trim();
  if (typeof data === "object" && typeof data.detail === "string" && data.detail.trim()) {
    return data.detail.trim();
  }
  if (Array.isArray(data) && data.length && typeof data[0] === "string" && data[0].trim()) {
    return data[0].trim();
  }
  return fallback;
};

// Login function
export const login = async (credentials) => {
  const response = await axios.post(`${API_BASE_URL}/api/v1/auth/login/`, credentials);
  if (response.data.access) {
    localStorage.setItem("access_token", response.data.access);
    localStorage.setItem("refresh_token", response.data.refresh);
    return response.data;
  }
  throw new Error("Login failed");
};

// Logout function
export const logout = () => {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
  // Optionally call the backend logout endpoint
  // axios.post(`${API_BASE_URL}/api/v1/auth/logout/`);
};

// Refresh token function
export const refreshToken = async () => {
  const response = await axios.post(`${API_BASE_URL}/api/v1/auth/refresh/`, {
    refresh: localStorage.getItem("refresh_token"),
  });
  if (response.data.access) {
    localStorage.setItem("access_token", response.data.access);
    return response.data;
  }
  throw new Error("Token refresh failed");
};

// Check if user is authenticated
export const isAuthenticated = () => {
  return !!localStorage.getItem("access_token");
};

export { api };

export default {
  login,
  logout,
  refreshToken,
  isAuthenticated,
  getAuthHeaders,
  api,
};