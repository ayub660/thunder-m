import React, { useState, useEffect, useMemo } from 'react';
import { History } from "lucide-react";
import { Pagination } from './Pagination'; // path ঠিক করে নাও

const formatCurrency = (val) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(val || 0);
};

const formatInvoiceShort = (invoice) => {
  if (!invoice || invoice === "N/A") return "N/A";
  if (invoice.length <= 20) return invoice;
  const start = invoice.substring(0, 10);
  const end = invoice.substring(invoice.length - 8);
  return `${start}.....${end}`;
};

export function TransactionList({ items = [], loading = false, itemsPerPage = 10 }) {
  const [currentPage, setCurrentPage] = useState(1);

  // Duplicate _id ফিল্টার
  const safeItems = useMemo(() => {
    const arr = Array.isArray(items) ? items : [];
    const seen = new Set();
    return arr.filter((item) => {
      const id = item?._id || item?.id;
      if (!id) return true;
      const idStr = String(id);
      if (seen.has(idStr)) return false;
      seen.add(idStr);
      return true;
    });
  }, [items]);

  // items বদলালে page 1-এ ফিরে যাবে
  useEffect(() => {
    setCurrentPage(1);
  }, [items]);

  const totalPages = Math.ceil(safeItems.length / itemsPerPage) || 1;
  const paginatedItems = safeItems.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden w-full">
      {/* Desktop Table */}
      <div className="hidden md:block w-full overflow-hidden">
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
                <td colSpan={7} className="text-center py-10 text-gray-400 font-medium">
                  Loading transactions...
                </td>
              </tr>
            ) : paginatedItems.length > 0 ? (
              paginatedItems.map((t, index) => {
                const dynamicInvoice =
                  t.lnInvoice ||
                  t.bolt11 ||
                  t.payId ||
                  t.lightningInvoice ||
                  t.invoice ||
                  t.invoiceId ||
                  t.btcInvoiceId ||
                  t.bitcoinAddress ||
                  "N/A";

                const uniqueKey = `${t._id || t.id || "tx"}-${index}`;

                return (
                  <tr key={uniqueKey} className="hover:bg-gray-50/50 transition">
                    <td
                      className="px-4 py-4 font-semibold text-gray-900 truncate"
                      title={
                        t.customerName ||
                        t.name ||
                        t.fullName ||
                        t.userName ||
                        t.user ||
                        t.buyerEmail ||
                        t.email ||
                        "N/A"
                      }
                    >
                      {t.customerName ||
                        t.name ||
                        t.fullName ||
                        t.userName ||
                        t.user ||
                        t.buyerEmail ||
                        t.email ||
                        "N/A"}
                    </td>

                    <td className="px-4 py-4 font-extrabold text-gray-900 truncate">
                      {formatCurrency(t.amount)}
                    </td>

                    <td
                      className="px-4 py-4 text-gray-500 truncate"
                      title={t.description || t.orderId || t.name || "N/A"}
                    >
                      {t.description || t.orderId || t.name || "N/A"}
                    </td>

                    <td className="px-4 py-4 truncate">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[11px] font-semibold inline-block ${
                          t.status === "Paid" ||
                          t.status === "Success" ||
                          t.status === "Completed"
                            ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                            : t.status === "Expired"
                            ? "bg-rose-50 text-rose-600 border border-rose-200"
                            : "bg-blue-50 text-blue-600 border border-blue-200"
                        }`}
                      >
                        {t.status || "Pending"}
                      </span>
                    </td>

                    <td className="px-4 py-4 text-gray-400 text-center">
                      <History
                        size={18}
                        className="cursor-pointer hover:text-gray-600 transition mx-auto"
                        title="History / Group Approve"
                      />
                    </td>

                    <td
                      className="px-4 py-4 text-gray-500 text-xs truncate"
                      title={
                        t.date || t.createdAt
                          ? new Date(t.date || t.createdAt).toLocaleString()
                          : "N/A"
                      }
                    >
                      {t.date || t.createdAt
                        ? new Date(t.date || t.createdAt).toLocaleDateString()
                        : "N/A"}
                    </td>

                    <td
                      className="px-4 py-4 font-mono text-xs text-gray-600 truncate"
                      title={dynamicInvoice}
                    >
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

      {/* Mobile Cards */}
      <div className="md:hidden divide-y divide-gray-100">
        {loading ? (
          <div className="text-center py-10 text-gray-400 font-medium text-sm">
            Loading transactions...
          </div>
        ) : paginatedItems.length > 0 ? (
          paginatedItems.map((t, index) => {
            const dynamicInvoice =
              t.lnInvoice ||
              t.bolt11 ||
              t.payId ||
              t.lightningInvoice ||
              t.invoice ||
              t.invoiceId ||
              t.btcInvoiceId ||
              t.bitcoinAddress ||
              "N/A";

            const uniqueKey = `m-${t._id || t.id || "tx"}-${index}`;
            const isPaid =
              t.status === "Paid" || t.status === "Success" || t.status === "Completed";

            return (
              <div key={uniqueKey} className="p-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-gray-900 text-sm truncate">
                    {t.customerName ||
                      t.name ||
                      t.fullName ||
                      t.userName ||
                      t.user ||
                      t.buyerEmail ||
                      t.email ||
                      "N/A"}
                  </span>
                  <span className="font-extrabold text-gray-900 text-sm shrink-0">
                    {formatCurrency(t.amount)}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                      isPaid
                        ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                        : t.status === "Expired"
                        ? "bg-rose-50 text-rose-600 border border-rose-200"
                        : "bg-blue-50 text-blue-600 border border-blue-200"
                    }`}
                  >
                    {t.status || "Pending"}
                  </span>
                  <span className="text-[11px] text-gray-400">
                    {t.date || t.createdAt
                      ? new Date(t.date || t.createdAt).toLocaleDateString()
                      : "N/A"}
                  </span>
                </div>

                <p className="text-[11px] text-gray-500 truncate">
                  {t.description || t.orderId || t.name || "N/A"}
                </p>
                <p className="text-[10px] font-mono text-gray-400 truncate" title={dynamicInvoice}>
                  {formatInvoiceShort(dynamicInvoice)}
                </p>
              </div>
            );
          })
        ) : (
          <div className="text-center py-12 text-gray-400 font-medium text-sm">
            No transactions found.
          </div>
        )}
      </div>

      {/* Pagination */}
      {!loading && safeItems.length > 0 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          itemsPerPage={itemsPerPage}
          totalItems={safeItems.length}
        />
      )}
    </div>
  );
}