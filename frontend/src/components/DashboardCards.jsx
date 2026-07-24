import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { CreateQrForm } from './CreateQrForm';
import { Copy, Wallet, Users, Coins, Receipt, TrendingUp, PiggyBank, ArrowDownToLine, Link as LinkIcon } from "lucide-react";

import imgGreen from '../asset/cashapp_green.png';
import imgLight from '../asset/cashapp_light.png';

export const DashboardCards = () => {
  const [paymentLinks, setPaymentLinks] = useState([]);
  const [selectedTheme, setSelectedTheme] = useState('light');
  const [amount, setAmount] = useState("10");
  const [selectedImage, setSelectedImage] = useState(imgLight); 
  const [linkIdInput, setLinkIdInput] = useState("");

  const [stats, setStats] = useState({
    balance: "$0.00",
    myOwnEarnings: "$0.00",
    teamTotalEarnings: "$0.00",
    totalEarnings: "$0.00",
    totalWithdrawn: "$0.00"
  });

  useEffect(() => {
    fetchPaymentLinks();
    fetchStats();
  }, []);

  const fetchPaymentLinks = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/payment-links');
      setPaymentLinks(response.data);
    } catch (error) {
      console.error("Error fetching payment links:", error);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/balance');
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

  const handleCreateLink = async () => {
    if (!linkIdInput.trim()) {
      return alert("Please enter a name for the link ID!");
    }

    const finalUrl = `http://localhost:5173/${linkIdInput.trim()}`;

    const newLinkData = {
      name: linkIdInput.trim(),
      url: finalUrl,
      theme: selectedTheme,
      amount: amount,
      image: selectedImage, // আপনার সিলেক্ট করা imgLight বা imgGreen এখানে সেভ হবে
      createdAt: new Date()
    };

    try {
      const response = await axios.post('http://localhost:5000/api/create-payment-link', newLinkData);
      setPaymentLinks([...paymentLinks, response.data]);
      setLinkIdInput(""); 
      alert("Payment Link Created Successfully!");
    } catch (error) {
      console.error("Error creating link:", error);
      alert("Failed to save payment link");
    }
  };

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-bold mb-1">Dashboard</h1>
      
      {/* স্ট্যাট কার্ডস */}
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
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Payment Link</h2>
          </div>

          {/* পেমেন্ট লিংক কার্ড লিস্ট */}
          {paymentLinks.map((item) => (
            <div key={item._id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 overflow-hidden">
                <img 
                  src={item.image || imgLight} 
                  alt="Logo" 
                  className="w-10 h-10 rounded-full object-cover border flex-shrink-0 shadow-sm" 
                />
                <div className="truncate">
                  <h4 className="font-bold text-gray-800 text-sm">{item.name}</h4>
                  <p className="text-xs text-gray-400 truncate flex items-center gap-1">
                    <LinkIcon size={12} /> {item.url}
                  </p>
                </div>
              </div>

              <button 
                onClick={() => { navigator.clipboard.writeText(item.url); alert("Link Copied!"); }} 
                className="p-2.5 bg-green-50 hover:bg-green-100 text-green-600 rounded-xl transition flex-shrink-0"
                title="Copy Link"
              >
                <Copy size={16}/>
              </button>
            </div>
          ))}

          {/* নতুন লিঙ্ক তৈরির ফর্ম */}
          <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-lg shadow-gray-100/50 space-y-5">
            <div>
              <label className="block text-xs font-bold text-gray-800 uppercase tracking-wider mb-2">Link ID (text)</label>
              <input 
                type="text" 
                placeholder="e.g. ayub" 
                value={linkIdInput}
                onChange={(e) => setLinkIdInput(e.target.value)}
                className="w-full p-4 bg-gray-50 rounded-2xl border border-gray-200 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100 transition-all font-medium text-sm" 
              />
              <p className="text-[11px] text-gray-400 mt-1.5">This will be your unique payment URL (e.g. http://localhost:5173/ayub).</p>
            </div>

            {/* লোগো সিলেকশন (এখানে দুটি PNG সিলেক্ট করা যাবে) */}
            <div>
              <label className="block text-xs font-bold text-gray-800 uppercase tracking-wider mb-2">Select Logo</label>
              <div className="flex gap-4">
                <div 
                  onClick={() => setSelectedImage(imgLight)}
                  className={`cursor-pointer p-2 rounded-2xl border-2 transition-all ${selectedImage === imgLight ? 'border-green-500 bg-green-50/50 scale-105' : 'border-gray-200'}`}
                >
                  <img src={imgLight} alt="Light Logo" className="w-12 h-12 object-cover rounded-xl" />
                </div>
                <div 
                  onClick={() => setSelectedImage(imgGreen)}
                  className={`cursor-pointer p-2 rounded-2xl border-2 transition-all ${selectedImage === imgGreen ? 'border-green-500 bg-green-50/50 scale-105' : 'border-gray-200'}`}
                >
                  <img src={imgGreen} alt="Green Logo" className="w-12 h-12 object-cover rounded-xl" />
                </div>
              </div>
            </div>

            <button 
              onClick={handleCreateLink}
              className="w-full bg-green-500 text-white py-4 rounded-2xl font-bold hover:bg-green-600 transition-all duration-300 transform hover:scale-[1.01] active:scale-95 shadow-lg shadow-green-100"
            >
              Create Link
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