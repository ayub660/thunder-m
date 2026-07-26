import React, { useState } from 'react';
import { KeyRound, ShieldCheck, Mail, User } from 'lucide-react';

export function Profile() {
  // লোকালস্টোরেজ থেকে ইউজারের ইনফো নিরাপদভাবে নেওয়া (undefined প্রিভেন্ট করার জন্য)
  const storedUser = (() => {
    try {
      const item = localStorage.getItem('userInfo');
      return item ? JSON.parse(item) : { 
        name: "Master Admin", 
        email: "admin@mamun.com", 
        role: "master_admin" 
      };
    } catch (e) {
      return { 
        name: "Master Admin", 
        email: "admin@mamun.com", 
        role: "master_admin" 
      };
    }
  })();

  const [passwordData, setPasswordData] = useState({ oldPassword: '', newPassword: '' });
  const [loading, setLoading] = useState(false);

  // লোকাল এবং Vercel লাইভ সার্ভারের জন্য ডাইনামিক API বেস URL
  const API_URL = import.meta.env.MODE === 'production' ? 'https://thunder-m.vercel.app' : 'http://localhost:5000';

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    if (!passwordData.oldPassword || !passwordData.newPassword) {
      return alert("Please fill in both fields!");
    }

    try {
      setLoading(true);
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
        setPasswordData({ oldPassword: '', newPassword: '' });
      } else {
        alert(data.message || "Failed to update password");
      }
    } catch (err) {
      console.error(err);
      alert("Server error!");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-xl mx-auto space-y-4">
        
        {/* Profile Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-3.5 mb-5">
            <div className="w-12 h-12 bg-green-100 text-green-600 rounded-xl flex items-center justify-center font-bold text-lg">
              {storedUser.name ? storedUser.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-800">My Profile</h1>
              <p className="text-[11px] text-gray-400">Account details and security</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 pt-3 border-t border-gray-100 text-xs">
            <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
              <span className="text-gray-400 font-semibold block mb-0.5">Name</span>
              <p className="font-bold text-gray-800 truncate">{storedUser.name}</p>
            </div>
            <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
              <span className="text-gray-400 font-semibold block mb-0.5">Email</span>
              <p className="font-bold text-gray-800 truncate">{storedUser.email}</p>
            </div>
            <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
              <span className="text-gray-400 font-semibold block mb-0.5">Role</span>
              <p className="font-bold text-green-600 uppercase truncate">{storedUser.role}</p>
            </div>
          </div>
        </div>

        {/* Update Password Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
            <KeyRound className="text-green-500" size={16} /> Update Password
          </h2>

          <form onSubmit={handleUpdatePassword} className="space-y-3">
            <div>
              <label className="block text-[11px] font-bold text-gray-400 uppercase mb-1">Old Password</label>
              <input 
                type="password" 
                placeholder="••••••••" 
                value={passwordData.oldPassword}
                onChange={e => setPasswordData({...passwordData, oldPassword: e.target.value})}
                className="w-full p-2.5 bg-gray-50 rounded-xl border border-gray-200 outline-none text-xs focus:border-green-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-400 uppercase mb-1">New Password</label>
              <input 
                type="password" 
                placeholder="••••••••" 
                value={passwordData.newPassword}
                onChange={e => setPasswordData({...passwordData, newPassword: e.target.value})}
                className="w-full p-2.5 bg-gray-50 rounded-xl border border-gray-200 outline-none text-xs focus:border-green-500"
              />
            </div>

            <button 
              type="submit"
              disabled={loading}
              className="w-full bg-green-500 hover:bg-green-600 text-white py-2.5 rounded-xl font-bold transition shadow-md shadow-green-100 cursor-pointer text-xs disabled:opacity-50 mt-1"
            >
              {loading ? "Updating..." : "Update Password"}
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}