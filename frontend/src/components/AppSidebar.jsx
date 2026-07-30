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
  X,
  Menu
} from "lucide-react";
import Swal from 'sweetalert2';

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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const storedUser = (() => {
    try {
      const item = localStorage.getItem('userInfo') || localStorage.getItem('user');
      return item ? JSON.parse(item) : { name: "Master Admin", email: "admin@mamun.com", role: "master_admin" };
    } catch (e) {
      return { name: "Master Admin", email: "admin@mamun.com", role: "master_admin" };
    }
  })();

  const isMasterAdmin = storedUser.role === 'master_admin';
  const API_URL = import.meta.env.MODE === 'production' ? 'https://thunder-m.vercel.app' : 'http://localhost:5000';

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userInfo');
    localStorage.removeItem('user');
    window.location.href = '/login';
  };

  const handleUpdatePassword = async () => {
    if (!passwordData.oldPassword || !passwordData.newPassword) {
      Swal.fire({ icon: 'warning', title: 'Required', text: 'Please fill in both fields!', confirmButtonColor: '#00D54B' });
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/admin/update-password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: storedUser.email, oldPassword: passwordData.oldPassword, newPassword: passwordData.newPassword })
      });
      const data = await res.json();

      if (data.success) {
        Swal.fire({ icon: 'success', title: 'Success!', text: 'Password updated successfully!', confirmButtonColor: '#00D54B', timer: 1500, showConfirmButton: false });
        setIsPasswordModalOpen(false);
        setPasswordData({ oldPassword: '', newPassword: '' });
      } else {
        Swal.fire({ icon: 'error', title: 'Failed', text: data.message || "Failed to update password", confirmButtonColor: '#00D54B' });
      }
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Error', text: 'Server error while updating password!', confirmButtonColor: '#00D54B' });
    }
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white font-sans">
      {/* Sidebar Header */}
      <div className="flex items-center justify-between px-6 py-6 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 flex items-center justify-center rounded-2xl bg-green-500 text-white shadow-lg shadow-green-100">
            <CircleDollarSign className="h-6 w-6" />
          </div>
          <div>
            <div className="text-sm font-black text-gray-900 tracking-tight">Cash Hunter</div>
            <div className="text-[11px] text-green-600 font-bold uppercase tracking-wide">
              {isMasterAdmin ? "Admin Panel" : "Merchant Panel"}
            </div>
          </div>
        </div>
        <button onClick={() => setMobileMenuOpen(false)} className="md:hidden text-gray-400 hover:text-gray-600 p-1 cursor-pointer">
          <X size={22} />
        </button>
      </div>
      
      {/* Navigation Links */}
      <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
        {items.map((it) => {
          const active = location.pathname === it.to;
          const Icon = it.icon;
          return (
            <Link
              key={it.to}
              to={it.to}
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center gap-3.5 rounded-2xl px-4 py-3.5 text-xs font-bold transition-all duration-200 ${
                active
                  ? "bg-green-500 text-white shadow-lg shadow-green-100"
                  : "text-gray-600 hover:bg-green-50 hover:text-green-600"
              }`}
            >
              <Icon className="h-5 w-5" />
              {it.to === "/withdrawals" && isMasterAdmin ? "Withdrawal Requests" : it.label}
            </Link>
          );
        })}
      </nav>
    
      {/* Footer Profile & Actions */}
      <div className="p-4 border-t border-gray-100 space-y-2.5 bg-gray-50/50">
        <div className="flex items-center gap-3 px-3 py-3 bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="w-10 h-10 bg-green-100 text-green-700 rounded-xl flex items-center justify-center font-black text-sm shrink-0">
            {storedUser.name ? storedUser.name.charAt(0).toUpperCase() : 'U'}
          </div>
          <div className="overflow-hidden">
            <div className="text-xs font-black text-gray-800 truncate">{storedUser.name}</div>
            <div className="text-[10px] text-gray-400 font-semibold truncate">{storedUser.email}</div>
          </div>
        </div>

        <button 
          onClick={() => setIsPasswordModalOpen(true)}
          className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-xs font-bold text-gray-600 hover:bg-green-50 hover:text-green-600 transition-colors cursor-pointer"
        >
          <KeyRound className="h-4 w-4 text-gray-400" />
          Update Password
        </button>

        <button 
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-xs font-bold text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
        >
          <LogOut className="h-4 w-4" />
          Logout
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Sticky Top Header */}
      <div className="md:hidden flex items-center justify-between bg-white border-b border-gray-200 px-4 py-3.5 sticky top-0 z-40 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 flex items-center justify-center rounded-xl bg-green-500 text-white shadow-sm">
            <CircleDollarSign className="h-5 w-5" />
          </div>
          <span className="font-black text-gray-900 text-sm tracking-tight">Cash Hunter</span>
        </div>
        <button 
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2.5 text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-xl cursor-pointer border border-gray-200 shadow-sm transition"
        >
          <Menu size={20} />
        </button>
      </div>

      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
        <div onClick={() => setMobileMenuOpen(false)} className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden animate-in fade-in duration-200" />
      )}

      {/* Mobile Sidebar Drawer */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-white border-r border-gray-200 transform transition-transform duration-300 ease-in-out md:hidden ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        {sidebarContent}
      </aside>

      {/* Desktop Sticky Sidebar */}
      <aside className="hidden md:flex md:w-64 md:flex-col bg-white border-r border-gray-100 h-screen sticky top-0 left-0 z-30 justify-between shrink-0 shadow-sm">
        {sidebarContent}
      </aside>

      {/* Password Update Modal */}
      {isPasswordModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md p-7 sm:p-8 rounded-3xl shadow-2xl relative border border-gray-100">
            <button onClick={() => setIsPasswordModalOpen(false)} className="absolute top-6 right-6 text-gray-400 hover:text-gray-600 cursor-pointer p-1">
              <X size={20} />
            </button>

            <h2 className="text-lg font-black text-gray-900 mb-6 flex items-center gap-2.5">
              <KeyRound className="text-green-500" size={22} /> Update Password
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-black text-gray-400 uppercase tracking-wider mb-2">Old Password</label>
                <input 
                  type="password" 
                  placeholder="••••••••" 
                  value={passwordData.oldPassword}
                  onChange={e => setPasswordData({...passwordData, oldPassword: e.target.value})}
                  className="w-full p-3.5 bg-gray-50 rounded-2xl border border-gray-200 outline-none text-sm font-bold focus:border-green-500 focus:ring-4 focus:ring-green-50 transition-all text-gray-900" 
                />
              </div>

              <div>
                <label className="block text-xs font-black text-gray-400 uppercase tracking-wider mb-2">New Password</label>
                <input 
                  type="password" 
                  placeholder="••••••••" 
                  value={passwordData.newPassword}
                  onChange={e => setPasswordData({...passwordData, newPassword: e.target.value})}
                  className="w-full p-3.5 bg-gray-50 rounded-2xl border border-gray-200 outline-none text-sm font-bold focus:border-green-500 focus:ring-4 focus:ring-green-50 transition-all text-gray-900" 
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button 
                  onClick={() => setIsPasswordModalOpen(false)}
                  className="w-1/2 bg-gray-100 text-gray-600 py-3.5 rounded-2xl font-bold hover:bg-gray-200 transition cursor-pointer text-xs uppercase tracking-wider"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleUpdatePassword}
                  className="w-1/2 bg-green-500 text-white py-3.5 rounded-2xl font-bold hover:bg-green-600 transition shadow-lg shadow-green-100 cursor-pointer text-xs uppercase tracking-wider"
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