const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

export const getToken = () => localStorage.getItem("token");

export const setToken = (token: string | null) => {
  if (!token) {
    localStorage.removeItem("token");
    return;
  }
  localStorage.setItem("token", token);
};

export const apiFetch = async <T>(path: string, options: RequestInit = {}): Promise<T> => {
  const token = getToken();
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ error: "Request failed" }));
    throw new Error(errorBody.error || "Request failed");
  }

  return response.json() as Promise<T>;
};
