import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, useLocation } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';

const API_URL =
  import.meta.env.MODE === 'production'
    ? 'https://thunder-m.vercel.app'
    : 'http://localhost:5000';

const PublicCheckout = () => {
  const { invoiceId } = useParams();
  const location = useLocation();

  const passedData = location.state?.paymentData || null;
  const selectedAmount = location.state?.selectedAmount || null;

  const [amount, setAmount] = useState(selectedAmount || passedData?.amount || '0');
  const [loading, setLoading] = useState(true);
  const [paymentData, setPaymentData] = useState(passedData);
  const [error, setError] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('pending');
  const [countdown, setCountdown] = useState(3);

  // Invoice load
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
        setError('Failed to load invoice');
      } finally {
        setLoading(false);
      }
    };

    loadInvoice();
  }, [invoiceId, passedData, selectedAmount]);

  // Status poll
  useEffect(() => {
    const id = paymentData?.invoiceId || invoiceId;
    if (!id || paymentStatus !== 'pending') return;

    const interval = setInterval(async () => {
      try {
        const res = await axios.get(`${API_URL}/i/${id}/status`);
        if (res.data.status === 'completed' || res.data.status === 'Paid') {
          setPaymentStatus('completed');
          clearInterval(interval);
        }
      } catch {}
    }, 3000);

    return () => clearInterval(interval);
  }, [paymentData, invoiceId, paymentStatus]);

  // Auto Cash App redirect
  useEffect(() => {
    if (loading || !paymentData || paymentStatus === 'completed') return;

    const inv =
      paymentData?.bolt11 ||
      paymentData?.lightningInvoice ||
      paymentData?.lnInvoice;

    if (!inv || typeof inv !== 'string' || !inv.startsWith('lnbc')) return;

    setCountdown(3);
    const cd = setInterval(() => setCountdown((p) => (p <= 1 ? 0 : p - 1)), 1000);
    const timer = setTimeout(() => {
      window.location.href = `https://cash.app/launch/lightning/${inv}`;
    }, 3000);

    return () => {
      clearTimeout(timer);
      clearInterval(cd);
    };
  }, [paymentData, loading, paymentStatus]);

  const handleCashAppRedirect = () => {
    const inv =
      paymentData?.bolt11 ||
      paymentData?.lightningInvoice ||
      paymentData?.lnInvoice;

    if (inv && typeof inv === 'string' && inv.startsWith('lnbc')) {
      window.location.href = `https://cash.app/launch/lightning/${inv}`;
    } else {
      alert('Lightning invoice is not ready yet!');
    }
  };

  const getQrValue = () => {
    const inv =
      paymentData?.bolt11 ||
      paymentData?.lightningInvoice ||
      paymentData?.lnInvoice ||
      '';
    if (inv && inv.startsWith('lnbc')) {
      return `https://cash.app/launch/lightning/${inv}`;
    }
    return inv || '';
  };

  if (paymentStatus === 'completed') {
    return (
      <div className="min-h-screen bg-[#F5F5F5] flex flex-col items-center justify-center py-8 px-4 font-sans">
        <div className="w-20 h-20 bg-[#00D54B] text-white rounded-full flex items-center justify-center text-4xl font-black shadow-lg mb-6">✓</div>
        <h2 className="text-2xl font-black text-gray-900 mb-2">Payment Successful!</h2>
        <p className="text-gray-500 text-sm">Thank you for your payment.</p>
      </div>
    );
  }

  // শুধু QR page — Amount page নেই
  return (
    <div className="min-h-screen bg-[#F5F5F5] flex flex-col items-center justify-center py-8 px-4 font-sans select-none">
      <div className="bg-white rounded-[28px] shadow-xl w-full max-w-[360px] flex flex-col items-center pt-8 pb-6 px-6">
        <p className="text-[13px] font-semibold tracking-wide text-gray-500 mb-1">
          Scan or tap to pay
        </p>
        <h1 className="text-[40px] leading-none font-black text-gray-900 mb-6 tracking-tight">
          ${Number(amount).toFixed(2)}
        </h1>

        <div className="relative bg-white w-[260px] h-[260px] flex items-center justify-center mb-5">
          {loading ? (
            <div className="h-10 w-10 border-4 border-[#00D54B] border-t-transparent rounded-full animate-spin" />
          ) : getQrValue() ? (
            <>
              <QRCodeSVG
                value={getQrValue()}
                size={240}
                bgColor="#ffffff"
                fgColor="#000000"
                level="M"
                includeMargin={false}
              />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="bg-[#00D54B] w-[56px] h-[56px] rounded-[14px] shadow-md border-[3px] border-white flex items-center justify-center">
                  <span className="text-white text-[28px] font-black leading-none">$</span>
                </div>
              </div>
            </>
          ) : (
            <div className="text-red-500 font-bold text-sm text-center px-4">
              {error || 'QR unavailable'}
            </div>
          )}
        </div>

        <p className="text-gray-800 font-semibold text-[15px]">Waiting for payment.</p>
        {!loading && getQrValue() && countdown > 0 && (
          <p className="text-gray-400 text-xs mt-1">Opening Cash App in {countdown}s...</p>
        )}
        {error && <p className="text-red-500 text-xs text-center font-bold mt-3">{error}</p>}
      </div>

      <div className="w-full max-w-[360px] mt-5">
        <button
          onClick={handleCashAppRedirect}
          disabled={loading || !paymentData}
          className="w-full h-[56px] rounded-full bg-[#00D54B] text-white font-bold flex items-center justify-center gap-2 shadow-lg shadow-green-200 hover:bg-[#00c244] active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
        >
          <span className="text-white text-xl font-black">$</span>
          <span className="text-[17px] font-bold tracking-tight">Pay now</span>
          <span className="bg-white/25 text-white text-[10px] font-black uppercase px-2 py-0.5 rounded-md tracking-wider ml-1">
            RECOMMENDED
          </span>
        </button>
      </div>
    </div>
  );
};

export default PublicCheckout;