import React, { useState, useEffect } from 'react';
import { QrCode, Loader2, ExternalLink, Clock, CheckCircle2, AlertCircle, Zap, Copy, X } from "lucide-react";
import { QRCodeSVG } from 'qrcode.react';
import Swal from 'sweetalert2';

export const CreateQrForm = () => {
  const [amount, setAmount] = useState("");
  const [currentAmount, setCurrentAmount] = useState("");
  const [generatedLink, setGeneratedLink] = useState(null);
  const [lightningInvoice, setLightningInvoice] = useState(null);
  const [loading, setLoading] = useState(false);
  const [linkList, setLinkList] = useState([]);

  const API_URL = import.meta.env.MODE === 'production' 
    ? 'https://thunder-m.vercel.app' 
    : 'http://localhost:5000';

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

  const fetchLinks = () => {
    const { userId, userEmail, role } = getCurrentUserInfo();

    fetch(`${API_URL}/api/transactions?userId=${encodeURIComponent(userId)}&userEmail=${encodeURIComponent(userEmail)}&role=${encodeURIComponent(role)}`)
      .then(res => res.json())
      .then(data => {
        const items = data.success ? data.transactions : (Array.isArray(data) ? data : (data.links || []));
        
        // Duplicate _id ফিল্টার
        const seen = new Set();
        const uniqueItems = (Array.isArray(items) ? items : []).filter((item) => {
          const id = item?._id || item?.id;
          if (!id) return true;
          const idStr = String(id);
          if (seen.has(idStr)) return false;
          seen.add(idStr);
          return true;
        });

        setLinkList(uniqueItems);
      })
      .catch(err => console.error('Error fetching links:', err));
  };

  useEffect(() => {
    fetchLinks();
  }, []);

  const handleCashAppRedirect = (invoiceStr) => {
    const targetInvoice = invoiceStr || lightningInvoice;
    
    if (targetInvoice && typeof targetInvoice === 'string') {
      if (targetInvoice.startsWith('lnbc')) {
        window.location.href = `https://cash.app/launch/lightning/${targetInvoice}`;
      } else if (targetInvoice.includes('cash.app') || targetInvoice.startsWith('http')) {
        window.location.href = targetInvoice;
      } else {
        Swal.fire({
          icon: 'warning',
          title: 'Invalid Format',
          text: 'Payment link format not recognized.',
          confirmButtonColor: '#00D54B'
        });
      }
    } else {
      Swal.fire({
        icon: 'warning',
        title: 'Not Ready',
        text: 'Payment link is not ready yet!',
        confirmButtonColor: '#00D54B'
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) {
      Swal.fire({
        icon: 'warning',
        title: 'Required',
        text: 'Please enter a valid amount greater than 0',
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
          role: role,
          linkId: 'pay'
        })
      });

      const data = await response.json();

      if (data.success) {
        // ব্যাকএন্ড থেকে আসা পেমেন্ট বা চেকআউট লিংক সরাসরি QR-এর জন্য সেট করা হলো
        const paymentUrl = data.checkoutLink || data.paymentUrl || data.url || '';

        if (!paymentUrl) {
          Swal.fire({
            icon: 'error',
            title: 'No Payment Link',
            text: 'Server did not return a valid payment link.',
            confirmButtonColor: '#00D54B',
          });
          setLoading(false);
          return;
        }

        setCurrentAmount(amount);
        setGeneratedLink(paymentUrl);
        setLightningInvoice(paymentUrl); // এটি QR-এ এনকোড হবে এবং স্ক্যান করলে সরাসরি পেমেন্ট লিংকে নিয়ে যাবে
        fetchLinks();
        setAmount("");
        
        Swal.fire({
          icon: 'success',
          title: 'QR Generated!',
          text: `CashApp style QR generated for $${amount}`,
          confirmButtonColor: '#00D54B',
          timer: 1400,
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
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/90 backdrop-blur-md p-4 sm:p-5 rounded-2xl border border-gray-100 shadow-sm">
          <div>
            <div className="flex items-center gap-1.5 text-green-600 font-bold text-[11px] uppercase tracking-wider mb-0.5">
              <Zap size={13} /> CashApp Style Gateway
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900 tracking-tight">Create CashApp QR</h1>
            <p className="text-xs text-gray-400 mt-0.5">Generate dynamic amount payment QRs instantly.</p>
          </div>
          <div className="bg-green-50 text-green-700 px-3.5 py-1.5 rounded-xl font-bold text-xs border border-green-100 flex items-center gap-1.5 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            {import.meta.env.MODE === 'production' ? 'Online (Vercel)' : 'Online (Localhost)'}
          </div>
        </div>

        {/* Form */}
        <div className="bg-white p-4 sm:p-6 md:p-8 rounded-2xl shadow-sm border border-gray-100/80 space-y-5">
          <div>
            <h2 className="text-lg font-bold text-gray-900">New Payment Invoice</h2>
            <p className="text-xs text-gray-400 mt-0.5">Enter amount to create dynamic payment QR.</p>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Amount (USD)</label>
              <div className="relative">
                <span className="absolute left-4 top-3.5 text-gray-400 font-bold text-base">$</span>
                <input 
                  type="number" 
                  step="0.01"
                  min="0.01"
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
                {['5', '10', '20', '30', '50', '100', '200', '500', '1000'].map(amt => (
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
              {loading ? 'Generating...' : 'Generate CashApp Payment QR'}
            </button>
          </form>
        </div>

        {/* CashApp Style Modal / Popup Card */}
        {lightningInvoice && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-sm bg-[#00D54B] rounded-[36px] shadow-2xl overflow-hidden flex flex-col items-center pt-8 pb-8 px-6 relative select-none animate-in zoom-in-95 duration-200">
              
              {/* Close Button */}
              <button
                onClick={() => {
                  setLightningInvoice(null);
                  setGeneratedLink(null);
                  setCurrentAmount("");
                }}
                className="absolute top-5 left-5 text-white/80 hover:text-white bg-black/10 hover:bg-black/20 p-2 rounded-full transition-all cursor-pointer"
                title="Close"
              >
                <X size={20} strokeWidth={3} />
              </button>

              {/* Title & Amount */}
              <p className="text-[14px] font-bold tracking-wider uppercase text-white mb-2 mt-4 opacity-95">
                Scan or tap to pay
              </p>
              <h1 className="text-[52px] leading-none font-black text-white mb-8 tracking-tight">
                ${currentAmount}
              </h1>

              {/* QR Code Container */}
              <div className="relative bg-white rounded-[32px] shadow-2xl w-[260px] h-[260px] flex items-center justify-center overflow-hidden mb-8 p-4">
                <QRCodeSVG
                  value={lightningInvoice}
                  size={230}
                  bgColor="#ffffff"
                  fgColor="#000000"
                  level="M"
                  includeMargin={false}
                  style={{ imageRendering: 'crisp-edges' }}
                />
                
                {/* Center Dollar Icon (CashApp Style) */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="bg-[#00D54B] w-[64px] h-[64px] rounded-[18px] shadow-xl border-[4px] border-white flex items-center justify-center">
                    <span className="text-white text-3xl font-black leading-none mt-1">$</span>
                  </div>
                </div>
              </div>

              {/* Copy Button */}
              <button
                onClick={() => {
                  navigator.clipboard.writeText(lightningInvoice);
                  Swal.fire({
                    icon: "success",
                    title: "Copied!",
                    text: "Payment link copied to clipboard",
                    timer: 1200,
                    showConfirmButton: false,
                    confirmButtonColor: "#00D54B",
                  });
                }}
                className="w-full max-w-[260px] flex items-center justify-center gap-2.5 bg-white/20 hover:bg-white/30 text-white py-4 rounded-[20px] text-[15px] font-bold transition-all backdrop-blur-sm shadow-sm cursor-pointer"
              >
                <Copy size={18} strokeWidth={2.5} />
                Copy Payment Link
              </button>
            </div>
          </div>
        )}

        {/* Payment History */}
        <div className="bg-white p-4 sm:p-6 md:p-8 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-5">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Payment History</h2>
              <p className="text-xs text-gray-400 mt-0.5">Previous generated payment invoices.</p>
            </div>
            <span className="text-xs font-bold px-3 py-1 bg-gray-100 text-gray-600 rounded-xl">
              Total: {linkList.length}
            </span>
          </div>

          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
            {linkList.length > 0 ? (
              linkList.map((item, index) => {
                const itemLink = item.bolt11 || item.lightningInvoice || item.lnInvoice || item.checkoutLink || item.paymentUrl || '';
                const isPaid = item.status === 'Paid' || item.status === 'Success' || item.status === 'Settled';
                const uniqueKey = `${item._id || item.id || 'inv'}-${index}`;
                
                return (
                  <div 
                    key={uniqueKey} 
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
                        {itemLink ? (itemLink.length > 40 ? itemLink.slice(0, 28) + '...' + itemLink.slice(-8) : itemLink) : 'No link'}
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
                        Open Cash App <ExternalLink size={12} />
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
}