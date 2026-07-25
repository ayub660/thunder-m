import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, useLocation } from 'react-router-dom';

const PaymentCheckout = () => {
  const { linkId, invoiceId } = useParams();
  const location = useLocation();
  
  const passedData = location.state?.paymentData || null;
  const initialAmount = location.state?.selectedAmount || '10.00';

  const [amount, setAmount] = useState(initialAmount);
  const [loading, setLoading] = useState(!passedData);
  const [paymentData, setPaymentData] = useState(passedData);
  const [error, setError] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('pending');

  useEffect(() => {
    if (!passedData) {
      const generateInvoiceDirectly = async () => {
        setLoading(true);
        try {
          const response = await axios.post('http://localhost:5000/api/generate-gateway-qr', {
            linkId: linkId,
            amount: amount,
            buyerEmail: 'customer@example.com',
            userEmail: 'admin@mamun.com'
          });
          if (response.data.success) {
            setPaymentData(response.data);
          } else {
            setError("Failed to load QR code.");
          }
        } catch (err) {
          console.error("Error:", err);
          setError("Failed to connect with payment gateway.");
        } finally {
          setLoading(false);
        }
      };

      generateInvoiceDirectly();
    }
  }, [linkId, passedData, amount]);

  useEffect(() => {
    let interval;
    if (invoiceId && paymentStatus === 'pending') {
      interval = setInterval(async () => {
        try {
          const res = await axios.get(`http://localhost:5000/i/${invoiceId}/status`);
          if (res.data.status === 'completed' || res.data.status === 'Paid') {
            setPaymentStatus('completed');
            clearInterval(interval);
          }
        } catch (err) {
          // Silent catch
        }
      }, 5000);
    }
    return () => clearInterval(interval);
  }, [invoiceId, paymentStatus]);

  const handleCashAppRedirect = () => {
    const lightningInvoice = paymentData?.bolt11 || paymentData?.lightningInvoice || paymentData?.paymentRequest;

    if (lightningInvoice && typeof lightningInvoice === 'string' && lightningInvoice.startsWith('lnbc')) {
      const cashAppUrl = `https://cash.app/launch/lightning/${lightningInvoice}`;
      window.location.href = cashAppUrl;
    } else {
      alert("Lightning invoice (bolt11) is not ready yet!");
    }
  };

  return (
    <div className="bg-[#00D54B] flex flex-col h-dvh overflow-hidden font-sans items-center justify-between py-6 px-4 select-none">
      
      <div className="w-full max-w-[380px] flex flex-col items-center flex-1 justify-center">
        {paymentStatus === 'completed' ? (
          <div className="bg-white rounded-[32px] p-8 text-center space-y-4 shadow-2xl w-full">
            <div className="w-16 h-16 bg-emerald-100 text-[#00D54B] rounded-full flex items-center justify-center mx-auto text-3xl font-bold">
              ✓
            </div>
            <h2 className="text-2xl font-black text-gray-900">Payment Successful!</h2>
            <p className="text-gray-500 text-sm">Your payment was completed successfully.</p>
          </div>
        ) : (
          <div className="w-full flex flex-col items-center">
            
            {/* Header Text & Amount */}
            <p className="text-[14px] font-bold tracking-wider uppercase text-white mb-1">
              Scan or tap to pay
            </p>
            <h1 className="text-[52px] leading-none font-black text-white mb-5 tracking-tight">
              ${amount}
            </h1>

            {/* QR Code Box - চারপাশ থেকে সুন্দর হোয়াইট প্যাডিং এবং ক্যাশঅ্যাপ লুক */}
            <div className="relative bg-white rounded-[32px] shadow-2xl w-[320px] h-[320px] flex items-center justify-center overflow-hidden mb-4 p-5">
              {loading ? (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="h-10 w-10 border-4 border-[#00D54B] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : paymentData?.qrCodeUrl ? (
                <img 
                  src={paymentData.qrCodeUrl} 
                  alt="QR" 
                  className="w-full h-full object-contain" 
                  style={{ 
                    imageRendering: 'crisp-edges',
                    transform: 'scale(1.05)' // কিউআর কোডের ডটগুলো ছোট ও কম্প্যাক্ট দেখানোর জন্য স্কেল অ্যাডজাস্ট করা হয়েছে
                  }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-red-500 font-bold text-sm">
                  QR unavailable
                </div>
              )}

              {/* Center CashApp Logo Inside QR - আরও স্পষ্ট এবং সুন্দর করা হয়েছে */}
              {!loading && paymentData?.qrCodeUrl && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="bg-[#00D54B] w-[72px] h-[72px] rounded-[20px] shadow-lg border-[4px] border-white flex items-center justify-center">
                    <span className="text-white text-4xl font-black leading-none">$</span>
                  </div>
                </div>
              )}
            </div>

            {/* Waiting Status Text */}
            <div className="text-white font-bold text-[15px] tracking-wide">
              Waiting for payment.
            </div>
          </div>
        )}

        {error && <p className="text-white text-xs text-center font-bold mt-4">{error}</p>}
      </div>

      {/* Bottom Black Pay Now Button */}
      <div className="w-full max-w-[380px] pb-2">
        <button
          onClick={handleCashAppRedirect}
          disabled={loading || !paymentData}
          className="w-full h-[64px] rounded-[24px] bg-black text-white font-bold flex items-center justify-between px-6 shadow-2xl hover:bg-neutral-900 transition cursor-pointer disabled:opacity-50"
        >
          <div className="flex items-center gap-3">
            <span className="text-[#00D54B] text-2xl font-black">$</span>
            <span className="text-xl font-bold tracking-tight text-white">Pay now</span>
          </div>
          <span className="bg-[#00D54B]/20 text-[#00D54B] text-[10px] font-black uppercase px-2.5 py-1 rounded-md tracking-widest border border-[#00D54B]/30">
            RECOMMENDED
          </span>
        </button>
      </div>

    </div>
  );
};

export default PaymentCheckout;