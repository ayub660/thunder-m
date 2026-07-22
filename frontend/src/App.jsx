import { Outlet } from "react-router-dom";
import { AppSidebar } from "./components/AppSidebar";
import { TopBar } from "./components/TopBar";

function App() {
  return (
    <div className="flex min-h-screen bg-base-100">
      {/* বাম পাশে সাইডবার */}
      <AppSidebar />
      
      {/* ডান পাশে মূল কন্টেন্ট এরিয়া */}
      <div className="flex-1 flex flex-col">
        {/* টপবার */}
        <TopBar title="Merchant Dashboard" />
        
        {/* রাউটার থেকে আসা কম্পোনেন্টগুলো এখানে দেখাবে */}
        <main className="p-6">
          <Outlet /> 
        </main>
      </div>
    </div>
  );
}

export default App;