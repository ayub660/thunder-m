import React, { useState } from "react";
import { Outlet } from "react-router-dom";
import { AppSidebar } from "./components/AppSidebar";
import { Menu, X } from "lucide-react";

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen w-full bg-[#f9f9f9] text-[#1a1c1c] font-sans antialiased overflow-x-hidden flex flex-col lg:flex-row">

      {/* ===== MOBILE TOP BAR (Sticky) ===== */}
      <header className="lg:hidden sticky top-0 z-50 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between shadow-sm shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
            <span className="text-white font-bold text-sm">$</span>
          </div>
          <span className="font-bold text-gray-900 text-base">Cash Hunter</span>
        </div>

        <button
          onClick={() => setSidebarOpen(true)}
          className="p-2 rounded-xl bg-gray-50 active:bg-gray-100 text-gray-700"
        >
          <Menu size={22} />
        </button>
      </header>

      {/* ===== SIDEBAR (Desktop-এ Sticky এবং Mobile-এ Drawer) ===== */}
      <div
        className={`
          fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-100
          transform transition-transform duration-300 ease-in-out
          lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 lg:z-auto shrink-0
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        {/* Mobile close button */}
        <div className="lg:hidden flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
              <span className="text-white font-bold text-sm">$</span>
            </div>
            <span className="font-bold text-gray-900">Cash Hunter</span>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-2 rounded-xl bg-gray-50 text-gray-600"
          >
            <X size={20} />
          </button>
        </div>

        <AppSidebar onNavigate={() => setSidebarOpen(false)} />
      </div>

      {/* ===== OVERLAY (mobile only) ===== */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ===== MAIN CONTENT ===== */}
      <div className="flex-1 flex flex-col min-w-0 w-full lg:h-screen lg:overflow-y-auto">
        <main className="flex-1 w-full px-3 py-3 sm:px-5 sm:py-5 lg:px-8 lg:py-8 pb-10 box-border">
          <div className="w-full max-w-[1400px] mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;