import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, useLocation } from 'react-router-dom';

const PublicCheckout = () => {
  const { linkId, invoiceId } = useParams();
  const location = useLocation();

  const passedData = location.state?.paymentData || null;
  const selectedAmount = location.state?.selectedAmount || null;

  const [amount, setAmount] = useState(
    selectedAmount || passedData?.amount || '0'
  );
  const [loading, setLoading] = useState(true);
  const [paymentData, setPaymentData] = useState(passedData);
  const [error, setError] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('pending');

  const API_URL =
    import.meta.env.MODE === 'production'
      ? 'https://thunder-m.vercel.app'
      : 'http://localhost:5000';

  // ========== ১. Invoice লোড ==========
  useEffect(() => {
    if (passedData) {
      setPaymentData(passedData);
      setAmount(String(selectedAmount || passedData.amount || '0'));
      setLoading(false);
      return;
    }

    if (!invoiceId) {
      setLoading(false);
      setError('Invoice not found');
      return;
    }

    const loadInvoice = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await axios.get(`${API_URL}/api/transactions/${invoiceId}`);
        const tx = res.data?.transaction || res.data;

        if (!tx || (!tx.invoiceId && !tx.amount && !tx.bolt11)) {
          setError('Invoice not found');
          setLoading(false);
          return;
        }

        const loadedAmount =
          tx.amount !== undefined && tx.amount !== null && tx.amount !== ''
            ? tx.amount
            : selectedAmount || 0;

        setPaymentData({
          success: true,
          invoiceId: tx.invoiceId || invoiceId,
          checkoutLink: tx.checkoutLink,
          amount: loadedAmount,
          qrCodeUrl: tx.qrCodeUrl || null,
          bolt11: tx.bolt11 || tx.lnInvoice || tx.lightningInvoice || tx.payId,
          lightningInvoice: tx.bolt11 || tx.lnInvoice || tx.lightningInvoice || tx.payId,
          lnInvoice: tx.bolt11 || tx.lnInvoice || tx.lightningInvoice
        });
        setAmount(String(loadedAmount));
      } catch (err) {
        console.error('Load invoice error:', err);
        setError('Failed to load invoice');
      } finally {
        setLoading(false);
      }
    };

    loadInvoice();
  }, [invoiceId, passedData, selectedAmount, API_URL]);

  // ========== ২. Status poll ==========
  useEffect(() => {
    let interval;
    const id = paymentData?.invoiceId || invoiceId;

    if (id && paymentStatus === 'pending') {
      interval = setInterval(async () => {
        try {
          const res = await axios.get(`${API_URL}/i/${id}/status`);
          if (res.data.status === 'completed' || res.data.status === 'Paid') {
            setPaymentStatus('completed');
            clearInterval(interval);
          }
        } catch (err) {}
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [paymentData, invoiceId, paymentStatus, API_URL]);

  // ========== ৩. ৩ সেকেন্ড পর Auto Cash App redirect ==========
  useEffect(() => {
    if (loading || !paymentData || paymentStatus === 'completed') return;

    const lightningInvoice =
      paymentData?.bolt11 ||
      paymentData?.lightningInvoice ||
      paymentData?.lnInvoice;

    if (
      lightningInvoice &&
      typeof lightningInvoice === 'string' &&
      lightningInvoice.startsWith('lnbc')
    ) {
      const timer = setTimeout(() => {
        window.location.href = `https://cash.app/launch/lightning/${lightningInvoice}`;
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [paymentData, loading, paymentStatus]);

  // ========== Pay now button ==========
  const handleCashAppRedirect = () => {
    const lightningInvoice =
      paymentData?.bolt11 ||
      paymentData?.lightningInvoice ||
      paymentData?.lnInvoice;

    if (
      lightningInvoice &&
      typeof lightningInvoice === 'string' &&
      lightningInvoice.startsWith('lnbc')
    ) {
      window.location.href = `https://cash.app/launch/lightning/${lightningInvoice}`;
    } else {
      alert('Lightning invoice is not ready yet!');
    }
  };

  // ========== Success screen ==========
  if (paymentStatus === 'completed') {
    return (
      <div className="bg-[#00D54B] flex flex-col h-dvh overflow-hidden font-sans items-center justify-center py-6 px-4 select-none">
        <div className="w-20 h-20 bg-white text-[#00D54B] rounded-full flex items-center justify-center text-4xl font-black shadow-lg mb-6">
          ✓
        </div>
        <h2 className="text-3xl font-black text-white mb-2">Payment Successful!</h2>
        <p className="text-white/80 text-sm">Thank you for your payment.</p>
      </div>
    );
  }

  return (
    <div className="bg-[#00D54B] flex flex-col h-dvh overflow-hidden font-sans items-center justify-between py-6 px-4 select-none">
      <div className="w-full max-w-[380px] flex flex-col items-center flex-1 justify-center">
        <div className="w-full flex flex-col items-center">
          <p className="text-[14px] font-bold tracking-wider uppercase text-white mb-1">
            Scan or tap to pay
          </p>
          <h1 className="text-[52px] leading-none font-black text-white mb-5 tracking-tight">
            ${amount}
          </h1>

          {/* CashApp Style QR */}
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
                style={{ imageRendering: 'crisp-edges', transform: 'scale(1.05)' }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-red-500 font-bold text-sm text-center px-4">
                {error || 'QR unavailable'}
              </div>
            )}

            {/* Center $ icon */}
            {!loading && paymentData?.qrCodeUrl && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="bg-[#00D54B] w-[72px] h-[72px] rounded-[20px] shadow-lg border-[4px] border-white flex items-center justify-center">
                  <span className="text-white text-4xl font-black leading-none">$</span>
                </div>
              </div>
            )}
          </div>

          <div className="text-white font-bold text-[15px] tracking-wide">
            Waiting for payment.
          </div>
          <p className="text-white/80 text-xs mt-1">
            Redirecting to Cash App in 3 seconds...
          </p>
        </div>

        {error && (
          <p className="text-white text-xs text-center font-bold mt-4">{error}</p>
        )}
      </div>

      {/* Pay now button */}
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

export default PublicCheckout;