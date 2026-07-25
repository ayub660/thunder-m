import React, { useState, useEffect } from 'react';
import { Search, Filter, CheckCircle, Clock, Mail, CreditCard } from 'lucide-react';
import Swal from 'sweetalert2';

export const WithdrawalsAdmin = () => {
  const [withdrawals, setWithdrawals] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [loading, setLoading] = useState(false);

  // লোকাল এবং Vercel লাইভ সার্ভারের জন্য ডাইনামিক API বেস URL
  const API_URL = import.meta.env.MODE === 'production' ? '' : 'http://localhost:5000';

  // ব্যাকএন্ড থেকে উইথড্র রিকোয়েস্টগুলো ফেচ করা
  const fetchWithdrawals = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/api/admin/withdrawals`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setWithdrawals(data);
      } else if (data.withdrawals) {
        setWithdrawals(data.withdrawals);
      }
    } catch (err) {
      console.error("Error fetching withdrawals:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWithdrawals();
  }, [API_URL]);

  // স্ট্যাটাস আপডেট করার ফাংশন (Pending -> Paid)
  const handleUpdateStatus = async (id, newStatus) => {
    const result = await Swal.fire({
      title: `Mark as ${newStatus}?`,
      text: `Are you sure you want to change this withdrawal status to ${newStatus}?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#10B981',
      cancelButtonColor: '#EF4444',
      confirmButtonText: `Yes, make it ${newStatus}!`
    });

    if (result.isConfirmed) {
      try {
        const res = await fetch(`${API_URL}/api/admin/withdrawals/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus })
        });
        const data = await res.json();

        if (res.ok) {
          Swal.fire('Success!', `Withdrawal marked as ${newStatus}`, 'success');
          fetchWithdrawals(); // লিস্ট রিফ্রেশ করবে
        } else {
          Swal.fire('Failed!', data.message || 'Status update failed', 'error');
        }
      } catch (err) {
        console.error(err);
        Swal.fire('Error!', 'Server connection error!', 'error');
      }
    }
  };

  // সার্চ ও ফিল্টার লজিক (নাম এবং ইমেইল দিয়ে সার্চ করার সুবিধা)
  const filteredWithdrawals = withdrawals.filter(item => {
    const nameMatch = item.userName?.toLowerCase().includes(searchQuery.toLowerCase()) || false;
    const emailMatch = item.userEmail?.toLowerCase().includes(searchQuery.toLowerCase()) || false;
    const matchesSearch = nameMatch || emailMatch;
    const matchesStatus = statusFilter === 'All' || item.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // টোটাল স্ট্যাটস ক্যালকুলেশন (ডাইনামিক)
  const totalPending = withdrawals
    .filter(i => i.status === 'Pending' || !i.status)
    .reduce((acc, curr) => acc + Number(curr.originalAmount || curr.amount || 0), 0);

  const totalWithdrawn = withdrawals
    .filter(i => i.status === 'Paid' || i.status === 'Approved')
    .reduce((acc, curr) => acc + Number(curr.originalAmount || curr.amount || 0), 0);

  const totalRequestsAmount = withdrawals
    .reduce((acc, curr) => acc + Number(curr.originalAmount || curr.amount || 0), 0);

  return (
    <div className="p-8 bg-gray-50/50 min-h-screen">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Withdrawal Requests</h1>
        <p className="text-xs text-gray-500 mt-1">Review user payment requests and banking/payout details from database.</p>
      </div>

      {/* টপ স্ট্যাটস কার্ড */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Requested Amount</p>
          <h3 className="text-3xl font-black text-gray-900 mt-2">${totalRequestsAmount.toLocaleString()}</h3>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Paid / Approved</p>
          <h3 className="text-3xl font-black text-green-600 mt-2">${totalWithdrawn.toLocaleString()}</h3>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Pending Approval</p>
          <h3 className="text-3xl font-black text-amber-500 mt-2">${totalPending.toLocaleString()}</h3>
        </div>
      </div>

      {/* সার্চ ও ফিল্টার বার */}
      <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm mb-6 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-4 top-3.5 text-gray-400" size={18} />
          <input 
            type="text" 
            placeholder="Search by name or email..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-gray-50/80 rounded-2xl border border-gray-200 outline-none text-sm focus:border-green-500 focus:bg-white transition-all font-medium"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <Filter size={18} className="text-gray-400 shrink-0" />
          <select 
            value={statusFilter} 
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full md:w-48 p-3 bg-gray-50/80 rounded-2xl border border-gray-200 outline-none text-sm cursor-pointer font-medium text-gray-700 focus:border-green-500 focus:bg-white transition-all"
          >
            <option value="All">All Status</option>
            <option value="Pending">Pending</option>
            <option value="Approved">Approved</option>
            <option value="Paid">Paid</option>
          </select>
        </div>
      </div>

      {/* টেবিল সেকশন */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/70 text-gray-400 text-[11px] uppercase tracking-wider border-b border-gray-100">
                <th className="p-5 font-bold">User Information</th>
                <th className="p-5 font-bold">Amount (USD & BDT)</th>
                <th className="p-5 font-bold">Bank / Payout Details</th>
                <th className="p-5 font-bold">Status</th>
                <th className="p-5 font-bold">Request Time</th>
                <th className="p-5 font-bold text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {loading ? (
                <tr>
                  <td colSpan="6" className="p-12 text-center text-gray-400 font-medium">
                    Loading requests from database...
                  </td>
                </tr>
              ) : filteredWithdrawals.length > 0 ? (
                filteredWithdrawals.map((item) => {
                  const usdAmount = Number(item.originalAmount || item.amount || 0);
                  const userRate = Number(item.exchangeRate || item.rate || 124);
                  const bdtAmount = usdAmount * userRate;

                  return (
                    <tr key={item._id || item.id} className="hover:bg-gray-50/50 transition-colors">
                      {/* ইউজার নেম ও ইমেইল */}
                      <td className="p-5">
                        <div className="font-bold text-gray-900">{item.userName || item.name || 'Unknown User'}</div>
                        <div className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                          <Mail size={12} /> {item.userEmail || item.email || 'No email provided'}
                        </div>
                      </td>

                      {/* ডলারে অ্যামাউন্ট এবং ইউজারের রেট অনুযায়ী বিডিটি হিসাব */}
                      <td className="p-5">
                        <div className="font-extrabold text-gray-950">${usdAmount.toFixed(2)}</div>
                        <div className="text-xs text-emerald-600 font-semibold mt-0.5">
                          BDT: {bdtAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} 
                          <span className="text-[10px] text-gray-400 font-normal"> (Rate: {userRate})</span>
                        </div>
                      </td>

                      {/* পেমেন্ট বা ব্যাংক ডিটেইলস */}
                      <td className="p-5">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-gray-800">
                          <CreditCard size={14} className="text-green-500" />
                          {item.payoutMethod || item.method || 'Bank Transfer'}
                        </div>
                        <div className="text-xs font-semibold text-gray-600 mt-0.5 bg-gray-50 px-2 py-0.5 rounded-md inline-block border border-gray-200">
                          {item.accountNumber || item.bankDetails || item.walletNumber || 'A/C: N/A'}
                        </div>
                      </td>

                      {/* স্ট্যাটাস ব্যাজ */}
                      <td className="p-5">
                        <span className={`inline-flex px-3 py-1 rounded-xl text-[11px] font-bold uppercase tracking-wider ${
                          item.status === 'Paid' ? 'bg-green-50 text-green-600 border border-green-100' :
                          item.status === 'Approved' ? 'bg-blue-50 text-blue-600 border border-blue-100' :
                          'bg-amber-50 text-amber-600 border border-amber-100'
                        }`}>
                          {item.status || 'Pending'}
                        </span>
                      </td>

                      {/* রিকোয়েস্ট টাইম */}
                      <td className="p-5 text-gray-400 text-xs">
                        {item.requestTime || item.createdAt ? new Date(item.requestTime || item.createdAt).toLocaleString() : 'N/A'}
                      </td>

                      {/* অ্যাকশন বাটন */}
                      <td className="p-5 text-center">
                        <div className="flex items-center justify-center gap-2">
                          {item.status !== 'Paid' ? (
                            <button 
                              onClick={() => handleUpdateStatus(item._id || item.id, 'Paid')}
                              className="bg-green-500 hover:bg-green-600 text-white px-3.5 py-2 rounded-xl font-bold text-xs shadow-md shadow-green-100 transition cursor-pointer flex items-center gap-1.5"
                            >
                              <CheckCircle size={14} /> Mark as Paid
                            </button>
                          ) : (
                            <span className="text-xs font-bold text-green-600 bg-green-50 px-3 py-1 rounded-xl border border-green-200">
                              Completed ✓
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="6" className="p-16 text-center text-gray-400">
                    <Clock size={36} className="mx-auto mb-2 opacity-30" />
                    <p className="font-medium text-sm">No payment requests found in database.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};