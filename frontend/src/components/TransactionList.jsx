import React from 'react';
import { History } from "lucide-react";

const formatCurrency = (val) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(val || 0);
};

// লম্বা ইনভয়েস ছোট করে দেখানোর ফাংশন (যেমন: lnbc316380n.....cp2rh8kt)
const formatInvoiceShort = (invoice) => {
  if (!invoice || invoice === "N/A") return "N/A";
  if (invoice.length <= 20) return invoice;
  const start = invoice.substring(0, 10);
  const end = invoice.substring(invoice.length - 8);
  return `${start}.....${end}`;
};

export function TransactionList({ items = [], loading = false }) {
  const safeItems = Array.isArray(items) ? items : [];

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden w-full">
      {/* overflow-x-auto উঠিয়ে দেওয়া হয়েছে এবং table-fixed ব্যবহার করা হয়েছে যাতে স্ক্রিনের বাইরে না যায় */}
      <div className="w-full overflow-hidden">
        <table className="table-fixed w-full text-sm">
          <thead className="bg-[#F9FAFB] text-gray-400 text-[11px] uppercase tracking-wider border-b border-gray-100">
            <tr>
              <th className="w-[18%] px-4 py-4 font-bold text-left truncate">User / Name</th>
              <th className="w-[11%] px-4 py-4 font-bold text-left truncate">Amount</th>
              <th className="w-[18%] px-4 py-4 font-bold text-left truncate">Description</th>
              <th className="w-[12%] px-4 py-4 font-bold text-left truncate">Status</th>
              <th className="w-[11%] px-4 py-4 font-bold text-center truncate">Group App.</th>
              <th className="w-[15%] px-4 py-4 font-bold text-left truncate">Date</th>
              <th className="w-[15%] px-4 py-4 font-bold text-left truncate">Pay ID</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={7} className="text-center py-10 text-gray-400 font-medium">Loading transactions...</td>
              </tr>
            ) : safeItems.length > 0 ? (
              safeItems.map((t, index) => {
                const dynamicInvoice = t.lnInvoice || t.bolt11 || t.payId || t.lightningInvoice || t.invoice || t.invoiceId || t.btcInvoiceId || t.bitcoinAddress || "N/A";

                return (
                  <tr key={t.id || t._id || index} className="hover:bg-gray-50/50 transition">
                    {/* User / Name */}
                    <td className="px-4 py-4 font-semibold text-gray-900 truncate" title={t.customerName || t.name || t.fullName || t.userName || t.user || t.buyerEmail || t.email || "N/A"}>
                      {t.customerName || t.name || t.fullName || t.userName || t.user || t.buyerEmail || t.email || "N/A"}
                    </td>

                    {/* Amount */}
                    <td className="px-4 py-4 font-extrabold text-gray-900 truncate">
                      {formatCurrency(t.amount)}
                    </td>

                    {/* Description */}
                    <td className="px-4 py-4 text-gray-500 truncate" title={t.description || t.orderId || t.name || "N/A"}>
                      {t.description || t.orderId || t.name || "N/A"}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-4 truncate">
                      <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold inline-block ${
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
                    <td className="px-4 py-4 text-gray-400 text-center">
                      <History size={18} className="cursor-pointer hover:text-gray-600 transition mx-auto" title="History / Group Approve" />
                    </td>

                    {/* Date */}
                    <td className="px-4 py-4 text-gray-500 text-xs truncate" title={t.date || t.createdAt ? new Date(t.date || t.createdAt).toLocaleString() : "N/A"}>
                      {t.date || t.createdAt ? new Date(t.date || t.createdAt).toLocaleDateString() : "N/A"}
                    </td>

                    {/* Pay ID / Shortened LN Invoice Address */}
                    <td className="px-4 py-4 font-mono text-xs text-gray-600 truncate" title={dynamicInvoice}>
                      {formatInvoiceShort(dynamicInvoice)}
                    </td>
                  </tr>
                );
              })
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