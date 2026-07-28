import React, { useState, useEffect } from 'react';
import { QrCode, Search, Filter } from "lucide-react";
import { useNavigate } from 'react-router-dom';
import { TransactionList } from './TransactionList';

const formatCurrency = (val) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(val || 0);
};

export function TransactionsPage() {
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  // ফিল্টার স্টেট
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  //base বেস URL
  const API_URL = import.meta.env.MODE === 'production' ? 'https://thunder-m.vercel.app' : 'http://localhost:5000';

  // ব্যাকএন্ড থেকে রিয়েল ডাটা ফেচ করা
  const fetchTransactions = () => {
    setLoading(true);
    fetch(`${API_URL}/api/transactions`)
      .then(res => res.json())
      .then(data => {
        if (data.success && Array.isArray(data.transactions)) {
          setTransactions(data.transactions);
        } else if (Array.isArray(data)) {
          setTransactions(data);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load transactions', err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchTransactions();
  }, [API_URL]);

  // --- ডাটাবেজ ডাটা থেকে ডাইনামিক স্ট্যাটস ক্যালকুলেশন ---
  const totalTransactionsCount = transactions.length;

  const totalVolume = transactions
    .filter(t => t.status === "Paid" || t.status === "Success" || t.status === "Completed")
    .reduce((acc, t) => acc + (Number(t.amount) || 0), 0);

  const pendingAmount = transactions
    .filter(t => t.status === "Pending" || !t.status)
    .reduce((acc, t) => acc + (Number(t.amount) || 0), 0);

  const expiredCount = transactions.filter(t => t.status === "Expired").length;
  const expiredRate = totalTransactionsCount > 0 
    ? Math.round((expiredCount / totalTransactionsCount) * 100) 
    : 0;

  // --- Filtering logic ---
  const filteredTransactions = transactions.filter(t => {
    const userNameField = t.customerName || t.name || t.fullName || t.userName || t.user || t.buyerEmail || t.email || "";
    
    const matchesSearch = 
      userNameField.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.invoiceId || t.payId || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.description || t.orderId || "").toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'All' || t.status === statusFilter;

    const tDate = new Date(t.date || t.createdAt);
    const matchesFrom = fromDate ? tDate >= new Date(fromDate) : true;
    const matchesTo = toDate ? tDate <= new Date(toDate) : true;

    return matchesSearch && matchesStatus && matchesFrom && matchesTo;
  });

  const handleClearFilter = () => {
    setSearchTerm('');
    setStatusFilter('All');
    setFromDate('');
    setToDate('');
  };

  return (
    <div className="p-8 bg-[#F9FAFB] min-h-screen">
      {/* Page header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Transactions</h1>
          <p className="text-sm text-gray-500 mt-1">View all payment activity</p>
        </div>
        <button 
          onClick={() => navigate('/create-qr')} 
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-3 rounded-xl font-semibold flex items-center gap-2 shadow-sm transition cursor-pointer"
        >
          <QrCode size={20} /> Create QR
        </button>
      </div>

      {/* --- ১.Dynamic status card --- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Total Transactions</span>
          <div className="text-3xl font-black text-gray-900 mt-3">
            {loading ? "0" : totalTransactionsCount.toLocaleString()}
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Total Volume</span>
          <div className="text-3xl font-black text-gray-900 mt-3">
            {loading ? "$0.00" : formatCurrency(totalVolume)}
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Pending Amount</span>
          <div className="text-3xl font-black text-[#2563EB] mt-3">
            {loading ? "$0.00" : formatCurrency(pendingAmount)}
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Expired Rate</span>
          <div className="text-3xl font-black text-[#EF4444] mt-3">
            {loading ? "0%" : `${expiredRate}%`}
          </div>
        </div>
      </div>

      {/* --- 2 Filter search kora --- */}
      <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-center">
        <div className="relative">
          <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1">Search</label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400">
              <Search size={16} />
            </span>
            <input 
              type="text" 
              placeholder="Invoice ID, user name, email..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1">Status</label>
          <select 
            value={statusFilter} 
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-emerald-500"
          >
            <option value="All">All</option>
            <option value="Pending">Pending</option>
            <option value="Paid">Paid / Success</option>
            <option value="Expired">Expired</option>
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1">From</label>
          <input 
            type="date" 
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-emerald-500 text-gray-600"
          />
        </div>

        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1">To</label>
          <input 
            type="date" 
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-emerald-500 text-gray-600"
          />
        </div>

        <div className="flex items-end gap-2 pt-5">
          <button className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded-xl text-sm font-semibold flex items-center justify-center gap-1 transition cursor-pointer shadow-sm">
            <Filter size={16} /> Filter
          </button>
          <button 
            onClick={handleClearFilter}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl text-sm font-semibold transition cursor-pointer"
          >
            Clear
          </button>
        </div>
      </div>

      {/* --- 3 transaction list table --- */}
      <TransactionList items={filteredTransactions} loading={loading} />
    </div>
  );
}