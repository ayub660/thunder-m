import React, { useState, useEffect } from 'react';
import { QrCode, Loader2, ExternalLink, Clock, Sparkles, CheckCircle2, AlertCircle } from "lucide-react";
import { QRCodeSVG } from 'qrcode.react';

export const CreateQrForm = () => {
  const [amount, setAmount] = useState("");
  const [generatedLink, setGeneratedLink] = useState(null);
  const [loading, setLoading] = useState(false);
  const [linkList, setLinkList] = useState([]);

  // ব্যাকএন্ড থেকে আগের লিংকগুলোর লিস্ট ফেচ করা
  const fetchLinks = () => {
    fetch('http://localhost:5000/api/transactions')
      .then(res => res.json())
      .then(data => {
        const items = data.success ? data.transactions : (Array.isArray(data) ? data : []);
        setLinkList(items);
      })
      .catch(err => console.error('Error fetching links:', err));
  };

  useEffect(() => {
    fetchLinks();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!amount) return alert("Please enter an amount");
    
    setLoading(true);
    try {
      const response = await fetch('http://localhost:5000/api/generate-gateway-qr', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          amount: amount,
          currency: 'USD',
          orderId: 'ORDER-' + Date.now(),
          buyerEmail: 'customer@example.com',
          userEmail: 'admin@mamun.com'
        })
      });

      const data = await response.json();

      if (data.success && data.checkoutLink) {
        setGeneratedLink(data.checkoutLink);
        fetchLinks();
        setAmount("");
      } else {
        alert(data.error || 'Failed to generate payment QR');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Server error while generating QR');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 md:p-10 bg-gradient-to-br from-gray-50 via-gray-50/50 to-green-50/20 min-h-screen">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* পেজ হেডার */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/80 backdrop-blur-md p-5 rounded-3xl border border-gray-100 shadow-sm">
          <div>
            <div className="flex items-center gap-1.5 text-green-600 font-bold text-[11px] uppercase tracking-wider mb-0.5">
              <Sparkles size={13} /> Crypto Gateway
            </div>
            <h1 className="text-xl md:text-2xl font-extrabold text-gray-900 tracking-tight">QR Payment Creator</h1>
            <p className="text-xs text-gray-400 mt-0.5">Generate crypto payment QRs instantly.</p>
          </div>
          <div className="bg-green-50 text-green-700 px-3.5 py-1.5 rounded-xl font-bold text-xs border border-green-100 flex items-center gap-1.5 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            Online
          </div>
        </div>

        {/* ফর্ম এবং QR কোড প্রিভিউ সেকশন */}
        <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-gray-100/80 space-y-6">
          
          {/* ফর্ম অংশ */}
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-bold text-gray-900">New Invoice</h2>
              <p className="text-xs text-gray-400 mt-0.5">Enter amount to create checkout link.</p>
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
                className="w-full bg-green-500 text-white py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-green-600 transition-all disabled:opacity-50 cursor-pointer shadow-lg shadow-green-200/50 text-sm"
              >
                {loading ? <Loader2 className="animate-spin" size={17} /> : <QrCode size={17} />} 
                {loading ? 'Generating...' : 'Generate QR Code'}
              </button>
            </form>
          </div>

          {/* SVG QR প্রিভিউ সেকশন */}
          <div className="flex flex-col items-center justify-center bg-gray-50/60 p-5 rounded-2xl border border-dashed border-gray-200">
            {generatedLink ? (
              <div className="w-full flex flex-col items-center animate-in fade-in zoom-in duration-200 max-w-sm">
                <div className="p-4 bg-white rounded-2xl shadow-sm border border-gray-100">
                  <QRCodeSVG 
                    value={generatedLink} 
                    size={180} 
                    bgColor={"#ffffff"}
                    fgColor={"#000000"}
                    level={"H"}
                    includeMargin={true}
                  />
                </div>
                <p className="mt-2.5 text-[11px] text-gray-400 font-mono truncate max-w-[240px] text-center">{generatedLink}</p>
                <a 
                  href={generatedLink} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="mt-3.5 w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-md shadow-blue-100 cursor-pointer"
                >
                  Open Checkout Page <ExternalLink size={13} />
                </a>
              </div>
            ) : (
              <div className="text-center py-5 text-gray-400">
                <div className="w-12 h-12 bg-white rounded-xl shadow-sm border border-gray-100 flex items-center justify-center mx-auto mb-2 text-gray-300">
                  <QrCode size={24} />
                </div>
                <p className="font-bold text-xs text-gray-600">No QR Generated</p>
                <p className="text-[10px] text-gray-400 mt-0.5">Enter amount & click generate</p>
              </div>
            )}
          </div>

        </div>

        {/* পেমেন্ট হিস্ট্রি সেকশন */}
        <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-center mb-5">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Payment History</h2>
              <p className="text-xs text-gray-400 mt-0.5">Previous generated invoices.</p>
            </div>
            <span className="text-xs font-bold px-3 py-1 bg-gray-100 text-gray-600 rounded-xl">
              Total: {linkList.length}
            </span>
          </div>

          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
            {linkList.length > 0 ? (
              linkList.map((item, index) => {
                const linkUrl = item.checkoutLink || item.payId || item.invoiceId;
                const isPaid = item.status === 'Paid' || item.status === 'Success';
                
                return (
                  <div 
                    key={item.id || item._id || index} 
                    className="p-3.5 rounded-2xl border border-gray-100 hover:border-green-200 hover:shadow-sm transition-all bg-gray-50/40 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 group"
                  >
                    <div className="space-y-0.5">
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
                      <p className="text-[11px] text-gray-500 font-mono truncate max-w-xs">
                        {linkUrl || 'No link'}
                      </p>
                      <p className="text-[10px] text-gray-400 flex items-center gap-1 font-medium">
                        <Clock size={10} /> {item.createdAt ? new Date(item.createdAt).toLocaleString() : 'Recent'}
                      </p>
                    </div>

                    {linkUrl && (
                      <a 
                        href={linkUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="w-full sm:w-auto px-3.5 py-1.5 bg-white border border-gray-200 group-hover:border-green-500 group-hover:text-green-600 text-gray-700 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                      >
                        Open <ExternalLink size={12} />
                      </a>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="text-center py-12 text-gray-400">
                <QrCode size={36} className="mx-auto mb-2 opacity-20" />
                <p className="font-bold text-xs text-gray-600">No payment links found.</p>
                <p className="text-[11px] text-gray-400 mt-0.5">Generated links will show up here.</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};