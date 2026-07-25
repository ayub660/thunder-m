import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  QrCode,
  ArrowLeftRight,
  Wallet,
  Users,
  UserCircle,
  LogOut,
  CircleDollarSign,
  KeyRound,
  X
} from "lucide-react";

const items = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/create-qr", label: "Create QR", icon: QrCode },
  { to: "/transactions", label: "Transactions", icon: ArrowLeftRight },
  { to: "/withdrawals", label: "Withdrawals", icon: Wallet },
  { to: "/users", label: "Users", icon: Users },
  { to: "/profile", label: "Profile", icon: UserCircle },
];

export function AppSidebar() {
  const location = useLocation();
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [passwordData, setPasswordData] = useState({ oldPassword: '', newPassword: '' });

  // লোকালস্টোরেজ থেকে ইউজারের ইনফো নিরাপদভাবে নেওয়া
  const storedUser = (() => {
    try {
      const item = localStorage.getItem('userInfo');
      return item ? JSON.parse(item) : { name: "Master Admin", email: "admin@mamun.com", role: "master_admin" };
    } catch (e) {
      return { name: "Master Admin", email: "admin@mamun.com", role: "master_admin" };
    }
  })();

  // শুধুমাত্র শিম বা শর্ত চেক করা যে ইউজারটি মাস্টার অ্যাডমিন কি না
  const isMasterAdmin = storedUser.role === 'master_admin';

  // লোকাল ও লাইভ (Vercel) পরিবেশের জন্য ডায়নামিক API বেস URL
  const API_URL = import.meta.env.MODE === 'production' ? '' : 'http://localhost:5000';

  // লগআউট হ্যান্ডলার ফাংশন
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userInfo');
    window.location.href = '/login';
  };

  // পাসওয়ার্ড আপডেট সাবমিট হ্যান্ডলার
  const handleUpdatePassword = async () => {
    if (!passwordData.oldPassword || !passwordData.newPassword) {
      return alert("Please fill in both fields!");
    }

    try {
      const res = await fetch(`${API_URL}/api/admin/update-password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: storedUser.email,
          oldPassword: passwordData.oldPassword,
          newPassword: passwordData.newPassword
        })
      });
      const data = await res.json();

      if (data.success) {
        alert("Password updated successfully!");
        setIsPasswordModalOpen(false);
        setPasswordData({ oldPassword: '', newPassword: '' });
      } else {
        alert(data.message || "Failed to update password");
      }
    } catch (err) {
      console.error(err);
      alert("Server error while updating password!");
    }
  };

  return (
    <>
      <aside className="hidden md:flex md:w-64 md:flex-col bg-white border-r border-gray-100 h-screen sticky top-0 left-0 z-30 justify-between shrink-0">
        <div className="flex flex-col h-full overflow-y-auto">
          {/* Sidebar Header */}
          <div className="flex items-center gap-2 px-6 py-6 border-b border-gray-50">
            <div className="h-9 w-9 flex items-center justify-center rounded-lg bg-green-500 text-white">
              <CircleDollarSign className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-gray-800">Thunder</div>
              {/* এখানে মাস্টার অ্যাডমিন হলে শুধু "Admin Dashboard" দেখাবে */}
              <div className="text-xs text-gray-400">
                {isMasterAdmin ? "Admin Dashboard" : "Merchant dashboard"}
              </div>
            </div>
          </div>
          
          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 space-y-1">
            {items.map((it) => {
              const active = location.pathname === it.to;
              const Icon = it.icon;
              return (
                <Link
                  key={it.to}
                  to={it.to}
                  className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 ${
                    active
                      ? "bg-green-500 text-white shadow-md shadow-green-200"
                      : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  {/* যদি উইথড্র অপশন হয় এবং ইউজার মাস্টার অ্যাডমিন হয়, তবে নাম পাল্টে "Withdrawal Requests" দেখাতে পারেন */}
                  {it.to === "/withdrawals" && isMasterAdmin ? "Withdrawal Requests" : it.label}
                </Link>
              );
            })}
          </nav>
        
          {/* Footer Section: User Info, Update Password & Logout */}
          <div className="p-4 border-t border-gray-100 space-y-3 bg-gray-50/50 mt-auto">
            {/* User Info Card */}
            <div className="flex items-center gap-3 px-3 py-2 bg-white rounded-2xl border border-gray-100 shadow-sm">
              <div className="w-9 h-9 bg-green-100 text-green-600 rounded-full flex items-center justify-center font-bold text-sm shrink-0">
                {storedUser.name ? storedUser.name.charAt(0).toUpperCase() : 'U'}
              </div>
              <div className="overflow-hidden">
                <div className="text-xs font-bold text-gray-800 truncate">{storedUser.name}</div>
                <div className="text-[10px] text-gray-400 truncate">{storedUser.email}</div>
              </div>
            </div>

            {/* Update Password Button */}
            <button 
              onClick={() => setIsPasswordModalOpen(true)}
              className="flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-xs font-semibold text-gray-600 hover:bg-green-50 hover:text-green-600 transition-colors cursor-pointer"
            >
              <KeyRound className="h-4 w-4" />
              Update Password
            </button>

            {/* Logout Button */}
            <button 
              onClick={handleLogout}
              className="flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-xs font-semibold text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>
        </div>
      </aside>

      {/* Password Update Modal */}
      {isPasswordModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-md p-8 rounded-3xl shadow-2xl relative animate-in fade-in zoom-in duration-200">
            <button 
              onClick={() => setIsPasswordModalOpen(false)}
              className="absolute top-6 right-6 text-gray-400 hover:text-gray-600 cursor-pointer"
            >
              <X size={20} />
            </button>

            <h2 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
              <KeyRound className="text-green-500" size={20} /> Update Password
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Old Password</label>
                <input 
                  type="password" 
                  placeholder="••••••••" 
                  value={passwordData.oldPassword}
                  onChange={e => setPasswordData({...passwordData, oldPassword: e.target.value})}
                  className="w-full p-3.5 bg-gray-50 rounded-2xl border border-gray-200 outline-none text-sm focus:border-green-500" 
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">New Password</label>
                <input 
                  type="password" 
                  placeholder="••••••••" 
                  value={passwordData.newPassword}
                  onChange={e => setPasswordData({...passwordData, newPassword: e.target.value})}
                  className="w-full p-3.5 bg-gray-50 rounded-2xl border border-gray-200 outline-none text-sm focus:border-green-500" 
                />
              </div>

              <div className="flex gap-4 mt-6">
                <button 
                  onClick={() => setIsPasswordModalOpen(false)}
                  className="w-1/2 bg-gray-100 text-gray-600 py-3.5 rounded-2xl font-bold hover:bg-gray-200 transition cursor-pointer text-sm"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleUpdatePassword}
                  className="w-1/2 bg-green-500 text-white py-3.5 rounded-2xl font-bold hover:bg-green-600 transition shadow-lg shadow-green-100 cursor-pointer text-sm"
                >
                  Update
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}