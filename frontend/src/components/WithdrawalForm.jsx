import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { AlertTriangle, Wallet, CheckCircle2, Clock, Eye, Filter, Plus } from "lucide-react";

const formatCurrency = (val, currency = 'USD') => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
  }).format(val || 0);
};

export function WithdrawalForm({ onSuccess }) {
  const [balance, setBalance] = useState(0);
  const [totalWithdrawn, setTotalWithdrawn] = useState(0);
  const [pendingApproval, setPendingApproval] = useState(0);
  
  const [amount, setAmount] = useState("");
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  
  const [myWithdrawals, setMyWithdrawals] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // লোকাল এবং Vercel লাইভ সার্ভারের জন্য ডাইনামিক API বেস URL
  const API_URL = import.meta.env.MODE === 'production' ? 'thunder-m.vercel.app' : 'http://localhost:5000';

  const fetchData = async () => {
    try {
      setHistoryLoading(true);
      
      const balanceRes = await axios.get(`${API_URL}/api/balance`);
      setBalance(balanceRes.data.balance || 0);

      const historyRes = await axios.get(`${API_URL}/api/my-withdrawals`);
      const withdrawalsList = Array.isArray(historyRes.data) ? historyRes.data : (historyRes.data.withdrawals || []);
      setMyWithdrawals(withdrawalsList);

      let withdrawnTotal = 0;
      let pendingTotal = 0;

      withdrawalsList.forEach(item => {
        const amt = Number(item.originalAmount || item.amount || 0);
        const status = item.status ? item.status.toLowerCase() : 'pending';

        if (status === 'paid' || status === 'approved') {
          withdrawnTotal += amt;
        } else if (status === 'pending') {
          pendingTotal += amt;
        }
      });

      setTotalWithdrawn(withdrawnTotal);
      setPendingApproval(pendingTotal);

    } catch (err) {
      console.error("Error fetching data:", err);
      setError("Failed to load data");
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [API_URL]);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    
    const n = Number(amount);

    if (n <= 0) {
      setError("Please enter a valid amount");
      return;
    }

    if (n > balance) {
      setError("Insufficient funds");
      return;
    }

    setLoading(true);
    try {
      await axios.post(`${API_URL}/api/withdraw`, { amount: n });
      
      const formattedAmount = formatCurrency(n);
      setSuccessMsg(`Withdrawal request of ${formattedAmount} submitted successfully!`);
      
      setAmount("");
      setShowModal(false);
      fetchData();

      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleClearFilter = () => {
    setSearchTerm("");
    setStatusFilter("All");
    setDateFrom("");
    setDateTo("");
  };

  const filteredWithdrawals = myWithdrawals.filter((item) => {
    const userName = (item.user?.name || item.userName || item.name || "N/A").toLowerCase();
    const matchesSearch = userName.includes(searchTerm.toLowerCase());
    
    const itemStatus = item.status || 'Pending';
    const matchesStatus = statusFilter === "All" || itemStatus.toLowerCase() === statusFilter.toLowerCase();

    const itemDate = new Date(item.requestTime || item.createdAt);
    let matchesDate = true;
    if (dateFrom) {
      matchesDate = matchesDate && itemDate >= new Date(dateFrom);
    }
    if (dateTo) {
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999);
      matchesDate = matchesDate && itemDate <= toDate;
    }

    return matchesSearch && matchesStatus && matchesDate;
  });

  const isOver = Number(amount) > balance;

  return (
    <div className="w-full min-h-screen bg-[#F8F9FA] px-2 md:px-4 py-6 space-y-8 font-sans text-gray-900">
      
      {/* পেজ হেডার */}
      <div className="w-full">
        <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">Withdrawals</h1>
        <p className="text-sm text-gray-500 mt-1">Manage withdrawal requests</p>
      </div>

      {/* ব্যালেন্স কার্ড সেকশন */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
        
        {/* Available Balance Card */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between w-full">
          <div>
            <p className="text-[11px] font-bold text-gray-400 tracking-wider">AVAILABLE BALANCE</p>
            <div className="flex items-baseline gap-3 mt-2">
              <h2 className="text-4xl font-extrabold text-gray-900">{formatCurrency(balance)}</h2>
            </div>
            <p className="text-xs text-gray-400 mt-1 font-medium">
              BDT: {formatCurrency(balance * 120, 'BDT').replace('USD', '').replace('$', '').trim()}
            </p>
          </div>
          <button 
            onClick={() => setShowModal(true)}
            className="w-full mt-6 py-3.5 bg-[#00E676] hover:bg-[#00c853] text-gray-950 rounded-xl font-bold transition duration-150 flex items-center justify-center gap-2 cursor-pointer shadow-sm"
          >
            <Plus size={18} strokeWidth={3} />
            <span>Request Withdrawal</span>
          </button>
        </div>

        {/* Total Withdrawn Card */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between w-full">
          <div>
            <p className="text-[11px] font-bold text-gray-400 tracking-wider">TOTAL WITHDRAWN</p>
            <h2 className="text-4xl font-extrabold text-gray-900 mt-3">{formatCurrency(totalWithdrawn)}</h2>
          </div>
        </div>

        {/* Pending Approval Card */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between w-full">
          <div>
            <p className="text-[11px] font-bold text-gray-400 tracking-wider">PENDING APPROVAL</p>
            <h2 className="text-4xl font-extrabold text-[#2979FF] mt-3">{formatCurrency(pendingApproval)}</h2>
          </div>
        </div>
      </div>

      {/* সার্চ এবং ফিল্টার বার */}
      <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-wrap items-end gap-4 w-full">
        <div className="flex-1 min-w-[200px] space-y-1.5">
          <label className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Search</label>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Name or email"
            className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-green-100 focus:border-[#00E676] outline-none transition-all"
          />
        </div>
        <div className="w-44 space-y-1.5">
          <label className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-green-100 focus:border-[#00E676] outline-none cursor-pointer"
          >
            <option value="All">All</option>
            <option value="Pending">Pending</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
          </select>
        </div>
        <div className="w-44 space-y-1.5">
          <label className="text-[11px] font-bold uppercase tracking-wider text-gray-400">From</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-green-100 focus:border-[#00E676] outline-none text-gray-600"
          />
        </div>
        <div className="w-44 space-y-1.5">
          <label className="text-[11px] font-bold uppercase tracking-wider text-gray-400">To</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-green-100 focus:border-[#00E676] outline-none text-gray-600"
          />
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={fetchData}
            className="px-5 py-2.5 bg-[#00E676] hover:bg-[#00c853] text-gray-950 rounded-xl text-sm font-bold flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Filter size={16} />
            <span>Filter</span>
          </button>
          <button 
            onClick={handleClearFilter}
            className="px-5 py-2.5 bg-white hover:bg-gray-50 text-gray-600 rounded-xl text-sm font-semibold border border-gray-200 cursor-pointer"
          >
            Clear
          </button>
        </div>
      </div>

      {/* পেআউট হিস্ট্রি টেবিল সেকশন */}
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm w-full">
        <h3 className="text-xl font-bold mb-6 text-gray-900">Payout History</h3>
        
        <div className="w-full overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-[11px] text-gray-400 uppercase tracking-wider border-b border-gray-100">
              <tr>
                <th scope="col" className="px-5 pb-4 font-bold">User</th>
                <th scope="col" className="px-5 pb-4 font-bold">Amount</th>
                <th scope="col" className="px-5 pb-4 font-bold">Original Amount</th>
                <th scope="col" className="px-5 pb-4 font-bold">Type</th>
                <th scope="col" className="px-5 pb-4 font-bold">Payout Method</th>
                <th scope="col" className="px-5 pb-4 font-bold">Status</th>
                <th scope="col" className="px-5 pb-4 font-bold">Request Time</th>
                <th scope="col" className="px-5 pb-4 font-bold text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {historyLoading ? (
                <tr>
                  <td colSpan="8" className="text-center py-12 text-gray-400">Loading history...</td>
                </tr>
              ) : filteredWithdrawals.length > 0 ? (
                filteredWithdrawals.map((item) => (
                  <tr key={item._id || item.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-4 font-semibold text-gray-900">
                      {item.user?.name || item.userName || item.name || 'N/A'}
                    </td>
                    <td className="px-5 py-4 font-extrabold text-gray-900">
                      {item.amount?.toString().includes('BDT') ? item.amount : `BDT ${item.amount || 0}`}
                    </td>
                    <td className="px-5 py-4 text-gray-600 font-medium">${item.originalAmount || item.amount || 0}</td>
                    <td className="px-5 py-4 text-gray-500 font-medium">{item.type || 'User Payout'}</td>
                    <td className="px-5 py-4 text-gray-500 font-medium">{item.payoutMethod || item.method || 'Bank Transfer'}</td>
                    <td className="px-5 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        item.status === 'Approved' ? 'bg-emerald-50 text-emerald-600' :
                        item.status === 'Rejected' ? 'bg-red-50 text-red-600' :
                        'bg-amber-50 text-amber-600'
                      }`}>
                        {item.status || 'Pending'}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-gray-400 text-xs font-medium">
                      {item.requestTime || item.createdAt ? new Date(item.requestTime || item.createdAt).toLocaleString() : 'N/A'}
                    </td>
                    <td className="px-5 py-4 text-center">
                      <button className="text-gray-400 hover:text-[#00E676] p-1.5 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors">
                        <Eye size={18} />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="8" className="text-center py-16 text-gray-400">
                    <Clock className="mx-auto mb-2 opacity-50" size={28} />
                    No withdrawal history found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* উইথড্র রিকোয়েস্ট মোডাল */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm w-full h-full">
          <div className="bg-white rounded-3xl w-full max-w-lg p-8 shadow-2xl space-y-6 relative">
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-[#E8F8F0] flex items-center justify-center text-[#00C853]">
                  <Wallet size={26} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Request Payout</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Available Balance: <span className="font-bold text-gray-800">{formatCurrency(balance)}</span></p>
                </div>
              </div>
              <button 
                onClick={() => setShowModal(false)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 flex items-center justify-center font-bold cursor-pointer transition-colors"
              >
                ✕
              </button>
            </div>

            <form onSubmit={submit} className="space-y-4 w-full">
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Amount to withdraw ($)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className={`w-full p-4 bg-gray-50 rounded-2xl border text-sm font-bold outline-none transition-all ${
                    isOver ? "border-red-300 bg-red-50 text-red-600" : "border-gray-200 focus:border-[#00E676] focus:bg-white"
                  }`}
                />
              </div>

              {(error || isOver) && (
                <div className="flex items-start gap-2.5 rounded-2xl border border-red-100 bg-red-50 p-4 text-xs font-semibold text-red-600">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>{error || "Insufficient funds"}</span>
                </div>
              )}

              {successMsg && (
                <div className="flex items-start gap-2.5 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-xs font-semibold text-emerald-700">
                  <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>{successMsg}</span>
                </div>
              )}

              <div className="flex gap-4 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="w-1/2 py-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-2xl font-bold text-sm transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isOver || loading || !amount}
                  className="w-1/2 py-4 bg-[#00E676] hover:bg-[#00c853] disabled:opacity-50 text-gray-950 rounded-2xl font-bold text-sm shadow-md transition-all cursor-pointer"
                >
                  {loading ? "Processing..." : "Confirm"}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
}