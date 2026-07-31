import { createBrowserRouter, Navigate } from "react-router-dom";
import App from "../App";
import { DashboardCards } from "../components/DashboardCards";
import { NotFound } from "../components/NotFound";
import { CreateQrForm } from "../components/CreateQrForm";
import { UserCreate } from "../components/UserCreate";
import AmountSelectionPage from "../components/AmountSelectionPage";
import PublicCheckout from "../components/PublicCheckout";
import { WithdrawalForm } from "../components/WithdrawalForm";
import { Profile } from "../components/Profile";
import { TransactionsPage } from "../components/TransactionsPage";
import { WithdrawalsAdmin } from "../components/WithdrawalsAdmin";
import { Login } from "../pages/Login";
import React, { useState, useEffect } from "react";

const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem("token");
  const userInfo = localStorage.getItem("userInfo");
  if (!token || !userInfo) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

const WithdrawalsWrapper = () => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const storedUser = localStorage.getItem("userInfo");
      if (storedUser) {
        const parsedUser = JSON.parse(storedUser);
        if (
          parsedUser.role === "master_admin" ||
          parsedUser.role === "admin" ||
          parsedUser.email === "admin@mamun.com"
        ) {
          setIsAdmin(true);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  if (loading) {
    return (
      <div className="p-8 text-center text-gray-500 font-medium">Loading...</div>
    );
  }

  return isAdmin ? <WithdrawalsAdmin /> : <WithdrawalForm />;
};

export const router = createBrowserRouter([
  {
    path: "/login",
    element: <Login />,
  },
  {
    path: "/",
    element: (
      <ProtectedRoute>
        <App />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <DashboardCards /> },
      { path: "create-qr", element: <CreateQrForm /> },
      { path: "transactions", element: <TransactionsPage /> },
      { path: "withdrawals", element: <WithdrawalsWrapper /> },
      { path: "withdrawals-admin", element: <WithdrawalsAdmin /> },
      { path: "users", element: <UserCreate /> },
      { path: "profile", element: <Profile /> },
      { path: "*", element: <NotFound /> },
    ],
  },

  // ========== Payment Public Routes ==========
  // 2nd page (QR) — specific route আগে
  {
    path: "/:linkId/i/:invoiceId",
    element: <PublicCheckout />,
  },
  {
    path: "/i/:invoiceId",
    element: <PublicCheckout />,
  },
  // 1st page (Amount)
  {
    path: "/:linkId",
    element: <AmountSelectionPage />,
  },
]);