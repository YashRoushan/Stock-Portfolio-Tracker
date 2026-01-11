import React, { createContext, useContext, useMemo, useState } from "react";
import { apiFetch, setToken } from "../api/client";

export type AuthUser = { id: string; email: string };

type AuthContextValue = {
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const storedUser = () => {
  const raw = localStorage.getItem("user");
  return raw ? (JSON.parse(raw) as AuthUser) : null;
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(storedUser());

  const authRequest = async (path: string, email: string, password: string) => {
    const response = await apiFetch<{ token: string; user: AuthUser }>(path, {
      method: "POST",
      body: JSON.stringify({ email, password })
    });
    setToken(response.token);
    localStorage.setItem("user", JSON.stringify(response.user));
    setUser(response.user);
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      login: (email, password) => authRequest("/api/auth/login", email, password),
      register: (email, password) => authRequest("/api/auth/register", email, password),
      logout: () => {
        setToken(null);
        localStorage.removeItem("user");
        setUser(null);
      }
    }),
    [user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("AuthProvider missing");
  }
  return ctx;
};
