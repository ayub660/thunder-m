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
    <div className="bg-[#f9f9f9] flex flex-col h-dvh overflow-hidden font-sans">
      <header className="sticky top-0 z-50 flex items-center justify-between border-b border-neutral-100 bg-white px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#00D54B] text-lg font-black text-white shadow-sm">
            S
          </div>
        </div>
        <div className="flex items-center gap-2 bg-[#00D54B]/10 text-[#00D54B] px-3 py-1.5 rounded-full text-xs font-bold border border-[#00D54B]/20">
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path clipRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" fillRule="evenodd"></path>
          </svg>
          Secure
        </div>
      </header>

      <main className="flex-1 bg-[#f5f5f5] flex justify-center pt-10 overflow-auto">
        <div className="w-full max-w-[560px] px-5 pb-10">
          {paymentStatus === 'completed' ? (
            <div className="bg-white rounded-[22px] p-8 text-center space-y-4 shadow-sm border border-gray-200">
              <div className="w-16 h-16 bg-emerald-100 text-[#00D54B] rounded-full flex items-center justify-center mx-auto text-3xl font-bold">
                ✓
              </div>
              <h2 className="text-2xl font-black text-gray-900">Payment Successful!</h2>
              <p className="text-gray-500 text-sm">Your payment was completed successfully.</p>
            </div>
          ) : (
            <>
              <div className="bg-white rounded-[22px] border border-gray-200 shadow-sm w-full max-w-[480px] mx-auto overflow-hidden">
                <div className="pt-10 pb-2 text-center">
                  <p className="text-[18px] text-gray-400 font-medium">Scan or tap to pay</p>
                  <h2 className="text-[64px] leading-none font-black text-[#0f172a] mt-2">${amount}</h2>
                </div>

                <div className="relative px-5">
                  <div className="relative rounded-xl overflow-hidden">
                    {loading ? (
                      <div className="aspect-square flex items-center justify-center">
                        <div className="h-10 w-10 border-4 border-[#00D54B] border-t-transparent rounded-full animate-spin" />
                      </div>
                    ) : paymentData?.qrCodeUrl ? (
                      <img src={paymentData.qrCodeUrl} alt="QR" className="w-full aspect-square object-contain" />
                    ) : (
                      <div className="aspect-square flex items-center justify-center text-red-500 font-bold">
                        QR unavailable
                      </div>
                    )}

                    {!loading && paymentData?.qrCodeUrl && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="bg-[#00D54B] w-28 h-28 rounded-[28px] shadow-xl border-[8px] border-white flex items-center justify-center">
                          <span className="text-white text-7xl font-black leading-none">$</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="py-5 text-center">
                  <p className="text-[24px] font-bold text-gray-900">Waiting for payment.</p>
                </div>
              </div>

              <button
                onClick={handleCashAppRedirect}
                disabled={loading || !paymentData}
                className="mt-6 w-full h-[68px] rounded-[20px] bg-[#00D54B] text-white font-bold text-[30px] flex items-center justify-center gap-5 shadow-lg hover:bg-[#00c64a] transition cursor-pointer disabled:bg-gray-300"
              >
                <div className="bg-black rounded-lg p-2">
                  <span className="text-white text-xl font-black">$</span>
                </div>
                <span className="text-[22px] font-bold">Pay now</span>
                <span className="bg-white/20 px-3 py-1 rounded-md text-[12px] uppercase font-bold">Recommended</span>
              </button>
            </>
          )}

          {error && <p className="text-red-500 text-xs text-center font-bold mt-4">{error}</p>}
        </div>
      </main>
    </div>
  );
};

export default PaymentCheckout;