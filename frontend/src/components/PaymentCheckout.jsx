import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';

export const PaymentCheckout = () => {
  const { linkId } = useParams(); // URL থেকে লিংক আইডি (যেমন: ayub) নেওয়া হলো
  const [linkData, setLinkData] = useState(null);
  const [qrCodeImage, setQrCodeImage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // ব্যাকএন্ড থেকে এই লিংকের ডাটা (লোগো, অ্যামাউন্ট ইত্যাদি) ফেচ করা
    axios.get(`http://localhost:5000/api/payment-links/${linkId}`)
      .then(res => setLinkData(res.data))
      .catch(err => console.error("Link data not found", err));
  }, [linkId]);

  // Pay বাটনে ক্লিক করলে পেমেন্ট গেটওয়ে থেকে ডাইনামিক QR কোড আনার ফাংশন
  const handlePayClick = async () => {
    setLoading(true);
    try {
      // পেমেন্ট গেটওয়ের API কল (যেখানে অ্যামাউন্ট বা লিংক আইডি পাঠানো হবে)
      const response = await axios.post('http://localhost:5000/api/generate-gateway-qr', {
        linkId: linkId,
        amount: linkData?.amount || 10
      });

      // পেমেন্ট গেটওয়ে থেকে আসা QR কোডের ইমেজ বা লিংক সেট করা
      setQrCodeImage(response.data.qrCodeUrl); 
    } catch (error) {
      console.error("Error generating gateway QR:", error);
      alert("Failed to generate payment QR from gateway!");
    } finally {
      setLoading(false);
    }
  };

  if (!linkData) {
    return <div className="p-8 text-center text-gray-500">Loading Payment Page...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full text-center space-y-6 border border-gray-100">
        
        {/* ড্যাশবোর্ডে যে লোগো সিলেক্ট করা হয়েছিল, ঠিক সেটি এখানে শো করবে */}
        <div className="flex justify-center">
          {linkData.image ? (
            <img src={linkData.image} alt="Selected Logo" className="w-20 h-20 rounded-full object-cover border-4 border-green-50 shadow-md" />
          ) : (
            <div className="w-20 h-20 rounded-full bg-green-500 text-white flex items-center justify-center font-bold text-xl">Pay</div>
          )}
        </div>

        <div>
          <h2 className="text-xl font-bold text-gray-800">Checkout: {linkData.name}</h2>
          <p className="text-sm text-gray-400 mt-1">Amount to Pay: <span className="font-bold text-green-600">${linkData.amount || "10.00"}</span></p>
        </div>

        {/* যদি পেমেন্ট গেটওয়ে থেকে QR কোড চলে আসে, তবে সেটি দেখাবে। না হলে Pay বাটন দেখাবে */}
        {!qrCodeImage ? (
          <button 
            onClick={handlePayClick}
            disabled={loading}
            className="w-full bg-green-500 text-white py-4 rounded-2xl font-bold hover:bg-green-600 transition shadow-lg shadow-green-100 disabled:bg-gray-300"
          >
            {loading ? "Generating QR..." : "Pay Now"}
          </button>
        ) : (
          <div className="space-y-4 animate-fadeIn">
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-2xl flex flex-col items-center">
              <p className="text-xs font-bold text-gray-500 mb-2">Scan QR code to complete payment</p>
              <img src={qrCodeImage} alt="Gateway QR Code" className="w-48 h-48 object-contain border p-2 bg-white rounded-xl shadow-sm" />
            </div>
            <p className="text-xs text-green-600 font-medium">Waiting for payment confirmation...</p>
          </div>
        )}

      </div>
    </div>
  );
};