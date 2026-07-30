import React, { useState, useEffect } from 'react';
import { QrCode, Loader2, ExternalLink, Clock, CheckCircle2, AlertCircle, Zap, DollarSign } from "lucide-react";
import { QRCodeSVG } from 'qrcode.react';
import Swal from 'sweetalert2';

export const CreateQrForm = () => {
  const [amount, setAmount] = useState("");
  const [currentAmount, setCurrentAmount] = useState("8.00");
  const [generatedLink, setGeneratedLink] = useState(null);
  const [lightningInvoice, setLightningInvoice] = useState(null);
  const [loading, setLoading] = useState(false);
  const [linkList, setLinkList] = useState([]);

  // লোকাল ও লাইভ (Vercel) পরিবেশের জন্য ডায়নামিক API বেস URL
  const API_URL = import.meta.env.MODE === 'production' ? 'https://thunder-m.vercel.app' : 'http://localhost:5000';

  // ইউজার ইনফো নিরাপদে রিড করার হেল্পার ফাংশন
  const getCurrentUserInfo = () => {
    let storedUser = {};
    try {
      const rawData = localStorage.getItem('userInfo') || 
                      localStorage.getItem('user') || 
                      localStorage.getItem('admin') || 
                      localStorage.getItem('merchant');
      storedUser = rawData ? JSON.parse(rawData) : {};
    } catch (e) {
      storedUser = {};
    }

    const userId = storedUser._id || storedUser.id || localStorage.getItem('userId') || '';
    const userEmail = storedUser.email || localStorage.getItem('userEmail') || '';
    let role = storedUser.role || storedUser.isAdmin || localStorage.getItem('role') || '';

    if (!role) {
      role = (userEmail === 'admin@mamun.com') ? 'master' : 'user';
    }

    return { userId, userEmail, role };
  };

  // ব্যাকএন্ড থেকে ডাইনামিক userId, email ও role সহ ট্রানজেকশন বা লিংক লিস্ট ফেচ করা
  const fetchLinks = () => {
    const { userId, userEmail, role } = getCurrentUserInfo();

    fetch(`${API_URL}/api/transactions?userId=${encodeURIComponent(userId)}&userEmail=${encodeURIComponent(userEmail)}&role=${encodeURIComponent(role)}`)
      .then(res => res.json())
      .then(data => {
        const items = data.success ? data.transactions : (Array.isArray(data) ? data : (data.links || []));
        setLinkList(items);
      })
      .catch(err => console.error('Error fetching links:', err));
  };

  useEffect(() => {
    fetchLinks();
  }, []);

  // ক্যাশঅ্যাপ ডিপ লিংক এবং লাইটনিং স্কিম রিডাইরেক্ট হ্যান্ডলার
  const handleCashAppRedirect = (invoiceStr) => {
    const targetInvoice = invoiceStr || lightningInvoice;
    
    if (targetInvoice && typeof targetInvoice === 'string') {
      if (targetInvoice.startsWith('lnbc')) {
        const cashAppUrl = `https://cash.app/launch/lightning/${targetInvoice}`;
        window.location.href = cashAppUrl;
      } else if (targetInvoice.includes('cash.app') || targetInvoice.startsWith('http')) {
        window.location.href = targetInvoice;
      } else {
        Swal.fire({
          icon: 'warning',
          title: 'Invalid Format',
          text: 'The invoice format is not recognized for CashApp.',
          confirmButtonColor: '#00D54B'
        });
      }
    } else {
      Swal.fire({
        icon: 'warning',
        title: 'Not Ready',
        text: 'Lightning invoice is not ready yet!',
        confirmButtonColor: '#00D54B'
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!amount) {
      Swal.fire({
        icon: 'warning',
        title: 'Required',
        text: 'Please enter an amount',
        confirmButtonColor: '#00D54B',
      });
      return;
    }
    
    const { userId, userEmail, role } = getCurrentUserInfo();

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/generate-gateway-qr`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          amount: amount,
          currency: 'USD',
          orderId: 'ORDER-' + Date.now(),
          buyerEmail: 'customer@example.com',
          userEmail: userEmail,
          userId: userId, 
          role: role
        })
      });

      const data = await response.json();

      if (data.success && (data.lightningInvoice || data.bolt11 || data.checkoutLink)) {
        const rawInvoice = data.checkoutLink || data.lightningInvoice || data.bolt11 || '';
        
        setCurrentAmount(amount);
        setGeneratedLink(rawInvoice);
        setLightningInvoice(rawInvoice);
        fetchLinks();
        setAmount("");
        
        Swal.fire({
          icon: 'success',
          title: 'QR Generated!',
          text: `Lightning QR generated for $${amount} successfully.`,
          confirmButtonColor: '#00D54B',
          timer: 1500,
          showConfirmButton: false
        });
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Failed',
          text: data.error || 'Failed to generate payment QR',
          confirmButtonColor: '#00D54B',
        });
      }
    } catch (error) {
      console.error('Error:', error);
      Swal.fire({
        icon: 'error',
        title: 'Server Error',
        text: 'Server error while generating QR',
        confirmButtonColor: '#00D54B',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full">
      <div className="w-full space-y-6">
        
        {/* পেজ হেডার */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/90 backdrop-blur-md p-4 sm:p-5 rounded-2xl border border-gray-100 shadow-sm">
          <div>
            <div className="flex items-center gap-1.5 text-green-600 font-bold text-[11px] uppercase tracking-wider mb-0.5">
              <Zap size={13} /> CashApp Style Gateway
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900 tracking-tight">Create Lightning QR</h1>
            <p className="text-xs text-gray-400 mt-0.5">Generate dynamic amount lnbc invoice QRs instantly.</p>
          </div>
          <div className="bg-green-50 text-green-700 px-3.5 py-1.5 rounded-xl font-bold text-xs border border-green-100 flex items-center gap-1.5 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            {import.meta.env.MODE === 'production' ? 'Online (Vercel)' : 'Online (Localhost)'}
          </div>
        </div>

        {/* ফর্ম সেকশন */}
        <div className="bg-white p-4 sm:p-6 md:p-8 rounded-2xl shadow-sm border border-gray-100/80 space-y-5">
          <div>
            <h2 className="text-lg font-bold text-gray-900">New Lightning Invoice</h2>
            <p className="text-xs text-gray-400 mt-0.5">Enter amount to create dynamic payment QR.</p>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Amount (USD)</label>
              <div className="relative">
                <span className="absolute left-4 top-3.5 text-gray-400 font-bold text-base">$</span>
                <input 
                  type="number" 
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-9 pr-4 py-3 bg-gray-50/80 border border-gray-200 rounded-2xl text-lg font-bold text-gray-800 outline-none focus:border-green-500 focus:bg-white focus:ring-4 focus:ring-green-500/10 transition-all" 
                />
              </div>
            </div>
            
            <div>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Quick Amounts</p>
              <div className="flex gap-2 flex-wrap">
                {['10', '30', '50', '100', '200', '500', '1000'].map(amt => (
                  <button 
                    key={amt} 
                    type="button"
                    onClick={() => setAmount(amt)} 
                    className="px-3.5 py-1.5 border border-gray-200 rounded-xl hover:border-green-500 hover:bg-green-50/50 hover:text-green-600 transition-all font-semibold text-xs bg-gray-50/50 cursor-pointer text-gray-700 shadow-sm"
                  >
                    ${amt}
                  </button>
                ))}
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-[#00D54B] text-white py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-[#02b841] transition-all disabled:opacity-50 cursor-pointer shadow-lg shadow-green-200/50 text-sm"
            >
              {loading ? <Loader2 className="animate-spin" size={17} /> : <QrCode size={17} />} 
              {loading ? 'Generating...' : 'Generate CashApp Lightning QR'}
            </button>
          </form>
        </div>

        {/* QR কোড প্রিভিউ সেকশন */}
        {lightningInvoice && (
          <div className="flex flex-col items-center justify-center bg-[#00D54B] p-6 sm:p-8 rounded-[2.5rem] shadow-xl text-white animate-in fade-in zoom-in duration-200">
            <div className="w-full flex flex-col items-center max-w-xs">
              <p className="text-[11px] font-extrabold tracking-widest uppercase opacity-90 mb-1">
                SCAN OR TAP TO PAY
              </p>
              <h2 className="text-3xl font-black mb-4">
                ${currentAmount}
              </h2>

              <div className="relative bg-white p-4 rounded-3xl shadow-2xl">
                <div className="relative bg-white rounded-xl overflow-hidden flex justify-center">
                  <QRCodeSVG 
                    value={lightningInvoice} 
                    size={180}
                    bgColor={"#ffffff"}
                    fgColor={"#000000"}
                    level={"H"}
                  />
                </div>

                <div className="absolute inset-0 m-auto w-10 h-10 bg-[#00D54B] rounded-xl flex items-center justify-center shadow-md border-2 border-white">
                  <DollarSign className="w-5 h-5 text-white stroke-[3]" />
                </div>
              </div>

              <p className="text-xs font-semibold tracking-wide opacity-95 mt-3 mb-4">
                Waiting for payment.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-2 w-full">
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(generatedLink);
                    Swal.fire({ icon: 'success', title: 'Copied!', text: 'Invoice copied to clipboard', timer: 1200, showConfirmButton: false, confirmButtonColor: '#00D54B' });
                  }}
                  className="flex-1 bg-white/20 hover:bg-white/30 text-white border border-white/30 py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer backdrop-blur-sm"
                >
                  Copy Link
                </button>
                <button 
                  onClick={() => handleCashAppRedirect(generatedLink)}
                  className="flex-1 bg-black hover:bg-gray-900 text-white py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
                >
                  Pay App <ExternalLink size={12} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* পেমেন্ট হিস্ট্রি */}
        <div className="bg-white p-4 sm:p-6 md:p-8 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-5">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Payment History</h2>
              <p className="text-xs text-gray-400 mt-0.5">Previous generated lightning invoices.</p>
            </div>
            <span className="text-xs font-bold px-3 py-1 bg-gray-100 text-gray-600 rounded-xl">
              Total: {linkList.length}
            </span>
          </div>

          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
            {linkList.length > 0 ? (
              linkList.map((item, index) => {
                const itemLink = item.checkoutLink || item.lightningInvoice || item.bolt11 || '';
                const isPaid = item.status === 'Paid' || item.status === 'Success';
                
                return (
                  <div 
                    key={item.id || item._id || index} 
                    className="p-3.5 rounded-2xl border border-gray-100 hover:border-green-200 hover:shadow-sm transition-all bg-gray-50/40 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 group"
                  >
                    <div className="space-y-0.5 w-full sm:w-auto overflow-hidden">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-900 text-sm">
                          ${item.amount || '0.00'}
                        </span>
                        <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${
                          isPaid 
                            ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' 
                            : 'bg-amber-50 text-amber-600 border border-amber-100'
                        }`}>
                          {isPaid ? <CheckCircle2 size={10} /> : <AlertCircle size={10} />}
                          {item.status || 'Pending'}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-500 font-mono truncate max-w-[250px] sm:max-w-md">
                        {itemLink || 'No link'}
                      </p>
                      <p className="text-[10px] text-gray-400 flex items-center gap-1 font-medium">
                        <Clock size={10} /> {item.createdAt ? new Date(item.createdAt).toLocaleString() : 'Recent'}
                      </p>
                    </div>

                    {itemLink && (
                      <button 
                        onClick={() => handleCashAppRedirect(itemLink)}
                        className="w-full sm:w-auto px-3.5 py-1.5 bg-white border border-gray-200 group-hover:border-green-500 group-hover:text-green-600 text-gray-700 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer shrink-0"
                      >
                        Pay App <ExternalLink size={12} />
                      </button>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="text-center py-12 text-gray-400">
                <QrCode size={36} className="mx-auto mb-2 opacity-20" />
                <p className="font-bold text-xs text-gray-600">No invoices found.</p>
                <p className="text-[11px] text-gray-400 mt-0.5">Generated invoices will show up here.</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};