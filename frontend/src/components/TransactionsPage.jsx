import React, { useState, useEffect } from 'react';
import { QrCode, Search, Filter, DollarSign, Edit } from "lucide-react";
import { useNavigate } from 'react-router-dom';
import { TransactionList } from './TransactionList';
import Swal from 'sweetalert2';

const formatCurrency = (val) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(val || 0);
};

export function TransactionsPage() {
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState([]);
  const [usersSummary, setUsersSummary] = useState([]);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const API_URL = import.meta.env.MODE === 'production' 
    ? 'https://thunder-m.vercel.app' 
    : 'http://localhost:5000';

  const fetchTransactions = () => {
    setLoading(true);

    let storedUser = {};
    try {
      const rawData = localStorage.getItem('userInfo') || 
                      localStorage.getItem('user') || 
                      localStorage.getItem('admin') || 
                      localStorage.getItem('merchant');
      storedUser = rawData ? JSON.parse(rawData) : {};
    } catch (e) {
      storedUser = {};
    }

    const userId = storedUser._id || storedUser.id || localStorage.getItem('userId') || '';
    const userEmail = storedUser.email || localStorage.getItem('userEmail') || '';
    let role = storedUser.role || storedUser.type || localStorage.getItem('role') || '';

    if (!role) {
      role = (userEmail === 'admin@mamun.com') ? 'master_admin' : 'single';
    }

    // ১. ট্রানজেকশন ফেচ করা
    fetch(`${API_URL}/api/transactions?userId=${encodeURIComponent(userId)}&userEmail=${encodeURIComponent(userEmail)}&role=${encodeURIComponent(role)}`)
      .then(res => res.json())
      .then(data => {
        if (data.success && Array.isArray(data.transactions)) {
          setTransactions(data.transactions);
        } else if (Array.isArray(data)) {
          setTransactions(data);
        } else {
          setTransactions([]);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load transactions', err);
        setLoading(false);
      });

    // ২. মাস্টার অ্যাডমিন হলে ইউজারদের সামারি (ব্যালেন্স ও উইথড্র হিসাব) ফেচ করা
    if (role === 'master_admin' || userEmail === 'admin@mamun.com') {
      fetch(`${API_URL}/api/admin/users-summary`)
        .then(res => res.json())
        .then(data => {
          if (data.success && Array.isArray(data.users)) {
            setUsersSummary(data.users);
          }
        })
        .catch(err => console.error('Failed to load users summary', err));
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [API_URL]);

  // ইউজার ইনফো এডিট করার ফাংশন
  const handleEditUser = async (user) => {
    const { value: formValues } = await Swal.fire({
      title: 'Edit User Info',
      html:
        `<input id="swal-input-name" class="swal2-input" placeholder="Name" value="${user.name || ''}">` +
        `<input id="swal-input-email" class="swal2-input" placeholder="Email" value="${user.email || ''}">`,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: 'Update',
      confirmButtonColor: '#10B981',
      preConfirm: () => {
        return {
          name: document.getElementById('swal-input-name').value,
          email: document.getElementById('swal-input-email').value
        }
      }
    });

    if (formValues) {
      try {
        const res = await fetch(`${API_URL}/api/admin/users/${user._id || user.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formValues)
        });
        const data = await res.json();
        if (res.ok) {
          Swal.fire('Updated!', 'User info updated successfully.', 'success');
          fetchTransactions();
        } else {
          Swal.fire('Error!', data.message || 'Failed to update', 'error');
        }
      } catch (err) {
        Swal.fire('Error!', 'Server connection error', 'error');
      }
    }
  };

  // অ্যাডমিন কর্তৃক উইথড্র / পে (Pay / Withdraw) হ্যান্ডলার (Insufficient Balance চেক সহ)
  const handleAdminWithdraw = async (targetUser) => {
    const availableBalance = Number(targetUser.availableBalance || 0);

    const { value: amount } = await Swal.fire({
      title: `Withdraw for ${targetUser.name || targetUser.email}`,
      input: 'number',
      inputLabel: `Available Balance: $${availableBalance.toFixed(2)}`,
      inputPlaceholder: 'Enter withdrawal amount',
      showCancelButton: true,
      confirmButtonText: 'Submit Withdrawal',
      confirmButtonColor: '#10B981',
    });

    if (!amount) return;
    const withdrawAmount = Number(amount);

    if (withdrawAmount <= 0) {
      return Swal.fire('Invalid', 'Please enter a valid amount greater than 0', 'warning');
    }

    // পর্যাপ্ত ব্যালেন্স না থাকলে Insufficient Funds দেখাবে
    if (withdrawAmount > availableBalance) {
      return Swal.fire(
        'Insufficient Balance!', 
        `You do not have enough funds. Available: $${availableBalance.toFixed(2)}`, 
        'error'
      );
    }

    try {
      const res = await fetch(`${API_URL}/api/withdraw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: targetUser._id || targetUser.id,
          userName: targetUser.name || 'User',
          userEmail: targetUser.email,
          amount: withdrawAmount,
          payoutMethod: 'Admin Payout'
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        Swal.fire('Success!', 'Withdrawal request created successfully!', 'success');
        fetchTransactions(); // ডেটা রিফ্রেশ করবে
      } else {
        Swal.fire('Failed', data.message || 'Something went wrong', 'error');
      }
    } catch (err) {
      console.error(err);
      Swal.fire('Error', 'Server connection failed', 'error');
    }
  };

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

  const filteredTransactions = transactions.filter(t => {
    const userField = (
      t.userName || t.userEmail || t.email || t.customerName || 
      t.name || t.fullName || t.buyerEmail || t.linkId || ""
    ).toString();

    const descField = (
      t.linkId || t.description || t.orderId || t.name || ""
    ).toString();

    const matchesSearch = 
      userField.toLowerCase().includes(searchTerm.toLowerCase()) ||
      descField.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.invoiceId || t.payId || "").toLowerCase().includes(searchTerm.toLowerCase());

    let matchesStatus = true;
    if (statusFilter !== 'All') {
      if (statusFilter === 'Paid') {
        matchesStatus = t.status === 'Paid' || t.status === 'Success' || t.status === 'Completed';
      } else {
        matchesStatus = t.status === statusFilter;
      }
    }

    const rawDate = t.date || t.createdAt;
    let matchesFrom = true;
    let matchesTo = true;

    if (rawDate) {
      const itemDateOnly = new Date(rawDate).toISOString().split('T')[0];
      if (fromDate) matchesFrom = itemDateOnly >= fromDate;
      if (toDate) matchesTo = itemDateOnly <= toDate;
    }

    return matchesSearch && matchesStatus && matchesFrom && matchesTo;
  });

  const handleClearFilter = () => {
    setSearchTerm('');
    setStatusFilter('All');
    setFromDate('');
    setToDate('');
  };

  let storedUserCheck = {};
  try {
    storedUserCheck = JSON.parse(localStorage.getItem('userInfo') || localStorage.getItem('user') || '{}');
  } catch (e) {}
  const isMasterAdmin = storedUserCheck.role === 'master_admin' || storedUserCheck.email === 'admin@mamun.com' || localStorage.getItem('role') === 'master_admin';

  return (
    <div className="p-4 sm:p-6 md:p-8 bg-[#F9FAFB] min-h-screen">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">Transactions</h1>
          <p className="text-sm text-gray-500 mt-1">View all payment activity and user balances</p>
        </div>
        <button 
          onClick={() => navigate('/create-qr')} 
          className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-3 rounded-xl font-semibold flex items-center justify-center gap-2 shadow-sm transition cursor-pointer"
        >
          <QrCode size={20} /> Create QR
        </button>
      </div>

      {/* মাস্টার অ্যাডমিনের জন্য ইউজারের সামারি, এডিট ও পে/উইথড্র অপশন */}
      {isMasterAdmin && usersSummary.length > 0 && (
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm mb-8">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Users Earnings & Withdrawal Management</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {usersSummary.map((u) => (
              <div key={u._id || u.id} className="p-4 bg-gray-50 rounded-xl border border-gray-100 flex flex-col justify-between gap-3">
                <div>
                  <h3 className="font-bold text-gray-800">{u.name || "Unnamed User"}</h3>
                  <p className="text-xs text-gray-500">{u.email}</p>
                </div>
                <div className="flex items-center justify-between border-t border-gray-200 pt-3">
                  <div>
                    <span className="text-[10px] text-gray-400 block uppercase font-bold">Available Balance</span>
                    <span className="text-emerald-600 font-extrabold text-base flex items-center">
                      <DollarSign size={16} /> {Number(u.availableBalance || 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Edit User Button */}
                    <button
                      onClick={() => handleEditUser(u)}
                      title="Edit User Info"
                      className="p-2 bg-gray-200 hover:bg-emerald-50 text-gray-700 hover:text-emerald-600 rounded-lg transition cursor-pointer"
                    >
                      <Edit size={16} />
                    </button>
                    {/* Pay / Withdraw Button */}
                    <button
                      onClick={() => handleAdminWithdraw(u)}
                      title="Pay / Withdraw"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer shadow-sm flex items-center gap-1"
                    >
                      <DollarSign size={14} /> Pay
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Total Transactions</span>
          <div className="text-2xl sm:text-3xl font-black text-gray-900 mt-3">
            {loading ? "0" : totalTransactionsCount.toLocaleString()}
          </div>
        </div>

        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Total Volume</span>
          <div className="text-2xl sm:text-3xl font-black text-gray-900 mt-3">
            {loading ? "$0.00" : formatCurrency(totalVolume)}
          </div>
        </div>

        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Pending Amount</span>
          <div className="text-2xl sm:text-3xl font-black text-[#2563EB] mt-3">
            {loading ? "$0.00" : formatCurrency(pendingAmount)}
          </div>
        </div>

        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Expired Rate</span>
          <div className="text-2xl sm:text-3xl font-black text-[#EF4444] mt-3">
            {loading ? "0%" : `${expiredRate}%`}
          </div>
        </div>
      </div>

      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-100 shadow-sm mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-center">
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

        <div className="flex items-end gap-2 pt-0 sm:pt-5">
          <button 
            onClick={() => {}}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 sm:py-2 rounded-xl text-sm font-semibold flex items-center justify-center gap-1 transition cursor-pointer shadow-sm"
          >
            <Filter size={16} /> Filter
          </button>
          <button 
            onClick={handleClearFilter}
            className="px-4 py-2.5 sm:py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl text-sm font-semibold transition cursor-pointer"
          >
            Clear
          </button>
        </div>
      </div>

      <TransactionList items={filteredTransactions} loading={loading} />
    </div>
  );
}