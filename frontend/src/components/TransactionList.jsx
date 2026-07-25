import React from 'react';
import { History } from "lucide-react";

const formatCurrency = (val) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(val || 0);
};

export function TransactionList({ items = [], loading = false }) {
  const safeItems = Array.isArray(items) ? items : [];

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="table w-full text-sm">
          <thead className="bg-[#F9FAFB] text-gray-400 text-[11px] uppercase tracking-wider border-b border-gray-100">
            <tr>
              <th className="px-6 py-4 font-bold">User / Name</th>
              <th className="px-6 py-4 font-bold">Amount</th>
              <th className="px-6 py-4 font-bold">Description</th>
              <th className="px-6 py-4 font-bold">Status</th>
              <th className="px-6 py-4 font-bold">Group Approve</th>
              <th className="px-6 py-4 font-bold">Date</th>
              <th className="px-6 py-4 font-bold">Pay ID</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={7} className="text-center py-10 text-gray-400 font-medium">Loading transactions...</td>
              </tr>
            ) : safeItems.length > 0 ? (
              safeItems.map((t, index) => (
                <tr key={t.id || t._id || index} className="hover:bg-gray-50/50 transition">
                  {/* User / Name: ব্যাকএন্ডের বিভিন্ন সম্ভাব্য প্রপার্টি চেক করে নাম দেখাবে */}
                  <td className="px-6 py-4 font-semibold text-gray-900">
                    {t.customerName || t.name || t.fullName || t.userName || t.user || t.buyerEmail || t.email || "N/A"}
                  </td>

                  {/* Amount */}
                  <td className="px-6 py-4 font-extrabold text-gray-900">
                    {formatCurrency(t.amount)}
                  </td>

                  {/* Description */}
                  <td className="px-6 py-4 text-gray-500">
                    {t.description || t.orderId || "N/A"}
                  </td>

                  {/* Status */}
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold inline-block ${
                      t.status === "Paid" || t.status === "Success" || t.status === "Completed"
                        ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                        : t.status === "Expired"
                        ? "bg-rose-50 text-rose-600 border border-rose-200"
                        : "bg-blue-50 text-blue-600 border border-blue-200"
                    }`}>
                      {t.status || "Pending"}
                    </span>
                  </td>

                  {/* Group Approve */}
                  <td className="px-6 py-4 text-gray-400">
                    <History size={18} className="cursor-pointer hover:text-gray-600 transition" title="History / Group Approve" />
                  </td>

                  {/* Date */}
                  <td className="px-6 py-4 text-gray-500 text-xs">
                    {t.date || t.createdAt ? new Date(t.date || t.createdAt).toLocaleString() : "N/A"}
                  </td>

                  {/* Pay ID / Lightning Invoice ID */}
                  <td className="px-6 py-4 font-mono text-xs text-gray-400 truncate max-w-[140px]" title={t.payId || t.invoiceId}>
                    {t.payId || t.invoiceId ? `${(t.payId || t.invoiceId).substring(0, 16)}...` : "N/A"}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="text-center py-12 text-gray-400 font-medium">
                  No transactions found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}