import { createContext, useContext, useState, useEffect } from "react";
import { api } from "../api/api";

const AuthContextProvider = createContext({
  user: null,
  isAuthenticated: false,
  isInitializing: true,
  login: (credentials) => {},
  logout: () => {},
  refreshToken: () => {},
});

// Use this hook to access the context
export const useAuth = () => {
  return useContext(AuthContextProvider);
};

// Provider component
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

  // Restore authentication on mount: the shared `api` instance attaches the stored
  // access token automatically and refreshes it (and retries) if the backend returns
  // 401, so a successful login stays authenticated after a page refresh.
  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      setIsAuthenticated(false);
      setUser(null);
      setIsInitializing(false);
      return;
    }
    api
      .get("/api/v1/auth/me/")
      .then((res) => {
        setIsAuthenticated(true);
        setUser(res.data);
      })
      .catch(() => {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        setIsAuthenticated(false);
        setUser(null);
      })
      .finally(() => setIsInitializing(false));
  }, []);

  const login = async (credentials) => {
    try {
      const { data } = await api.post("/api/v1/auth/login/", credentials);
      if (data.access) {
        localStorage.setItem("access_token", data.access);
        localStorage.setItem("refresh_token", data.refresh);
        setIsAuthenticated(true);
        api
          .get("/api/v1/auth/me/")
          .then((res) => setUser(res.data))
          .catch(() => setUser(null));
      }
    } catch (error) {
      console.error("Login failed:", error);
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    setIsAuthenticated(false);
    setUser(null);
  };

  const refreshToken = async () => {
    try {
      const { data } = await api.post("/api/v1/auth/refresh/", {
        refresh: localStorage.getItem("refresh_token"),
      });
      if (data.access) {
        localStorage.setItem("access_token", data.access);
        return data.access;
      }
    } catch (error) {
      console.error("Token refresh failed:", error);
    }
  };

  return (
    <AuthContextProvider
      value={{ user, isAuthenticated, isInitializing, login, logout, refreshToken }}
    >
      {children}
    </AuthContextProvider>
  );
};