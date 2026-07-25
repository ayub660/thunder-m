import React, { useState, useEffect } from 'react';
import { Plus, Search, Filter, Phone, Mail, UserCheck, Edit, Trash2 } from 'lucide-react';
import Swal from 'sweetalert2';

export const UserCreate = () => {
  const [users, setUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUserName, setSelectedUserName] = useState('all'); 
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState(null);

  // লোকাল এবং Vercel লাইভ সার্ভারের জন্য ডাইনামিক API বেস URL
  const API_URL = import.meta.env.MODE === 'production' ? '' : 'http://localhost:5000';

  // লোকাল স্টোরেজ থেকে রোল ও আইডি বের করার নিরাপদ ফাংশন
  const getCurrentUser = () => {
    try {
      const item = localStorage.getItem('userInfo');
      if (item && item !== 'undefined' && item !== 'null') {
        const parsed = JSON.parse(item);
        return {
          role: parsed.role || parsed.type || localStorage.getItem('role') || 'master_admin',
          id: parsed._id || parsed.id || parsed.userId || ''
        };
      }
      return { 
        role: localStorage.getItem('role') || 'master_admin', 
        id: localStorage.getItem('userId') || '' 
      };
    } catch (e) {
      console.error("Error parsing user info:", e);
      return { role: 'master_admin', id: '' };
    }
  };

  const currentUser = getCurrentUser();
  const currentRole = currentUser.role;
  const isSingleUser = currentRole === 'single';

  // ফর্ম স্টেট
  const [formData, setFormData] = useState({ 
    name: '', 
    email: '', 
    password: '', 
    role: 'single', 
    whatsapp: '',
    dollarRate: ''
  });

  // ব্যাকএন্ড থেকে ইউজার ফেচ করার ফাংশন
  const fetchUsers = async () => {
    try {
      const { role, id } = getCurrentUser();
      const res = await fetch(`${API_URL}/api/admin/users?role=${role}&userId=${id}`);
      const data = await res.json();
      
      if (Array.isArray(data)) {
        setUsers(data);
      } else if (data.users && Array.isArray(data.users)) {
        setUsers(data.users);
      } else {
        setUsers([]);
      }
    } catch (err) {
      console.error("Error fetching users:", err);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [API_URL]);

  const handleOpenModal = (user = null) => {
    const { role: latestRole } = getCurrentUser();

    if (latestRole === 'single') {
      return Swal.fire('Access Denied', 'Single users do not have permission to manage users!', 'warning');
    }
    
    if (user) {
      setEditingUserId(user._id || user.id);
      setFormData({
        name: user.name || '',
        email: user.email || '',
        password: '', 
        role: user.role || 'single',
        whatsapp: user.whatsapp || '',
        dollarRate: user.dollarRate !== undefined && user.dollarRate !== null ? user.dollarRate : ''
      });
    } else {
      setEditingUserId(null);
      setFormData({ 
        name: '', 
        email: '', 
        password: '', 
        role: 'single', 
        whatsapp: '',
        dollarRate: '' 
      });
    }
    setIsModalOpen(true);
  };

  const handleSaveUser = async () => {
    const { role: latestRole, id: currentUserId } = getCurrentUser();
    
    if (latestRole === 'single') {
      return Swal.fire('Access Denied', 'Action not allowed for single users!', 'error');
    }

    if (!formData.name || !formData.email) {
      return Swal.fire('Warning', 'Name and Email are required!', 'warning');
    }
    if (!editingUserId && !formData.password) {
      return Swal.fire('Warning', 'Password is required for new user!', 'warning');
    }

    try {
      const url = editingUserId 
        ? `${API_URL}/api/admin/users/${editingUserId}`
        : `${API_URL}/api/admin/create-user`;
      
      const method = editingUserId ? 'PUT' : 'POST';

      const payload = {
        name: formData.name,
        email: formData.email,
        role: formData.role,
        whatsapp: formData.whatsapp,
        dollarRate: formData.dollarRate !== '' ? Number(formData.dollarRate) : 0,
        creatorRole: latestRole,
        createdBy: currentUserId
      };

      if (!editingUserId || (formData.password && formData.password.trim() !== '')) {
        payload.password = formData.password;
      }

      const res = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      
      if (res.ok && (data.success || data._id || data.id || data.message)) {
        Swal.fire('Success!', data.message || (editingUserId ? "User Updated Successfully!" : "User Created Successfully!"), 'success');
        setIsModalOpen(false);
        fetchUsers(); 
        setEditingUserId(null);
        setFormData({ name: '', email: '', password: '', role: 'single', whatsapp: '', dollarRate: '' });
      } else {
        Swal.fire('Failed', data.message || "Operation failed", 'error');
      }
    } catch (err) {
      console.error(err);
      Swal.fire('Error', 'Server connection error!', 'error');
    }
  };

  const handleDeleteUser = async (userId) => {
    const { role: latestRole } = getCurrentUser();
    if (latestRole === 'single') {
      return Swal.fire('Access Denied', 'Action not allowed!', 'error');
    }

    const result = await Swal.fire({
      title: 'Are you sure?',
      text: "You won't be able to revert this user!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#10B981',
      cancelButtonColor: '#EF4444',
      confirmButtonText: 'Yes, delete it!'
    });

    if (result.isConfirmed) {
      try {
        const res = await fetch(`${API_URL}/api/admin/users/${userId}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ creatorRole: latestRole })
        });
        const data = await res.json();

        if (res.ok && (data.success || data.message)) {
          Swal.fire('Deleted!', 'User has been deleted successfully.', 'success');
          fetchUsers();
        } else {
          Swal.fire('Failed!', data.message || 'Failed to delete user', 'error');
        }
      } catch (err) {
        console.error(err);
        Swal.fire('Error!', 'Server connection error!', 'error');
      }
    }
  };

  const filteredUsers = users.filter(user => {
    const nameMatch = user.name ? user.name.toLowerCase().includes(searchQuery.toLowerCase()) : false;
    const emailMatch = user.email ? user.email.toLowerCase().includes(searchQuery.toLowerCase()) : false;
    const matchesSearch = nameMatch || emailMatch;
    const matchesUser = selectedUserName === 'all' || user.name === selectedUserName;

    return matchesSearch && matchesUser;
  });

  return (
    <div className="p-8 bg-gray-50/50 min-h-screen">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">User Management</h1>
          <p className="text-xs text-gray-500 mt-1">Manage users, update roles or remove accounts securely.</p>
        </div>
        
        {!isSingleUser && (
          <button 
            onClick={() => handleOpenModal()}
            className="bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-2xl font-bold shadow-lg shadow-green-100 flex items-center gap-2 transition-all transform hover:scale-[1.02] cursor-pointer"
          >
            <Plus size={18} /> Add User
          </button>
        )}
      </div>

      <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm mb-6 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-4 top-3.5 text-gray-400" size={18} />
          <input 
            type="text" 
            placeholder="Search by name or email..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-gray-50/80 rounded-2xl border border-gray-200 outline-none text-sm focus:border-green-500 focus:bg-white transition-all font-medium"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <Filter size={18} className="text-gray-400 shrink-0" />
          <select 
            value={selectedUserName} 
            onChange={(e) => setSelectedUserName(e.target.value)}
            className="w-full md:w-60 p-3 bg-gray-50/80 rounded-2xl border border-gray-200 outline-none text-sm cursor-pointer font-medium text-gray-700 focus:border-green-500 focus:bg-white transition-all"
          >
            <option value="all">All Users (Show All)</option>
            {users.map((u) => (
              <option key={u._id || u.id} value={u.name}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/70 text-gray-400 text-[11px] uppercase tracking-wider border-b border-gray-100">
                <th className="p-5 font-bold">User Name</th>
                <th className="p-5 font-bold">Email Address</th>
                <th className="p-5 font-bold">WhatsApp</th>
                <th className="p-5 font-bold">Dollar Rate</th>
                <th className="p-5 font-bold">Role</th>
                <th className="p-5 font-bold text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {filteredUsers.length > 0 ? (
                filteredUsers.map((user) => (
                  <tr key={user._id || user.id} className="hover:bg-green-50/20 transition-colors group">
                    <td className="p-5 font-semibold text-gray-800">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-green-100 text-green-600 rounded-2xl flex items-center justify-center font-bold text-sm shadow-xs group-hover:scale-105 transition-transform">
                          {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                        </div>
                        <div>
                          <div className="font-bold text-gray-900">{user.name}</div>
                          <div className="text-[11px] text-gray-400 font-normal">ID: {user._id || user.id || 'N/A'}</div>
                        </div>
                      </div>
                    </td>

                    <td className="p-5 text-gray-600">
                      <div className="flex items-center gap-2 text-xs font-medium">
                        <Mail size={14} className="text-gray-400 shrink-0" /> 
                        <span className="truncate max-w-[200px]">{user.email}</span>
                      </div>
                    </td>

                    <td className="p-5 text-gray-600">
                      <span className="inline-flex items-center gap-1.5 bg-gray-50 border border-gray-100 px-3 py-1.5 rounded-xl text-xs font-semibold text-gray-700 shadow-2xs">
                        <Phone size={12} className="text-green-500" /> {user.whatsapp || 'N/A'}
                      </span>
                    </td>

                    <td className="p-5 font-bold text-gray-700">
                      ${user.dollarRate ?? 0} BDT
                    </td>

                    <td className="p-5">
                      <span className={`inline-flex px-3 py-1 rounded-xl text-[11px] font-bold uppercase tracking-wider ${
                        user.role === 'team_leader' 
                          ? 'bg-green-50 text-green-600 border border-green-100' 
                          : 'bg-blue-50 text-blue-600 border border-blue-100'
                      }`}>
                        {user.role}
                      </span>
                    </td>

                    <td className="p-5 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {!isSingleUser && (
                          <>
                            <button 
                              onClick={() => handleOpenModal(user)}
                              className="p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-colors cursor-pointer"
                              title="Edit User"
                            >
                              <Edit size={16} />
                            </button>
                            <button 
                              onClick={() => handleDeleteUser(user._id || user.id)}
                              className="p-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors cursor-pointer"
                              title="Delete User"
                            >
                              <Trash2 size={16} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="p-16 text-center text-gray-400">
                    <UserCheck size={36} className="mx-auto mb-2 opacity-30" />
                    <p className="font-medium text-sm">No users found matching your filter.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && !isSingleUser && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-lg p-8 rounded-3xl shadow-2xl relative animate-in fade-in zoom-in duration-200">
            <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
              <UserCheck className="text-green-500" size={22} /> 
              {editingUserId ? "Edit User Details" : "Create New User"}
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Full Name</label>
                <input 
                  type="text" 
                  placeholder="e.g. John Doe" 
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full p-3.5 bg-gray-50 rounded-2xl border border-gray-200 outline-none text-sm font-medium focus:border-green-500 focus:bg-white transition-all" 
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Email Address</label>
                <input 
                  type="email" 
                  placeholder="e.g. john@example.com" 
                  value={formData.email}
                  onChange={e => setFormData({...formData, email: e.target.value})}
                  className="w-full p-3.5 bg-gray-50 rounded-2xl border border-gray-200 outline-none text-sm font-medium focus:border-green-500 focus:bg-white transition-all" 
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                  {editingUserId ? "New Password (Leave blank to keep old)" : "Password"}
                </label>
                <input 
                  type="password" 
                  placeholder="••••••••" 
                  value={formData.password}
                  onChange={e => setFormData({...formData, password: e.target.value})}
                  className="w-full p-3.5 bg-gray-50 rounded-2xl border border-gray-200 outline-none text-sm font-medium focus:border-green-500 focus:bg-white transition-all" 
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">WhatsApp Number</label>
                <input 
                  type="text" 
                  placeholder="e.g. +8801700000000" 
                  value={formData.whatsapp}
                  onChange={e => setFormData({...formData, whatsapp: e.target.value})}
                  className="w-full p-3.5 bg-gray-50 rounded-2xl border border-gray-200 outline-none text-sm font-medium focus:border-green-500 focus:bg-white transition-all" 
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                  Dollar Rate (1$ = ? BDT)
                </label>
                <input 
                  type="number" 
                  step="0.01"
                  placeholder="Enter custom rate for this user" 
                  value={formData.dollarRate}
                  onChange={e => setFormData({...formData, dollarRate: e.target.value})}
                  className="w-full p-3.5 bg-gray-50 rounded-2xl border border-gray-200 outline-none text-sm font-medium focus:border-green-500 focus:bg-white transition-all" 
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Role</label>
                <select 
                  value={formData.role} 
                  onChange={e => setFormData({...formData, role: e.target.value})}
                  className="w-full p-3.5 bg-gray-50/80 rounded-2xl border border-gray-200 outline-none text-sm font-medium cursor-pointer focus:border-green-500 focus:bg-white transition-all text-gray-700"
                >
                  <option value="single">Single</option>
                  <option value="team_leader">Team Leader</option>
                </select>
              </div>

              <div className="flex gap-4 pt-4">
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="w-1/2 bg-gray-100 text-gray-600 py-3.5 rounded-2xl font-bold hover:bg-gray-200 transition cursor-pointer text-sm"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSaveUser}
                  className="w-1/2 bg-green-500 text-white py-3.5 rounded-2xl font-bold hover:bg-green-600 transition shadow-lg shadow-green-100 transition-all cursor-pointer text-sm"
                >
                  {editingUserId ? "Update User" : "Save User"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};