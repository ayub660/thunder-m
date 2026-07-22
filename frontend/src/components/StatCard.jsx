import React from 'react';

// ভ্যালু ফরম্যাট করার জন্য একটি সাধারণ হেল্পার ফাংশন
const formatCurrency = (val) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(val || 0);
};

export function StatCard({ label, value, icon: Icon, accent, delta }) {
  // DaisyUI এর কালার প্যালেটের সাথে ম্যাচ করার জন্য ক্লাসগুলো আপডেট করা হয়েছে
  const bg =
    accent === "success"
      ? "bg-green-100 text-green-600"
      : accent === "warning"
      ? "bg-amber-100 text-amber-600"
      : accent === "neutral"
      ? "bg-gray-100 text-gray-600"
      : "bg-primary/10 text-primary"; // primary

  return (
    <div className="rounded-xl border border-base-300 bg-base-100 p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide opacity-70">
            {label}
          </p>
          <p className="mt-2 text-2xl font-semibold text-base-content">
            {formatCurrency(value)}
          </p>
          {delta && <p className="mt-1 text-xs opacity-60">{delta}</p>}
        </div>
        <div className={`grid h-10 w-10 place-items-center rounded-lg ${bg}`}>
          {Icon && <Icon className="h-5 w-5" />}
        </div>
      </div>
    </div>
  );
}