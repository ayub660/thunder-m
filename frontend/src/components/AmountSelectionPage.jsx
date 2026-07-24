import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';

const AmountSelectionPage = () => {
  const { linkId } = useParams();
  const navigate = useNavigate();
  const [amount, setAmount] = useState('10.00');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // প্রিসেট অ্যামাউন্ট অপশনসমূহ
  const presetAmounts = ['10.00', '50.00', '100.00', '200.00', '300.00', '500.00'];

  const handlePayNow = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await axios.post('http://localhost:5000/api/generate-gateway-qr', {
        linkId: linkId,
        amount: amount,
        buyerEmail: 'customer@example.com',
        userEmail: 'admin@mamun.com'
      });

      if (response.data.success && response.data.invoiceId) {
        const invoiceId = response.data.invoiceId;
        
        // ব্যাকএন্ড থেকে প্রাপ্ত সম্পূর্ণ পেমেন্ট ডাটা স্টেট আকারে পাস করে ডাইনামিক ইউআরএল-এ নিয়ে যাওয়া হচ্ছে
        navigate(`/${linkId}/i/${invoiceId}`, { 
          state: { paymentData: response.data, selectedAmount: amount } 
        });
      } else {
        setError(response.data.error || "Failed to generate invoice");
      }
    } catch (err) {
      console.error("Error creating invoice:", err);
      setError("Failed to connect with payment gateway.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[#f9f9f9] flex flex-col h-dvh overflow-hidden font-sans items-center justify-center">
      <div className="w-full max-w-[480px] bg-white rounded-[28px] border border-gray-200 shadow-sm p-6 text-center mx-4">
        
        {/* Header Profile / Logo */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-14 h-14 bg-[#00D54B] text-white rounded-full flex items-center justify-center text-2xl font-black shadow-sm mb-2">
            S
          </div>
          <h2 className="text-xl font-bold text-gray-900">Stephanie</h2>
          <div className="flex items-center gap-1.5 bg-[#00D54B]/10 text-[#00D54B] px-3 py-1 rounded-full text-xs font-bold mt-1">
            <span>🔒 Secure Payment</span>
          </div>
        </div>

        {/* Amount Input */}
        <div className="mb-6">
          <div className="relative flex items-center justify-center border-2 border-gray-200 rounded-2xl py-3 px-4 focus-within:border-[#00D54B] transition">
            <span className="text-2xl font-black text-gray-400 mr-1">$</span>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="text-3xl font-black text-gray-900 w-32 text-center bg-transparent outline-none"
            />
          </div>
        </div>

        {/* Preset Amounts Grid */}
        <div className="mb-6">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Select Amount</p>
          <div className="grid grid-cols-3 gap-3">
            {presetAmounts.map((val) => (
              <button
                key={val}
                onClick={() => setAmount(val)}
                className={`py-3 rounded-xl font-bold text-sm border transition cursor-pointer ${
                  amount === val 
                    ? 'bg-[#00D54B]/10 border-[#00D54B] text-[#00D54B]' 
                    : 'border-gray-200 text-gray-700 hover:border-gray-300'
                }`}
              >
                ${val}
              </button>
            ))}
          </div>
        </div>

        {/* Pay Now Button */}
        <button
          onClick={handlePayNow}
          disabled={loading}
          className="w-full h-[60px] rounded-[20px] bg-[#00D54B] text-white font-bold text-xl flex items-center justify-center gap-3 shadow-lg hover:bg-[#00c64a] transition cursor-pointer disabled:bg-gray-300"
        >
          {loading ? (
            <div className="h-6 w-6 border-3 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <span>Pay Now</span>
              <span>→</span>
            </>
          )}
        </button>

        {error && <p className="text-red-500 text-xs font-bold mt-4">{error}</p>}
      </div>
    </div>
  );
};

export default AmountSelectionPage;