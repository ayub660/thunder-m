import { createBrowserRouter } from "react-router-dom";
import App from "../App";

// Components
import { DashboardCards } from "../components/DashboardCards";
import { NotFound } from "../components/NotFound";
import { CreateQrForm } from "../components/CreateQrForm";
import { UserCreate } from "../components/UserCreate";
import { PaymentCheckout } from "../components/PaymentCheckout";
import { WithdrawalForm } from "../components/WithdrawalForm";
import { Profile } from "../components/Profile";
import { TransactionsPage } from "../components/TransactionsPage";
import { WithdrawalsAdmin } from "../components/WithdrawalsAdmin";

// Pages
import { Login } from "../pages/Login";
import React, { useState, useEffect } from 'react';

// প্রোটেক্টেড উইথড্র পেজ রুট র‍্যাপার (শুধুমাত্র লজিক হ্যান্ডেল করবে)
const WithdrawalsWrapper = () => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const storedUser = localStorage.getItem('userInfo');
      if (storedUser) {
        const parsedUser = JSON.parse(storedUser);
        if (parsedUser.role === 'master_admin' || parsedUser.role === 'admin' || parsedUser.email === 'admin@mamun.com') {
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
    return <div className="p-8 text-center text-gray-500 font-medium">Loading...</div>;
  }

  // রোল অনুযায়ী শুধু সংশ্লিষ্ট কম্পোনেন্ট রিটার্ন করবে
  return isAdmin ? <WithdrawalsAdmin /> : <WithdrawalForm />;
};

export const router = createBrowserRouter([
  {
    path: "/login",
    element: <Login />,
  },
  {
    path: "/",
    element: <App />,
    children: [
      {
        index: true,
        element: <DashboardCards />,
      },
      {
        path: "create-qr",
        element: <CreateQrForm />,
      },
      {
        path: "transactions",
        element: <TransactionsPage />,
      },
      {
        path: "withdrawals",
        element: <WithdrawalsWrapper />,
      },
      {
        path: "withdrawals-admin",
        element: <WithdrawalsAdmin />,
      },
      {
        path: "users",
        element: <UserCreate />,
      },
      {
        path: "profile",
        element: <Profile />,
      },
      {
        path: ":linkId",
        element: <PaymentCheckout />,
      },
      {
        path: "*",
        element: <NotFound />,
      },
    ],
  },
]);