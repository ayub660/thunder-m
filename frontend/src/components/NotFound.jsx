import React from 'react';
import { Link } from 'react-router-dom';

export const NotFound = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-center">
      <h1 className="text-4xl font-bold mb-4">404 - Page Not Found</h1>
      <p className="mb-6">দুঃখিত, আপনি যে পেজটি খুঁজছেন তা পাওয়া যায়নি।</p>
      <Link to="/" className="bg-green-500 text-white px-6 py-2 rounded-lg">
        ড্যাশবোর্ডে ফিরে যান
      </Link>
    </div>
  );
};