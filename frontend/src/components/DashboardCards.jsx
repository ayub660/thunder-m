import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { 
  Copy, Trash2, User, Check, Link as LinkIcon, QrCode, Loader2, History, ArrowDownRight 
} from "lucide-react";
import { QRCodeSVG } from 'qrcode.react';
import Swal from 'sweetalert2';

import imgGreen from '../asset/cashapp_green.png';
import imgLight from '../asset/cashapp_light.png';

export const DashboardCards = () => {
  const [paymentLinks, setPaymentLinks] = useState([]);
  const [linkIdInput, setLinkIdInput] = useState("");
  
  // ========== ENV ==========
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
  const PAYMENT_DOMAIN = import.meta.env.VITE_PAYMENT_DOMAIN || 'http://localhost:5173';

  const [selectedDomain, setSelectedDomain] = useState(PAYMENT_DOMAIN);
  
  const [newLinkTheme, setNewLinkTheme] = useState('light');
  const [showQrFor, setShowQrFor] = useState(null);

  const [qrAmount, setQrAmount] = useState('');
  const [qrDescription, setQrDescription] = useState('');
  const [qrLoading, setQrLoading] = useState(false);
  const [generatedQr, setGeneratedQr] = useState(null);

  const [paymentHistory, setPaymentHistory] = useState([]);

  const [stats, setStats] = useState({
    balance: 0,
    availableTeamBalance: 0,
    totalBillable: 0,
    totalSettled: 0,
    myOwnEarnings: 0,
    teamTotalEarnings: 0,
    totalEarnings: 0,
    totalWithdrawn: 0
  });

  const [lastBalance, setLastBalance] = useState(null);
  const isFirstLoad = useRef(true);

  const getAuth = () => {
    let email = '';
    let role = '';
    let userId = '';

    try {
      const raw = localStorage.getItem('userInfo') || localStorage.getItem('user');
      if (raw && raw !== 'undefined' && raw !== 'null') {
        const u = JSON.parse(raw);
        email = u.email || '';
        role = u.role || '';
        userId = (u.id || u._id || u.userId || '').toString();
      }
    } catch (e) {}

    if (!email) {
      email =
        localStorage.getItem('userEmail') ||
        localStorage.getItem('email') ||
        localStorage.getItem('user_email') ||
        '';
    }
    if (!role) {
      role =
        localStorage.getItem('role') ||
        localStorage.getItem('userRole') ||
        localStorage.getItem('user_role') ||
        '';
    }
    if (!userId) {
      userId =
        localStorage.getItem('userId') ||
        localStorage.getItem('id') ||
        localStorage.getItem('_id') ||
        '';
    }

    role = (role || '').toString().toLowerCase().trim();
    if (role === 'teamleader' || role === 'team-leader' || role === 'team leader') {
      role = 'team_leader';
    }
    if (role === 'master' || role === 'admin' || role === 'masteradmin') {
      role = 'master_admin';
    }

    return { email, role, userId };
  };

  const playPaymentSound = () => {
    try {
      const audio = new Audio('/sounds/cashapp.mp3');
      audio.volume = 0.9;
      audio.play().catch(() => {});
    } catch (e) {}
  };

  useEffect(() => {
    fetchPaymentLinks();
    fetchStats();
    fetchPaymentHistory();
    const interval = setInterval(() => {
      fetchStats();
      fetchPaymentHistory();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchPaymentLinks = async () => {
    try {
      const { email, role, userId } = getAuth();
      if (!email) {
        setPaymentLinks([]);
        return;
      }

      const response = await axios.get(`${API_URL}/api/payment-links`, {
        params: { email, userEmail: email, role, userId }
      });

      const allLinks = Array.isArray(response.data) ? response.data : [];
      const isMaster = role === 'master_admin' || email === 'admin@mamun.com';

      const filteredLinks = isMaster
        ? allLinks
        : allLinks.filter((link) => link.userEmail === email || link.email === email);

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

  const fetchPaymentHistory = async () => {
    try {
      const { email, role, userId } = getAuth();
      if (!email) return;

      const response = await axios.get(`${API_URL}/api/transactions`, {
        params: { email, userEmail: email, role, userId, limit: 10 }
      });

      const data = Array.isArray(response.data) ? response.data : (response.data.transactions || []);
      setPaymentHistory(data.slice(0, 10));
    } catch (error) {
      try {
        const { email, role, userId } = getAuth();
        const response = await axios.get(`${API_URL}/api/payment-history`, {
          params: { email, role, userId }
        });
        const data = Array.isArray(response.data) ? response.data : [];
        setPaymentHistory(data.slice(0, 10));
      } catch (err) {
        console.error('Error fetching payment history:', err);
      }
    }
  };

  const fetchStats = async () => {
    try {
      const { email, role, userId } = getAuth();

      if (!email) {
        console.warn('No email found in auth');
        return;
      }

      const balanceRes = await axios.get(`${API_URL}/api/balance`, {
        params: {
          email,
          userEmail: email,
          role,
          userId: userId || undefined
        }
      });

      const data = balanceRes.data || {};
      const newBalance = Number(data.balance) || 0;

      if (!isFirstLoad.current && lastBalance !== null && newBalance > lastBalance) {
        playPaymentSound();
      }
      isFirstLoad.current = false;
      setLastBalance(newBalance);

      setStats({
        balance: newBalance,
        availableTeamBalance: Number(data.availableTeamBalance) || 0,
        totalBillable: Number(data.totalBillable) || 0,
        totalSettled: Number(data.totalSettled) || 0,
        myOwnEarnings: Number(data.myOwnEarnings) || 0,
        teamTotalEarnings: Number(data.teamTotalEarnings) || 0,
        totalEarnings: Number(data.totalEarnings) || 0,
        totalWithdrawn: Number(data.totalWithdrawn) || 0
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fmt = (val) => {
    const n = Number(val) || 0;
    return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const handleGenerateQr = async () => {
    if (!qrAmount || parseFloat(qrAmount) <= 0) {
      return Swal.fire({
        icon: 'warning',
        title: 'Required',
        text: 'Please enter a valid amount',
        confirmButtonColor: '#00D54B'
      });
    }

    const { email, role, userId } = getAuth();
    setQrLoading(true);

    try {
      const res = await axios.post(`${API_URL}/api/generate-gateway-qr`, {
        amount: qrAmount,
        currency: 'USD',
        orderId: 'ORDER-' + Date.now(),
        buyerEmail: 'customer@example.com',
        userEmail: email,
        userId,
        role,
        linkId: 'pay',
        description: qrDescription || undefined
      });

      const data = res.data;
      if (data.success) {
        const lnInvoice = data.bolt11 || data.lightningInvoice || data.lnInvoice || '';
        const qrValue = (lnInvoice && lnInvoice.startsWith('lnbc'))
          ? `https://cash.app/launch/lightning/${lnInvoice}`
          : (data.checkoutLink || '');

        setGeneratedQr({
          amount: qrAmount,
          link: qrValue,
          checkoutLink: data.checkoutLink
        });

        Swal.fire({
          icon: 'success',
          title: 'QR Generated!',
          text: `Lightning QR for $${qrAmount}`,
          confirmButtonColor: '#00D54B',
          timer: 1400,
          showConfirmButton: false
        });
        setQrAmount('');
        setQrDescription('');
        fetchStats();
        fetchPaymentHistory();
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Failed',
          text: data.error || 'Failed',
          confirmButtonColor: '#00D54B'
        });
      }
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Server error',
        confirmButtonColor: '#00D54B'
      });
    } finally {
      setQrLoading(false);
    }
  };

  const handleCardThemeChange = async (id, newTheme) => {
    setPaymentLinks((prev) =>
      prev.map((link) =>
        link._id === id
          ? { ...link, theme: newTheme, image: newTheme === 'green' ? imgGreen : imgLight }
          : link
      )
    );
    try {
      await axios.put(`${API_URL}/api/payment-links/${id}`, {
        theme: newTheme,
        template: newTheme
      });
    } catch (error) {
      fetchPaymentLinks();
    }
  };

  const handleCreateLink = async () => {
    if (!linkIdInput.trim()) {
      return Swal.fire({
        icon: 'warning',
        title: 'Required',
        text: 'Please enter a link ID!',
        confirmButtonColor: '#00D54B'
      });
    }

    const { email, userId } = getAuth();
    const trimmedId = linkIdInput.trim();
    const finalUrl = `${selectedDomain}/${trimmedId}`;

    try {
      const response = await axios.post(`${API_URL}/api/create-payment-link`, {
        name: trimmedId,
        url: finalUrl,
        theme: newLinkTheme,
        template: newLinkTheme,
        createdAt: new Date(),
        userEmail: email,
        email,
        userId: userId || null
      });

      const createdTheme = (response.data.theme || newLinkTheme).toString().toLowerCase();
      const createdItem = {
        ...response.data,
        theme: createdTheme === 'green' ? 'green' : 'light',
        image: createdTheme === 'green' ? imgGreen : imgLight
      };

      setPaymentLinks([createdItem, ...paymentLinks]);
      setLinkIdInput('');
      setShowQrFor(createdItem._id);

      Swal.fire({
        icon: 'success',
        title: 'Success!',
        text: 'Payment Link Created!',
        confirmButtonColor: '#00D54B'
      });
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Oops...',
        text: 'Failed to save',
        confirmButtonColor: '#00D54B'
      });
    }
  };

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
        params: { email, role }
      });
      setPaymentLinks((prev) => prev.filter((link) => link._id !== id));
      if (showQrFor === id) setShowQrFor(null);
      Swal.fire('Deleted!', 'Payment Link Deleted!', 'success');
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error.response?.data?.error || 'Failed'
      });
    }
  };

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
        timer: 1200,
        showConfirmButton: false,
        confirmButtonColor: '#00D54B'
      });
      fetchPaymentLinks();
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to save' });
    }
  };

  return (
    <div className="w-full min-h-screen bg-[#F7F8FA] p-4 sm:p-6 md:p-8">
      <div className="w-full max-w-[1200px] mx-auto space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Overview of your activity</p>
        </div>

        {/* ========== STATS 2×4 ========== */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatCard title="AVAILABLE MY BALANCE" amount={fmt(stats.balance)} />
          <StatCard title="AVAILABLE TEAM BALANCE" amount={fmt(stats.availableTeamBalance)} highlight />
          <StatCard title="TOTAL BILLABLE" amount={fmt(stats.totalBillable)} />
          <StatCard title="TOTAL SETTLED" amount={fmt(stats.totalSettled)} />
          <StatCard title="MY OWN EARNINGS" amount={fmt(stats.myOwnEarnings)} />
          <StatCard title="TEAM TOTAL EARNINGS" amount={fmt(stats.teamTotalEarnings)} />
          <StatCard title="TOTAL EARNINGS" amount={fmt(stats.totalEarnings)} />
          <StatCard title="TOTAL WITHDRAWN" amount={fmt(stats.totalWithdrawn)} />
        </div>

        {/* ========== BOTTOM ========== */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">

          {/* LEFT — Create New QR Payment & Recent Payment History */}
          <div className="space-y-5">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sm:p-6 space-y-5">
              <h2 className="text-base font-bold text-gray-900">Create New QR Payment</h2>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Amount (USD)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-semibold">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={qrAmount}
                    onChange={(e) => setQrAmount(e.target.value)}
                    placeholder="0"
                    className="w-full pl-8 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-base font-semibold text-gray-800 outline-none focus:border-green-500 focus:bg-white transition"
                  />
                </div>
              </div>

              <div>
                <p className="text-xs text-gray-500 mb-2">Quick amounts</p>
                <div className="flex flex-wrap gap-2">
                  {['10', '50', '100', '200'].map((a) => (
                    <button
                      key={a}
                      type="button"
                      onClick={() => setQrAmount(a)}
                      className="px-4 py-1.5 rounded-full border border-gray-200 text-sm font-medium text-gray-700 hover:border-green-500 hover:text-green-600 hover:bg-green-50 transition cursor-pointer"
                    >
                      ${a}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Description (optional)</label>
                <input
                  type="text"
                  value={qrDescription}
                  onChange={(e) => setQrDescription(e.target.value)}
                  placeholder="e.g. NewYork traffic or Texas traffic"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-700 outline-none focus:border-green-500 focus:bg-white transition"
                />
                <p className="text-[11px] text-gray-400 mt-1">This is for you to remember the transaction.</p>
              </div>

              <button
                onClick={handleGenerateQr}
                disabled={qrLoading}
                className="w-full bg-[#00D54B] hover:bg-[#00c043] text-white py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition shadow-sm cursor-pointer disabled:opacity-60"
              >
                {qrLoading ? <Loader2 size={18} className="animate-spin" /> : <QrCode size={18} />}
                {qrLoading ? 'Generating...' : 'Generate QR'}
              </button>

              {generatedQr && (
                <div className="mt-2 p-5 bg-gray-50 rounded-xl border border-gray-100 flex flex-col items-center gap-4">
                  <p className="text-sm font-bold text-gray-800">${generatedQr.amount}</p>
                  
                  <div className="relative flex items-center justify-center bg-white p-3 rounded-2xl shadow-sm">
                    <QRCodeSVG value={generatedQr.link} size={300} level="H" />
                    <div className="absolute w-14 h-14 bg-[#00D54B] rounded-xl flex items-center justify-center shadow-md border-2 border-white">
                      <span className="text-white font-bold text-3xl">$</span>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(generatedQr.link);
                      Swal.fire({ icon: 'success', title: 'Copied!', timer: 1000, showConfirmButton: false });
                    }}
                    className="text-xs text-green-600 font-semibold hover:underline cursor-pointer"
                  >
                    Copy Invoice
                  </button>
                </div>
              )}
            </div>

            {/* PAYMENT HISTORY SECTION */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-green-50 text-green-600 rounded-xl">
                    <History size={16} />
                  </div>
                  <h2 className="text-base font-bold text-gray-900">Others Transactions</h2>
                </div>
                <span className="text-xs font-semibold text-green-600 cursor-pointer hover:underline">VIEW ALL</span>
              </div>

              <div className="divide-y divide-gray-100">
                {paymentHistory.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-6">No recent payment history found.</p>
                ) : (
                  paymentHistory.map((item, idx) => {
                    const isCompleted = (item.status || 'completed').toLowerCase() === 'completed' || item.success;
                    return (
                      <div key={item._id || idx} className="py-3 flex items-center justify-between gap-3 first:pt-0 last:pb-0">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${isCompleted ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'}`}>
                            <ArrowDownRight size={16} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-gray-800 truncate">
                              {item.name || item.description || item.orderId || 'Payment Received'}
                            </p>
                            <p className="text-[10px] text-gray-400 truncate">
                              {item.createdAt ? new Date(item.createdAt).toLocaleString() : 'Just now'}
                            </p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs font-bold text-gray-900">
                            +${Number(item.amount || 0).toFixed(2)}
                          </p>
                          <span className={`inline-block text-[9px] font-bold px-1.5 py-0.5 rounded-md ${isCompleted ? 'bg-green-50 text-green-600' : 'bg-yellow-50 text-yellow-600'}`}>
                            {item.status || (isCompleted ? 'Completed' : 'Pending')}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* RIGHT — Payment Link */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
              <h2 className="text-base font-bold text-gray-900">Payment Link</h2>
              <select
                value={selectedDomain}
                onChange={(e) => setSelectedDomain(e.target.value)}
                className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-700 outline-none focus:border-green-500 cursor-pointer"
              >
                <option value="http://localhost:5173">http://localhost:5173</option>
                <option value="http://pay-cash-apps.link">http://pay-cash-apps.link</option>
              </select>
            </div>

            {paymentLinks.map((item) => {
              const currentLinkDisplay = `${selectedDomain}/${item.name}`;
              const isGreenTheme = item.theme === 'green';
              const isQrOpen = showQrFor === item._id;

              return (
                <div key={item._id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className={`w-12 h-10 rounded-xl border flex items-center justify-center p-1 overflow-hidden shrink-0 ${isGreenTheme ? 'bg-green-500' : 'bg-gray-100'}`}>
                        <img src={isGreenTheme ? imgGreen : imgLight} alt="" className="w-full h-full object-cover rounded-lg" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-gray-600 truncate flex items-center gap-1 font-medium">
                          <LinkIcon size={12} className="shrink-0" />
                          <span className="truncate">{currentLinkDisplay}</span>
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => setShowQrFor(isQrOpen ? null : item._id)}
                        className={`p-2 rounded-xl cursor-pointer ${isQrOpen ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-600'}`}
                      >
                        <QrCode size={14} />
                      </button>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(currentLinkDisplay);
                          Swal.fire({ icon: 'success', title: 'Copied!', timer: 1000, showConfirmButton: false });
                        }}
                        className="p-2 bg-gray-100 text-gray-600 rounded-xl cursor-pointer"
                      >
                        <Copy size={14} />
                      </button>
                      <button
                        onClick={() => handleDeleteLink(item._id)}
                        className="p-2 bg-red-50 text-red-500 rounded-xl cursor-pointer"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-gray-50">
                    <div>
                      <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">TEMPLATE</span>
                      <p className="text-xs font-bold text-gray-800">{isGreenTheme ? 'CashApp' : 'Default'}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleCardThemeChange(item._id, isGreenTheme ? 'light' : 'green')}
                        className={`px-3 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer ${isGreenTheme ? 'bg-green-500 text-white' : 'bg-gray-900 text-white'}`}
                      >
                        {isGreenTheme ? 'CashApp' : 'Default'}
                      </button>
                      <button className="p-2 bg-gray-50 text-gray-500 rounded-lg cursor-pointer">
                        <User size={14} />
                      </button>
                      <button
                        onClick={() => handleSaveCardSettings(item)}
                        className="px-3 py-1.5 bg-green-500 text-white text-[11px] font-bold rounded-lg cursor-pointer flex items-center gap-1"
                      >
                        <Check size={12} /> Save
                      </button>
                    </div>
                  </div>

                  {isQrOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[400px] overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-3 border-b">
                          <p className="text-sm font-semibold">Payment Link QR</p>
                          <button
                            onClick={() => setShowQrFor(null)}
                            className="text-gray-400 text-xl leading-none cursor-pointer"
                          >
                            ×
                          </button>
                        </div>
                        <div className="p-6 flex flex-col items-center gap-4">
                          <div className="relative flex items-center justify-center bg-white p-2">
                            <QRCodeSVG value={currentLinkDisplay} size={300} level="H" />
                            <div className="absolute w-14 h-14 bg-[#00D54B] rounded-xl flex items-center justify-center shadow-md border-2 border-white">
                              <span className="text-white font-bold text-3xl">$</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Create new link */}
            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Link ID
                </label>
                <input
                  type="text"
                  placeholder="e.g. Jessica"
                  value={linkIdInput}
                  onChange={(e) => setLinkIdInput(e.target.value)}
                  className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 outline-none focus:border-green-500 text-sm"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setNewLinkTheme('light')}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold border-2 cursor-pointer ${
                    newLinkTheme === 'light'
                      ? 'border-green-500 bg-green-50 text-green-700'
                      : 'border-gray-200 text-gray-600'
                  }`}
                >
                  Default
                </button>
                <button
                  type="button"
                  onClick={() => setNewLinkTheme('green')}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold border-2 cursor-pointer ${
                    newLinkTheme === 'green'
                      ? 'border-green-500 bg-green-50 text-green-700'
                      : 'border-gray-200 text-gray-600'
                  }`}
                >
                  CashApp
                </button>
              </div>
              <button
                onClick={handleCreateLink}
                className="w-full bg-green-500 text-white py-3 rounded-xl font-bold text-sm hover:bg-green-600 transition cursor-pointer"
              >
                Create New Link + QR
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ title, amount, highlight }) => (
  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sm:p-6 flex flex-col justify-between min-h-[95px]">
    <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-3">
      {title}
    </p>
    <p className={`text-xl sm:text-2xl font-bold tracking-tight ${highlight ? 'text-blue-600' : 'text-gray-900'}`}>
      {amount}
    </p>
  </div>
);

export default DashboardCards;