import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams } from 'react-router-dom';

const PaymentCheckout = () => {
  const { linkId } = useParams();
  const [linkData, setLinkData] = useState(null);
  const [amount, setAmount] = useState('10.00');
  const [loading, setLoading] = useState(false);
  const [paymentData, setPaymentData] = useState(null);
  const [error, setError] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('pending'); // pending, completed

  // লোকাল এবং Vercel লাইভ সার্ভারের জন্য ডাইনামিক API বেস URL
  const API_URL = import.meta.env.MODE === 'production' ? 'thunder-m.vercel.app' : 'http://localhost:5000';

  // লিঙ্ক বা প্রডাক্টের ডিটেইলস ফেচ করা
  useEffect(() => {
    const fetchLinkDetails = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/payment-links/${linkId || 'LightningPayment'}`);
        setLinkData(response.data);
        if (response.data?.amount) setAmount(response.data.amount.toString());
      } catch (error) {
        console.error("Error fetching link details:", error);
      }
    };
    fetchLinkDetails();
  }, [linkId, API_URL]);

  // ইনভয়েস তৈরি করার হ্যান্ডলার
  const handleGenerateInvoice = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await axios.post(`${API_URL}/api/generate-gateway-qr`, {
        linkId: linkId || 'LightningPayment',
        amount: amount,
        buyerEmail: 'customer@example.com',
        userEmail: 'admin@mamun.com'
      });

      if (response.data.success) {
        setPaymentData(response.data);
      } else {
        setError(response.data.error || "Failed to generate invoice");
      }
    } catch (error) {
      console.error("Invoice generation failed:", error);
      setError("Failed to connect with payment gateway. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // পেমেন্ট স্ট্যাটাস চেক করার জন্য রিয়েল-টাইম পোলিং
  useEffect(() => {
    let interval;
    if (paymentData && paymentData.invoiceId && paymentStatus === 'pending') {
      interval = setInterval(async () => {
        try {
          const res = await axios.get(`${API_URL}/i/${paymentData.invoiceId}/status`);
          if (res.data.status === 'completed' || res.data.status === 'Paid') {
            setPaymentStatus('completed');
            clearInterval(interval);
          }
        } catch (err) {
          console.error("Status check error:", err);
        }
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [paymentData, paymentStatus, API_URL]);

  const handleOpenCheckout = () => {
    if (paymentData?.checkoutLink) {
      window.open(paymentData.checkoutLink, '_blank');
    } else {
      alert("Please generate the invoice first!");
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert("Copied to clipboard!");
  };

  // থিম অনুযায়ী কালার ও স্টাইল নির্ধারণ (Green বা Light)
  const isGreenTheme = linkData?.theme === 'green';
  const primaryColor = isGreenTheme ? '#16a34a' : '#00D54B'; // গ্রিন থিমের জন্য গাঢ় সবুজ, লাইটের জন্য ক্যাশঅ্যাপ গ্রিন
  const bgColorClass = isGreenTheme ? 'bg-green-50/40' : 'bg-[#f9f9f9]';

  return (
    <div className={`${bgColorClass} flex flex-col h-dvh overflow-hidden font-sans transition-colors duration-300`}>
      <header className="sticky top-0 z-50 flex items-center justify-between border-b border-neutral-100 bg-white px-4 py-3 shadow-xs">
        <div className="flex items-center gap-2">
          {/* ডাটাবেজ থেকে আসা লোগো বা ডিফল্ট আইকন */}
          {linkData?.image ? (
            <img 
              src={linkData.image} 
              alt="Logo" 
              className="w-10 h-10 rounded-full object-cover border shadow-sm" 
            />
          ) : (
            <div 
              className="mx-auto flex h-10 w-10 items-center justify-center rounded-full text-base font-black text-white shadow-sm"
              style={{ backgroundColor: primaryColor }}
            >
              {linkData?.name ? linkData.name.charAt(0).toUpperCase() : 'S'}
            </div>
          )}
          <span className="font-bold text-gray-800 text-sm">{linkData?.name || "Stephanie"}</span>
        </div>
        <div 
          className="px-3 py-1 rounded-full text-xs font-bold border"
          style={{ 
            backgroundColor: isGreenTheme ? '#dcfce7' : 'rgba(0, 213, 75, 0.1)', 
            color: isGreenTheme ? '#15803d' : '#00D54B',
            borderColor: isGreenTheme ? '#bbf7d0' : 'rgba(0, 213, 75, 0.2)'
          }}
        >
          Secure Lightning
        </div>
      </header>

      <main className="flex-1 overflow-y-auto flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
          
          {paymentStatus === 'completed' ? (
            <div className="text-center space-y-6 py-8">
              <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto text-4xl font-bold shadow-inner">
                ✓
              </div>
              <h2 className="text-2xl font-black text-gray-900">Payment Successful!</h2>
              <p className="text-gray-500 text-sm">Thank you! Your payment has been successfully verified.</p>
              <button
                onClick={() => { setPaymentData(null); setPaymentStatus('pending'); }}
                className="w-full text-black font-bold py-3.5 rounded-2xl transition-all cursor-pointer shadow-md"
                style={{ backgroundColor: primaryColor }}
              >
                Make Another Payment
              </button>
            </div>
          ) : !paymentData ? (
            <form onSubmit={handleGenerateInvoice} className="space-y-6">
              <div className="text-center">
                <h2 className="text-2xl font-black text-gray-900">{linkData?.name || "Stephanie"}</h2>
                <p className="text-gray-500 text-xs mt-1">Pay instantly with CashApp & Lightning</p>
              </div>

              <div>
                <input
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full text-center text-4xl font-bold bg-gray-50 border border-gray-200 rounded-2xl p-6 focus:outline-none"
                  style={{ borderColor: amount ? primaryColor : undefined }}
                  placeholder="0.00"
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                {['10.00', '25.00', '50.00', '100.00', '200.00', '500.00'].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setAmount(val)}
                    className={`py-3 rounded-2xl font-bold text-sm transition-all cursor-pointer ${
                      amount === val 
                        ? 'text-white shadow-md' 
                        : 'bg-white border border-gray-200 hover:border-gray-400 text-gray-700'
                    }`}
                    style={{
                      backgroundColor: amount === val ? primaryColor : undefined
                    }}
                  >
                    ${val}
                  </button>
                ))}
              </div>

              <button
                type="submit"
                disabled={loading || !amount}
                className="w-full disabled:bg-gray-300 text-black font-black py-4 rounded-2xl text-lg transition-all shadow-lg cursor-pointer"
                style={{ backgroundColor: loading || !amount ? undefined : primaryColor }}
              >
                {loading ? "Generating Invoice..." : "Continue to Pay"}
              </button>
            </form>
          ) : (
            <div className="space-y-6 text-center">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider" style={{ color: primaryColor }}>Scan QR to Pay</p>
                <div className="text-4xl font-black mt-1 text-gray-900">${paymentData.amount} USD</div>
              </div>

              <div className="bg-white p-4 rounded-3xl border-4 border-gray-100 shadow-inner mx-auto w-fit flex items-center justify-center">
                <img
                  src={paymentData.qrCodeUrl}
                  alt="CashApp Lightning QR Code"
                  className="w-60 h-60 object-contain"
                />
              </div>

              <div className="flex items-center justify-center gap-2 text-xs text-gray-500 font-medium">
                <div className="w-2 h-2 rounded-full animate-ping" style={{ backgroundColor: primaryColor }}></div>
                Waiting for payment confirmation...
              </div>

              <button
                onClick={handleOpenCheckout}
                className="w-full text-black font-black py-4 rounded-2xl flex items-center justify-center gap-2 transition-all text-lg shadow-md cursor-pointer"
                style={{ backgroundColor: primaryColor }}
              >
                <span>Open CashApp</span>
                <span className="text-xl">↗</span>
              </button>

              <div className="flex justify-center gap-4 text-xs">
                <button
                  type="button"
                  onClick={() => copyToClipboard(paymentData.checkoutLink)}
                  className="text-gray-600 font-semibold underline cursor-pointer"
                >
                  Copy Link
                </button>
                <span className="text-gray-300">|</span>
                <button
                  type="button"
                  onClick={() => setPaymentData(null)}
                  className="text-gray-400 font-semibold underline cursor-pointer"
                >
                  Change Amount
                </button>
              </div>
            </div>
          )}

          {error && <p className="text-red-500 text-xs mt-4 text-center font-bold">{error}</p>}
        </div>
      </main>
    </div>
  );
};

export default PaymentCheckout;