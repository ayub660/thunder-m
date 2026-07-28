import React, { useState } from 'react';
import { Mail, Lock, LogIn } from 'lucide-react';
import Swal from 'sweetalert2';

export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      return Swal.fire('Warning', 'Please fill in both email and password!', 'warning');
    }

    setLoading(true);
    try {
      const response = await fetch('https://thunder-m.vercel.app/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      
      const data = await response.json();

      if (response.ok && (data.success || data.token)) {
        const userObject = data.user || data.userInfo || data;

        localStorage.setItem('token', data.token);
        localStorage.setItem('userInfo', JSON.stringify(userObject));

        Swal.fire({
          icon: 'success',
          title: 'Login Successful!',
          text: 'Welcome back to dashboard.',
          timer: 1500,
          showConfirmButton: false
        }).then(() => {
          window.location.href = '/'; 
        });

      } else {
        Swal.fire('Failed', data.message || "Invalid credentials!", 'error');
      }
    } catch (err) {
      console.error("Login error:", err);
      Swal.fire('Error', 'Server error. Please make sure the backend is running.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md p-8 rounded-3xl shadow-xl border border-gray-100">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-800">Welcome Back</h1>
          <p className="text-xs text-gray-400 mt-1">Please sign in to your account</p>
        </div>

        {/* ফর্ম ট্যাগটিতেও autoComplete off করে দেওয়া হলো */}
        <form onSubmit={handleLogin} className="space-y-5" autoComplete="off">
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-4 top-3.5 text-gray-400" size={18} />
              <input 
                type="email" 
                placeholder="Enter Your Email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="off"
                name="no-autofill-email"
                className="w-full pl-11 pr-4 py-3.5 bg-gray-50 rounded-2xl border border-gray-200 outline-none text-sm focus:border-green-500 font-medium"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-4 top-3.5 text-gray-400" size={18} />
              <input 
                type="password" 
                placeholder="••••••••" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                name="no-autofill-password"
                className="w-full pl-11 pr-4 py-3.5 bg-gray-50 rounded-2xl border border-gray-200 outline-none text-sm focus:border-green-500 font-medium"
                required
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-green-500 hover:bg-green-600 text-white py-3.5 rounded-2xl font-bold shadow-lg shadow-green-100 flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <LogIn size={18} /> {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
};