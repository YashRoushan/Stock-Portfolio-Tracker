import React, { createContext, useContext, useMemo, useState } from "react";
import { apiFetch, getToken, setToken } from "../api/client";

export type AuthUser = { id: string; email: string };

type AuthContextValue = {
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  demo: () => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const storedUser = (): AuthUser | null => {
  try {
    const raw = localStorage.getItem("user");
    if (!raw || !getToken()) return null;
    const value: unknown = JSON.parse(raw);
    if (
      value &&
      typeof value === "object" &&
      "id" in value &&
      typeof value.id === "string" &&
      "email" in value &&
      typeof value.email === "string"
    )
      return { id: value.id, email: value.email };
  } catch {
    // A malformed or unavailable saved session starts at the sign-in page.
  }
  return null;
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(storedUser());

  const authRequest = async (
    path: string,
    credentials?: { email: string; password: string },
  ) => {
    const response = await apiFetch<{ token: string; user: AuthUser }>(path, {
      method: "POST",
      body: JSON.stringify(credentials ?? {}),
    });
    try {
      setToken(response.token);
      localStorage.setItem("user", JSON.stringify(response.user));
    } catch {
      throw new Error(
        "Allow browser storage for this site to save your session.",
      );
    }
    setUser(response.user);
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      login: (email, password) =>
        authRequest("/api/auth/login", { email, password }),
      register: (email, password) =>
        authRequest("/api/auth/register", { email, password }),
      demo: () => authRequest("/api/auth/demo"),
      logout: () => {
        setToken(null);
        localStorage.removeItem("user");
        setUser(null);
      },
    }),
    [user],
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
