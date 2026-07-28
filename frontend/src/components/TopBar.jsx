import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Bell, Search } from "lucide-react";

export function TopBar({ title }) {
  const [user, setUser] = useState(null);

  // API Base URL
  const API_URL = import.meta.env.MODE === 'production' ? 'https://thunder-m.vercel.app' : 'http://localhost:5000';

  useEffect(() => {

    const fetchUser = async () => {
      try {
        const res = await axios.get(`${API_URL}/api/me`);
        setUser(res.data);
      } catch (err) {
        console.error("Error fetching user:", err);
      }
    };
    fetchUser();
  }, [API_URL]);

  if (!user) return <header className="p-6 border-b border-base-300">Loading...</header>;

  return (
    <header className="flex items-center justify-between border-b border-base-300 bg-base-100/80 backdrop-blur px-6 py-4 sticky top-0 z-10">
      <div>
        <h1 className="text-lg font-semibold">{title}</h1>
        <p className="text-xs opacity-70">Welcome back, {user.name.split(" ")[0]}</p>
      </div>
      
      <div className="flex items-center gap-3">
        <div className="hidden md:flex items-center gap-2 rounded-md border border-base-300 bg-base-200 px-3 py-1.5 text-sm w-64">
          <Search className="h-4 w-4 opacity-60" />
          <input placeholder="Search…" className="bg-transparent outline-none flex-1 text-sm" />
        </div>
        
        <button className="grid h-9 w-9 place-items-center rounded-md border border-base-300 hover:bg-base-200 transition">
          <Bell className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-full bg-primary text-primary-content text-sm font-semibold">
            {user.name[0]}
          </div>
          <div className="hidden sm:block">
            <div className="text-sm font-medium leading-none">{user.name}</div>
            <div className="text-xs opacity-70 capitalize">{user.role}</div>
          </div>
        </div>
      </div>
    </header>
  );
}