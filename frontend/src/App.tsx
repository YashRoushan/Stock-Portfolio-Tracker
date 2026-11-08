import React, { lazy, Suspense } from "react";
import { Route, Routes, Navigate } from "react-router-dom";
import { AuthProvider } from "./hooks/useAuth";
import ProtectedRoute from "./components/ProtectedRoute";
import LoginPage from "./pages/Login";
import RegisterPage from "./pages/Register";
import Layout from "./components/Layout";

const DashboardPage = lazy(() => import("./pages/Dashboard"));
const MarketQuotesPage = lazy(() => import("./pages/MarketQuotes"));
const PortfolioPage = lazy(() => import("./pages/Portfolio"));

const App = () => {
  return (
    <AuthProvider>
      <Suspense
        fallback={
          <Layout>
            <p role="status" aria-live="polite" className="py-8 text-ink/70">
              Loading…
            </p>
          </Layout>
        }
      >
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/market" element={<MarketQuotesPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/portfolio/:id"
            element={
              <ProtectedRoute>
                <PortfolioPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </AuthProvider>
  );
};

export default App;
