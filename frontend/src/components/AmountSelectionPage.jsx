import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Helmet } from 'react-helmet-async';

const AmountSelectionPage = () => {
  const { linkId } = useParams();
  const navigate = useNavigate();
  
  const [amount, setAmount] = useState('0');
  const [loading, setLoading] = useState(false);
  const [fetchingLink, setFetchingLink] = useState(true);
  const [error, setError] = useState('');
  
  const [linkInfo, setLinkInfo] = useState({
    name: linkId || 'Stephanie',
    theme: 'light',
    userEmail: null,
    userId: null
  });

  // ========== ENV ==========
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
  const PAYMENT_DOMAIN = import.meta.env.VITE_PAYMENT_DOMAIN || 'http://localhost:5173';

  useEffect(() => {
    const fetchLinkDetails = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/payment-links/${linkId}`);
        if (response.data) {
          setLinkInfo({
            name: response.data.name || linkId,
            theme: response.data.theme || 'light',
            userEmail: response.data.userEmail || response.data.email || null,
            userId: response.data.userId || null
          });
        }
      } catch (err) {
        console.error("Error fetching link details:", err);
        setError('Payment link not found');
      } finally {
        setFetchingLink(false);
      }
    };

    if (linkId) {
      fetchLinkDetails();
    } else {
      setFetchingLink(false);
    }
  }, [linkId, API_URL]);

  const handleKeyPress = (val) => {
    if (val === 'del') {
      setAmount((prev) => (prev.length > 1 ? prev.slice(0, -1) : '0'));
    } else if (val === '.') {
      if (!amount.includes('.')) {
        setAmount((prev) => prev + '.');
      }
    } else {
      setAmount((prev) => (prev === '0' ? val : prev + val));
    }
  };

  const handlePayNow = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid amount greater than 0!');
      return;
    }

    if (!linkInfo.userEmail) {
      setError('Payment link owner not found. Please refresh.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await axios.post(`${API_URL}/api/generate-gateway-qr`, {
        linkId: linkId,
        amount: amount,
        buyerEmail: 'customer@example.com',
        userEmail: linkInfo.userEmail,
        userId: linkInfo.userId,
        currency: 'USD',
        orderId: 'ORDER-' + Date.now()
      });

      if (response.data.success && response.data.invoiceId) {
        const invoiceId = response.data.invoiceId;
        navigate(`/${linkId}/i/${invoiceId}`, { 
          state: { 
            paymentData: response.data, 
            selectedAmount: amount,       
            linkTheme: linkInfo.theme 
          } 
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

  const isGreenTheme = linkInfo.theme === 'green';
  
  const pageBgClass = isGreenTheme ? 'bg-[#00D54B]' : 'bg-[#f4f4f4]';
  const logoBgClass = isGreenTheme ? 'bg-white text-[#00D54B]' : 'bg-[#00D54B] text-white';
  const nameTextColor = isGreenTheme ? 'text-white' : 'text-gray-900';
  const badgeClass = isGreenTheme ? 'bg-black/10 text-white' : 'bg-gray-200/70 text-gray-700';
  const amountTextColor = isGreenTheme ? 'text-white' : 'text-[#00D54B]';
  const dropdownClass = isGreenTheme ? 'text-white bg-white/20' : 'text-gray-700 bg-white border border-gray-200 shadow-sm';
  const keypadTextColor = isGreenTheme ? 'text-white hover:bg-white/10' : 'text-gray-900 hover:bg-black/5';
  const payButtonBg = isGreenTheme ? 'bg-black text-white hover:bg-gray-900' : 'bg-[#00D54B] text-white hover:bg-[#00c64a]';

  // ===== Dynamic OG Preview =====
  const displayName = linkInfo.name 
    ? linkInfo.name.charAt(0).toUpperCase() + linkInfo.name.slice(1) 
    : 'User';
    
  const previewImage = `${API_URL}/og/${encodeURIComponent(linkId)}`;
  const currentUrl = `${PAYMENT_DOMAIN}/${linkId}`;

  if (fetchingLink) {
    return (
      <div className="bg-[#f9f9f9] flex items-center justify-center h-dvh">
        <div className="h-10 w-10 border-4 border-gray-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Pay {displayName}</title>
        <meta name="description" content={`Send secure payment instantly to ${displayName} via Cash App.`} />

        {/* Open Graph */}
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="CashApp Pay" />
        <meta property="og:title" content={`Pay ${displayName}`} />
        <meta property="og:description" content={`Send secure payment instantly to ${displayName} via Cash App.`} />
        <meta property="og:image" content={previewImage} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:url" content={currentUrl} />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={`Pay ${displayName}`} />
        <meta name="twitter:description" content={`Send secure payment instantly to ${displayName} via Cash App.`} />
        <meta name="twitter:image" content={previewImage} />
      </Helmet>

      <div className={`flex flex-col h-dvh overflow-hidden font-sans items-center justify-between py-6 px-4 transition-colors duration-300 ${pageBgClass}`}>
        
        {/* Top Profile & Header Section */}
        <div className="flex flex-col items-center mt-2">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-black shadow-sm mb-2 ${logoBgClass}`}>
            {linkInfo.name.charAt(0).toUpperCase()}
          </div>
          <h2 className={`text-base font-bold tracking-wide capitalize ${nameTextColor}`}>
            Pay {linkInfo.name}
          </h2>
          <div className={`mt-1.5 flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[11px] font-semibold ${badgeClass}`}>
            <span>🔒 Secure Payment</span>
          </div>
        </div>

        {/* Middle Amount & Currency Section */}
        <div className="flex flex-col items-center my-auto">
          <h1 className={`text-[64px] sm:text-[80px] font-black tracking-tight leading-none ${amountTextColor}`}>
            ${amount}
          </h1>
          
          <div className={`mt-2 flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold cursor-pointer ${dropdownClass}`}>
            <span>USD</span>
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"></path>
            </svg>
          </div>
        </div>

        {/* Keypad Section */}
        <div className="w-full max-w-[300px] grid grid-cols-3 gap-y-2 gap-x-6 text-center">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'].map((key, index) => {
            const keyValue = key === '⌫' ? 'del' : key;
            return (
              <button
                key={index}
                onClick={() => handleKeyPress(keyValue)}
                className={`h-12 flex items-center justify-center text-2xl font-medium rounded-2xl transition cursor-pointer select-none ${keypadTextColor}`}
              >
                {key}
              </button>
            );
          })}
        </div>

        {/* Bottom Pay Button Section */}
        <div className="w-full max-w-[360px] mt-2">
          {error && <p className="text-red-500 text-xs text-center font-bold mb-2">{error}</p>}
          
          <button
            onClick={handlePayNow}
            disabled={loading}
            className={`w-full h-[54px] rounded-[22px] font-bold text-lg flex items-center justify-center shadow-lg transition cursor-pointer disabled:opacity-50 ${payButtonBg}`}
          >
            {loading ? (
              <div className="h-5 w-5 border-3 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              <span>Pay</span>
            )}
          </button>
        </div>

      </div>
    </>
  );
};

export default AmountSelectionPage;