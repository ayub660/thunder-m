import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { CreateQrForm } from './CreateQrForm';
import { Wallet, Users, Coins, Receipt, TrendingUp, PiggyBank, ArrowDownToLine, Copy, Trash2, User, Check, Link as LinkIcon } from "lucide-react";
import Swal from 'sweetalert2';

import imgGreen from '../asset/cashapp_green.png';
import imgLight from '../asset/cashapp_light.png';

export const DashboardCards = () => {
  const [paymentLinks, setPaymentLinks] = useState([]);
  const [linkIdInput, setLinkIdInput] = useState("");
  const [amount, setAmount] = useState("10");
  const [selectedDomain, setSelectedDomain] = useState(window.location.origin);
  const [newLinkTheme, setNewLinkTheme] = useState('light');

  const [stats, setStats] = useState({
    balance: "$0.00",
    myOwnEarnings: "$0.00",
    teamTotalEarnings: "$0.00",
    totalEarnings: "$0.00",
    totalWithdrawn: "$0.00"
  });

  const API_URL = import.meta.env.MODE === 'production'
    ? 'https://thunder-m.vercel.app'
    : 'http://localhost:5000';

  // ========== AUTH (কোনো default admin নেই) ==========
  const getAuth = () => {
    let email =
      localStorage.getItem('userEmail') ||
      localStorage.getItem('email') ||
      localStorage.getItem('user_email') ||
      '';

    let role =
      localStorage.getItem('role') ||
      localStorage.getItem('userRole') ||
      localStorage.getItem('user_role') ||
      '';

    let userId =
      localStorage.getItem('userId') ||
      localStorage.getItem('id') ||
      '';

    try {
      const raw = localStorage.getItem('userInfo') || localStorage.getItem('user');
      if (raw) {
        const u = JSON.parse(raw);
        if (!email) email = u.email || '';
        if (!role) role = u.role || '';
        if (!userId) userId = (u.id || u._id || u.userId || '').toString();
      }
    } catch (e) {}

    return { email, role, userId };
  };

  const { email: userEmail, role, userId } = getAuth();

  const isMasterAdmin =
    role === 'master_admin' ||
    userEmail === 'admin@mamun.com';

  useEffect(() => {
    fetchPaymentLinks();
    fetchStats();
  }, []);

  // ========== FETCH PAYMENT LINKS ==========
  const fetchPaymentLinks = async () => {
    try {
      const { email, role, userId } = getAuth();

      if (!email) {
        console.warn('No user email in localStorage');
        setPaymentLinks([]);
        return;
      }

      const response = await axios.get(`${API_URL}/api/payment-links`, {
        params: {
          email,
          userEmail: email,
          role,
          userId
        }
      });

      const allLinks = Array.isArray(response.data) ? response.data : [];

      // Double safety filter on frontend
      const isMaster =
        role === 'master_admin' ||
        email === 'admin@mamun.com';

      const filteredLinks = isMaster
        ? allLinks
        : allLinks.filter(
            (link) =>
              link.userEmail === email ||
              link.email === email
          );

      const linksWithTheme = filteredLinks.map((link) => {
        const theme = (link.theme || link.template || 'light').toString().toLowerCase();
        const isGreen = theme === 'green';
        return {
          ...link,
          theme: isGreen ? 'green' : 'light',
          image: isGreen ? imgGreen : imgLight
        };
      });

      setPaymentLinks(linksWithTheme);
    } catch (error) {
      console.error('Error fetching payment links:', error);
      setPaymentLinks([]);
    }
  };

  // ========== FETCH STATS ==========
  const fetchStats = async () => {
    try {
      const { email, role, userId } = getAuth();

      const response = await axios.get(`${API_URL}/api/balance`, {
        params: {
          email,
          userEmail: email,
          role,
          userId
        }
      });

      const data = response.data || {};

      setStats({
        balance: `$${(Number(data.balance) || 0).toLocaleString()}.00`,
        myOwnEarnings: `$${(Number(data.myOwnEarnings) || 0).toLocaleString()}.00`,
        teamTotalEarnings: `$${(Number(data.teamTotalEarnings) || 0).toLocaleString()}.00`,
        totalEarnings: `$${(Number(data.totalEarnings) || 0).toLocaleString()}.00`,
        totalWithdrawn: `$${(Number(data.totalWithdrawn) || 0).toLocaleString()}.00`
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  // ========== THEME AUTO SAVE ==========
  const handleCardThemeChange = async (id, newTheme) => {
    setPaymentLinks((prev) =>
      prev.map((link) => {
        if (link._id === id) {
          return {
            ...link,
            theme: newTheme,
            image: newTheme === 'green' ? imgGreen : imgLight
          };
        }
        return link;
      })
    );

    try {
      await axios.put(`${API_URL}/api/payment-links/${id}`, {
        theme: newTheme,
        template: newTheme
      });
    } catch (error) {
      console.error('Error updating theme:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Failed to update theme in database'
      });
      fetchPaymentLinks();
    }
  };

  // ========== CREATE LINK ==========
  const handleCreateLink = async () => {
    if (!linkIdInput.trim()) {
      Swal.fire({
        icon: 'warning',
        title: 'Required',
        text: 'Please enter a name for the link ID!',
        confirmButtonColor: '#00D54B'
      });
      return;
    }

    const { email, userId } = getAuth();
    const trimmedId = linkIdInput.trim();
    const finalUrl = `${selectedDomain}/${trimmedId}`;

    const newLinkData = {
      name: trimmedId,
      url: finalUrl,
      theme: newLinkTheme,
      template: newLinkTheme,
      amount: amount,
      createdAt: new Date(),
      userEmail: email,
      email: email,
      userId: userId || null
    };

    try {
      const response = await axios.post(`${API_URL}/api/create-payment-link`, newLinkData);

      const createdTheme = (response.data.theme || newLinkTheme).toString().toLowerCase();
      const createdItem = {
        ...response.data,
        theme: createdTheme === 'green' ? 'green' : 'light',
        image: createdTheme === 'green' ? imgGreen : imgLight
      };

      setPaymentLinks([createdItem, ...paymentLinks]);
      setLinkIdInput('');

      Swal.fire({
        icon: 'success',
        title: 'Success!',
        text: 'Payment Link Created Successfully with selected theme!',
        confirmButtonColor: '#00D54B'
      });
    } catch (error) {
      console.error('Error creating link:', error);
      Swal.fire({
        icon: 'error',
        title: 'Oops...',
        text: 'Failed to save payment link',
        confirmButtonColor: '#00D54B'
      });
    }
  };

  // ========== DELETE LINK ==========
  const handleDeleteLink = async (id) => {
    const result = await Swal.fire({
      title: 'Are you sure?',
      text: "You won't be able to revert this!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, delete it!'
    });

    if (!result.isConfirmed) return;

    try {
      const { email, role } = getAuth();

      await axios.delete(`${API_URL}/api/payment-links/${id}`, {
        params: {
          email,
          role
        }
      });

      setPaymentLinks((prev) => prev.filter((link) => link._id !== id));

      Swal.fire('Deleted!', 'Payment Link Deleted Successfully!', 'success');
    } catch (error) {
      console.error('Delete Error:', error.response?.data || error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error.response?.data?.error || 'Failed to delete payment link'
      });
    }
  };

  // ========== SAVE SETTINGS ==========
  const handleSaveCardSettings = async (link) => {
    try {
      const currentLink = paymentLinks.find((l) => l._id === link._id) || link;

      await axios.put(`${API_URL}/api/payment-links/${link._id}`, {
        theme: currentLink.theme,
        template: currentLink.theme,
        name: currentLink.name,
        url: `${selectedDomain}/${currentLink.name}`
      });

      Swal.fire({
        icon: 'success',
        title: 'Saved!',
        text: `Theme and settings saved successfully for ${currentLink.name}!`,
        confirmButtonColor: '#00D54B',
        timer: 1500,
        showConfirmButton: false
      });

      fetchPaymentLinks();
    } catch (error) {
      console.error('Error updating link settings:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Failed to save settings'
      });
    }
  };

  return (
    <div className="w-full box-border">
      <div className="w-full max-w-[1400px] mx-auto space-y-3.5 box-border">
        <h1 className="text-lg sm:text-2xl font-bold text-gray-800 px-1">Dashboard</h1>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3 w-full box-border">
          <StatCard title="AVAILABLE BALANCE" amount={stats.balance} icon={<Wallet className="text-green-500" size={18} />} />
          <StatCard title="MY OWN EARNINGS" amount={stats.myOwnEarnings} icon={<PiggyBank className="text-green-500" size={18} />} />
          <StatCard title="TEAM TOTAL EARNINGS" amount={stats.teamTotalEarnings} icon={<Users className="text-green-500" size={18} />} />
          <StatCard title="TOTAL EARNINGS" amount={stats.totalEarnings} icon={<Coins className="text-green-500" size={18} />} />
          <StatCard title="TOTAL WITHDRAWN" amount={stats.totalWithdrawn} icon={<ArrowDownToLine className="text-green-500" size={18} />} />
          <StatCard title="TOTAL BILLABLE" amount="$0.00" icon={<Receipt className="text-green-500" size={18} />} />
          <StatCard title="TOTAL SETTLED" amount="0" icon={<TrendingUp className="text-green-500" size={18} />} />
        </div>

        <div className="flex flex-col lg:grid lg:grid-cols-2 gap-3.5 w-full items-start box-border">
          {/* Left: QR Form */}
          <div className="w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-3.5 sm:p-5 box-border overflow-hidden">
            <CreateQrForm />
          </div>

          {/* Right: Payment Links */}
          <div className="w-full space-y-3 box-border">
            <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-2.5 bg-white p-3.5 rounded-2xl border border-gray-100 shadow-sm w-full box-border">
              <h2 className="text-sm font-bold text-gray-800">Payment Link</h2>
              <select
                value={selectedDomain}
                onChange={(e) => setSelectedDomain(e.target.value)}
                className="w-full sm:w-auto px-3 py-2 bg-gray-50 border border-green-500 rounded-xl text-xs font-medium text-gray-700 outline-none focus:ring-2 focus:ring-green-100 cursor-pointer shadow-sm"
              >
                <option value={window.location.origin}>{window.location.origin}</option>
                <option value="https://www.payecash.app">https://www.2nddomain.app</option>
                <option value="https://www.payin-cash.app">https://www.3rddomain.app</option>
              </select>
            </div>

            {paymentLinks.map((item) => {
              const currentLinkDisplay = `${selectedDomain}/${item.name}`;
              const isGreenTheme = item.theme === 'green';

              return (
                <div key={item._id} className="w-full bg-white p-3.5 rounded-2xl border border-gray-100 shadow-sm space-y-3 box-border overflow-hidden">
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className={`w-11 h-9 sm:w-12 sm:h-10 rounded-xl border flex items-center justify-center p-1 shadow-sm overflow-hidden flex-shrink-0 ${isGreenTheme ? 'bg-green-500' : 'bg-gray-100'}`}>
                        <img
                          src={isGreenTheme ? imgGreen : imgLight}
                          alt="Theme Preview"
                          className="w-full h-full object-cover rounded-lg"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] text-gray-500 truncate flex items-center gap-1 font-medium">
                          <LinkIcon size={11} className="flex-shrink-0" />
                          <span className="truncate">{currentLinkDisplay}</span>
                        </p>
                        <p className="text-[10px] text-green-600 font-semibold truncate mt-0.5">
                          Creator: {item.userEmail || item.email || userEmail}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(currentLinkDisplay);
                          Swal.fire({
                            icon: 'success',
                            title: 'Copied!',
                            text: 'Link Copied to clipboard!',
                            timer: 1200,
                            showConfirmButton: false
                          });
                        }}
                        className="p-2 bg-green-50 active:bg-green-100 text-green-600 rounded-xl transition cursor-pointer"
                        title="Copy Link"
                      >
                        <Copy size={14} />
                      </button>

                      <button
                        onClick={() => handleDeleteLink(item._id)}
                        className="p-2 bg-red-50 active:bg-red-100 text-red-600 rounded-xl transition cursor-pointer"
                        title="Delete Link"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-gray-100">
                    <div className="flex-shrink-0">
                      <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider block">TEMPLATE</span>
                      <span className="text-xs font-bold text-gray-800">
                        {isGreenTheme ? 'CashApp' : 'Default'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap justify-end">
                      <button
                        onClick={() => handleCardThemeChange(item._id, isGreenTheme ? 'light' : 'green')}
                        className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition cursor-pointer flex items-center gap-1 ${
                          isGreenTheme
                            ? 'bg-green-500 text-white shadow-sm'
                            : 'bg-gray-900 text-white'
                        }`}
                        title="Toggle Theme"
                      >
                        {isGreenTheme ? 'CashApp' : 'Default'}
                      </button>

                      <button className="p-2 bg-gray-50 active:bg-gray-100 text-gray-600 rounded-lg transition cursor-pointer" title="User View">
                        <User size={14} />
                      </button>

                      <button
                        onClick={() => handleSaveCardSettings(item)}
                        className="px-3 py-1.5 bg-green-500 active:bg-green-600 text-white text-[11px] font-bold rounded-lg transition cursor-pointer shadow-sm flex items-center gap-1"
                      >
                        <Check size={12} /> Save
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Create New Link */}
            <div className="w-full bg-white p-4 sm:p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4 box-border">
              <div>
                <label className="block text-[11px] font-bold text-gray-800 uppercase tracking-wider mb-1.5">
                  Link ID (text)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Stephanie"
                  value={linkIdInput}
                  onChange={(e) => setLinkIdInput(e.target.value)}
                  className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100 transition-all font-medium text-sm box-border"
                />
                <p className="text-[10px] text-gray-400 mt-1.5">
                  This will be your unique payment URL based on selected domain.
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-800 uppercase tracking-wider mb-1.5">
                  Select Initial Theme
                </label>
                <div className="flex gap-2.5">
                  <button
                    type="button"
                    onClick={() => setNewLinkTheme('light')}
                    className={`flex-1 py-2.5 rounded-xl font-bold text-xs border-2 transition cursor-pointer ${
                      newLinkTheme === 'light'
                        ? 'border-green-500 bg-green-50 text-green-700'
                        : 'border-gray-200 text-gray-600'
                    }`}
                  >
                    Default (Light)
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewLinkTheme('green')}
                    className={`flex-1 py-2.5 rounded-xl font-bold text-xs border-2 transition cursor-pointer ${
                      newLinkTheme === 'green'
                        ? 'border-green-500 bg-green-50 text-green-700'
                        : 'border-gray-200 text-gray-600'
                    }`}
                  >
                    CashApp (Green)
                  </button>
                </div>
              </div>

              <button
                onClick={handleCreateLink}
                className="w-full bg-green-500 text-white py-3.5 rounded-xl font-bold active:bg-green-600 hover:bg-green-600 transition-all duration-300 shadow-lg shadow-green-100 cursor-pointer box-border text-sm"
              >
                Create New Link
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ title, amount, icon }) => (
  <div className="bg-white p-3 sm:p-4 rounded-xl shadow-sm border border-gray-100 w-full box-border">
    <div className="mb-1.5">{icon}</div>
    <p className="text-[9px] sm:text-[10px] tracking-wider text-gray-400 font-bold mb-0.5 leading-tight">{title}</p>
    <h3 className="text-base sm:text-lg font-bold text-gray-800 truncate">{amount}</h3>
  </div>
);

export default DashboardCards;