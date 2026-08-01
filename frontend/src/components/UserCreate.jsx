import React, { useState, useEffect } from 'react';
import { Plus, Search, Filter, Phone, Mail, UserCheck, Edit, Trash2, DollarSign, Send } from 'lucide-react';
import Swal from 'sweetalert2';
import { Pagination } from './Pagination'; // path ঠিক করে নাও যদি অন্য জায়গায় থাকে

export const UserCreate = () => {
  const [users, setUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUserName, setSelectedUserName] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const API_URL = import.meta.env.MODE === 'production'
    ? 'https://thunder-m.vercel.app'
    : 'http://localhost:5000';

  const getCurrentUser = () => {
    try {
      const item = localStorage.getItem('userInfo') || localStorage.getItem('user');
      if (item && item !== 'undefined' && item !== 'null') {
        const parsed = JSON.parse(item);
        return {
          role: parsed.role || localStorage.getItem('role') || '',
          id: (parsed._id || parsed.id || parsed.userId || localStorage.getItem('userId') || '').toString(),
          email: parsed.email || localStorage.getItem('userEmail') || ''
        };
      }
      return {
        role: localStorage.getItem('role') || '',
        id: localStorage.getItem('userId') || '',
        email: localStorage.getItem('userEmail') || ''
      };
    } catch (e) {
      console.error('Error parsing user info:', e);
      return { role: '', id: '', email: '' };
    }
  };

  const currentUser = getCurrentUser();
  const currentRole = currentUser.role;
  const isMasterAdmin = currentRole === 'master_admin' || currentUser.email === 'admin@mamun.com';
  const isTeamLeader = currentRole === 'team_leader';
  const canManageUsers = isMasterAdmin || isTeamLeader;

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'single',
    whatsapp: '',
    dollarRate: ''
  });

  const fetchUsers = async () => {
    try {
      const { role, id, email } = getCurrentUser();
      const res = await fetch(
        `${API_URL}/api/admin/users?role=${role}&userId=${id}&email=${email}`
      );
      const data = await res.json();

      let list = [];
      if (Array.isArray(data)) {
        list = data;
      } else if (data.users && Array.isArray(data.users)) {
        list = data.users;
      }

      const seen = new Set();
      const uniqueUsers = list.filter((user) => {
        const uid = user?._id || user?.id;
        if (!uid) return true;
        const idStr = String(uid);
        if (seen.has(idStr)) return false;
        seen.add(idStr);
        return true;
      });

      setUsers(uniqueUsers);
    } catch (err) {
      console.error('Error fetching users:', err);
      setUsers([]);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Search/Filter বদলালে page 1-এ ফিরে যাবে
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedUserName]);

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

    let finalRole = formData.role;
    if (latestRole === 'team_leader') {
      finalRole = 'single';
    }

    try {
      const url = editingUserId
        ? `${API_URL}/api/admin/users/${editingUserId}`
        : `${API_URL}/api/admin/create-user`;

      const method = editingUserId ? 'PUT' : 'POST';

      const payload = {
        name: formData.name,
        email: formData.email,
        role: finalRole,
        whatsapp: formData.whatsapp,
        dollarRate: formData.dollarRate !== '' ? Number(formData.dollarRate) : 0,
        creatorRole: latestRole,
        createdBy: currentUserId
      };

      if (!editingUserId || (formData.password && formData.password.trim() !== '')) {
        payload.password = formData.password;
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (res.ok && (data.success || data._id || data.id || data.message)) {
        Swal.fire(
          'Success!',
          data.message || (editingUserId ? 'User Updated Successfully!' : 'User Created Successfully!'),
          'success'
        );
        setIsModalOpen(false);
        fetchUsers();
        setEditingUserId(null);
        setFormData({ name: '', email: '', password: '', role: 'single', whatsapp: '', dollarRate: '' });
      } else {
        Swal.fire('Failed', data.message || 'Operation failed', 'error');
      }
    } catch (err) {
      console.error(err);
      Swal.fire('Error', 'Server connection error!', 'error');
    }
  };

  const handleDeleteUser = async (userId) => {
    const { role: latestRole, id: currentUserId } = getCurrentUser();

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

    if (!result.isConfirmed) return;

    try {
      const res = await fetch(`${API_URL}/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creatorRole: latestRole,
          createdBy: currentUserId
        })
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
  };

  const handlePayUser = async (user) => {
    const targetUserId = user._id || user.id;
    const rawBalance = Number(user.totalAmount ?? user.totalDollar ?? user.dollar ?? user.balance ?? 0);
    const userBalance = rawBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const { value: amount } = await Swal.fire({
      title: `Pay Request for ${user.name}`,
      html: `
        <div class="mb-4 p-3 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center justify-between">
          <span class="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
            <svg class="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            Available Balance:
          </span>
          <span class="text-sm font-extrabold text-emerald-700">$${userBalance}</span>
        </div>
      `,
      input: 'number',
      inputLabel: 'Enter Payout Amount ($)',
      inputPlaceholder: 'e.g. 50',
      imageUrl: 'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Animals/Monkey%20Face.png',
      imageWidth: 80,
      imageHeight: 80,
      imageAlt: 'Monkey Logo',
      showCancelButton: true,
      confirmButtonText: '💸 Send Request',
      cancelButtonText: 'Cancel',
      buttonsStyling: false,
      customClass: {
        popup: 'rounded-3xl p-6 bg-white border border-gray-100 shadow-2xl',
        title: 'text-lg font-extrabold text-gray-800 tracking-tight mt-2',
        input: 'w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-center font-bold text-gray-800 outline-none focus:border-emerald-500 focus:bg-white text-base transition-all mb-1',
        confirmButton: 'bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2.5 px-5 rounded-xl text-xs sm:text-sm shadow-lg shadow-emerald-200 transition-all cursor-pointer mr-2',
        cancelButton: 'bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold py-2.5 px-5 rounded-xl text-xs sm:text-sm transition-all cursor-pointer'
      },
      inputValidator: (value) => {
        if (!value || Number(value) <= 0) {
          return 'Please enter a valid amount!';
        }
        if (Number(value) > rawBalance) {
          return `Insufficient balance! Available: $${userBalance}`;
        }
      }
    });

    if (!amount) return;

    try {
      const res = await fetch(`${API_URL}/api/withdrawals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: targetUserId,
          amount: Number(amount),
          email: user.email,
          name: user.name
        })
      });

      const data = await res.json();

      if (res.ok && data.success !== false) {
        Swal.fire({
          title: 'Request Sent Successfully!',
          text: 'Withdrawal request has been submitted.',
          imageUrl: 'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Animals/Monkey.png',
          imageWidth: 70,
          imageHeight: 70,
          buttonsStyling: false,
          customClass: {
            popup: 'rounded-3xl p-6 bg-white border border-gray-100 shadow-2xl',
            title: 'text-lg font-extrabold text-gray-800',
            confirmButton: 'bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2.5 px-6 rounded-xl text-xs sm:text-sm shadow-md transition-all cursor-pointer'
          }
        });
        await fetchUsers();
      } else {
        Swal.fire({
          title: 'Failed!',
          text: data.message || 'Failed to submit withdrawal request',
          icon: 'error',
          buttonsStyling: false,
          customClass: {
            popup: 'rounded-3xl p-6 bg-white shadow-2xl',
            confirmButton: 'bg-red-500 text-white font-bold py-2.5 px-6 rounded-xl text-xs'
          }
        });
      }
    } catch (err) {
      console.error(err);
      Swal.fire({
        title: 'Error!',
        text: 'Server connection error or API endpoint not found!',
        icon: 'error',
        buttonsStyling: false,
        customClass: {
          popup: 'rounded-3xl p-6 bg-white shadow-2xl',
          confirmButton: 'bg-red-500 text-white font-bold py-2.5 px-6 rounded-xl text-xs'
        }
      });
    }
  };

  const filteredUsers = users.filter((user) => {
    const nameMatch = user.name ? user.name.toLowerCase().includes(searchQuery.toLowerCase()) : false;
    const emailMatch = user.email ? user.email.toLowerCase().includes(searchQuery.toLowerCase()) : false;
    const matchesSearch = nameMatch || emailMatch;
    const matchesUser = selectedUserName === 'all' || user.name === selectedUserName;
    return matchesSearch && matchesUser;
  });

  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage) || 1;
  const paginatedUsers = filteredUsers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="p-3 sm:p-6 bg-gray-50/50 min-h-screen w-full max-w-full overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">User Management</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Manage users, update roles or remove accounts securely.
          </p>
        </div>

        {canManageUsers && (
          <button
            onClick={() => handleOpenModal()}
            className="bg-green-500 hover:bg-green-600 text-white px-4 py-2.5 rounded-xl font-bold shadow-md shadow-green-100 flex items-center gap-2 transition-all cursor-pointer text-xs sm:text-sm w-full sm:w-auto justify-center"
          >
            <Plus size={16} /> Add User
          </button>
        )}
      </div>

      {/* Search + Filter */}
      <div className="bg-white p-3 sm:p-4 rounded-2xl border border-gray-100 shadow-sm mb-5 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative w-full sm:w-72 md:w-80">
          <Search className="absolute left-3.5 top-3 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-3 py-2.5 bg-gray-50/80 rounded-xl border border-gray-200 outline-none text-xs sm:text-sm focus:border-green-500 focus:bg-white transition-all font-medium"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter size={16} className="text-gray-400 shrink-0" />
          <select
            value={selectedUserName}
            onChange={(e) => setSelectedUserName(e.target.value)}
            className="w-full sm:w-48 p-2.5 bg-gray-50/80 rounded-xl border border-gray-200 outline-none text-xs sm:text-sm cursor-pointer font-medium text-gray-700 focus:border-green-500 focus:bg-white transition-all"
          >
            <option value="all">All Users (Show All)</option>
            {users.map((u, idx) => (
              <option key={`${u._id || u.id || 'u'}-${idx}`} value={u.name}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ========== DESKTOP TABLE (md+) ========== */}
      <div className="hidden md:block bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="w-full">
          <table className="w-full text-left border-collapse table-fixed">
            <thead>
              <tr className="bg-gray-50/70 text-gray-400 text-[10px] sm:text-[11px] uppercase tracking-wider border-b border-gray-100">
                <th className="py-3 px-3 font-bold w-[24%]">User Name</th>
                <th className="py-3 px-3 font-bold w-[22%]">Email</th>
                <th className="py-3 px-3 font-bold w-[14%]">WhatsApp</th>
                <th className="py-3 px-3 font-bold w-[14%]">Total $</th>
                <th className="py-3 px-3 font-bold w-[12%]">Role</th>
                <th className="py-3 px-3 font-bold text-center w-[14%]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs sm:text-sm">
              {paginatedUsers.length > 0 ? (
                paginatedUsers.map((user, index) => {
                  const uniqueKey = `${user._id || user.id || 'user'}-${index}`;
                  const displayAmount = Number(
                    user.totalAmount ?? user.totalDollar ?? user.dollar ?? user.balance ?? 0
                  ).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

                  return (
                    <tr key={uniqueKey} className="hover:bg-green-50/20 transition-colors group">
                      <td className="py-3 px-3 font-semibold text-gray-800">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 bg-green-100 text-green-600 rounded-xl flex items-center justify-center font-bold text-xs shrink-0">
                            {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-gray-900 truncate">{user.name}</div>
                            <div className="text-[10px] text-gray-400 truncate">
                              ID: {(user._id || user.id || 'N/A').toString().slice(-8)}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-gray-600">
                        <div className="flex items-center gap-1.5 text-xs font-medium min-w-0">
                          <Mail size={13} className="text-gray-400 shrink-0" />
                          <span className="truncate">{user.email}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-gray-600">
                        <span className="inline-flex items-center gap-1 bg-gray-50 border border-gray-100 px-2 py-1 rounded-lg text-[11px] font-semibold text-gray-700 truncate max-w-full">
                          <Phone size={11} className="text-green-500 shrink-0" />
                          <span className="truncate">{user.whatsapp || 'N/A'}</span>
                        </span>
                      </td>
                      <td className="py-3 px-3 font-bold text-gray-700">
                        <span className="inline-flex items-center gap-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-1 rounded-lg text-xs font-bold">
                          <DollarSign size={12} />
                          {displayAmount}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
                            user.role === 'team_leader'
                              ? 'bg-green-50 text-green-600 border border-green-100'
                              : user.role === 'master_admin'
                              ? 'bg-purple-50 text-purple-600 border border-purple-100'
                              : 'bg-blue-50 text-blue-600 border border-blue-100'
                          }`}
                        >
                          {user.role}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {canManageUsers && (
                            <>
                              <button
                                onClick={() => handlePayUser(user)}
                                className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-colors cursor-pointer"
                                title="Pay / Withdraw"
                              >
                                <Send size={14} />
                              </button>
                              <button
                                onClick={() => handleOpenModal(user)}
                                className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors cursor-pointer"
                                title="Edit"
                              >
                                <Edit size={14} />
                              </button>
                              <button
                                onClick={() => handleDeleteUser(user._id || user.id)}
                                className="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors cursor-pointer"
                                title="Delete"
                              >
                                <Trash2 size={14} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-gray-400">
                    <UserCheck size={30} className="mx-auto mb-2 opacity-30" />
                    <p className="font-medium text-xs">No users found matching your filter.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination - Desktop */}
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          itemsPerPage={itemsPerPage}
          totalItems={filteredUsers.length}
        />
      </div>

      {/* ========== MOBILE CARDS (< md) ========== */}
      <div className="md:hidden space-y-3">
        {paginatedUsers.length > 0 ? (
          paginatedUsers.map((user, index) => {
            const uniqueKey = `m-${user._id || user.id || 'user'}-${index}`;
            const displayAmount = Number(
              user.totalAmount ?? user.totalDollar ?? user.dollar ?? user.balance ?? 0
            ).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

            return (
              <div
                key={uniqueKey}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 bg-green-100 text-green-600 rounded-xl flex items-center justify-center font-bold text-sm shrink-0">
                      {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-gray-900 text-sm truncate">{user.name}</div>
                      <div className="text-[10px] text-gray-400 truncate">
                        ID: {(user._id || user.id || 'N/A').toString().slice(-8)}
                      </div>
                    </div>
                  </div>
                  <span
                    className={`shrink-0 px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase ${
                      user.role === 'team_leader'
                        ? 'bg-green-50 text-green-600 border border-green-100'
                        : user.role === 'master_admin'
                        ? 'bg-purple-50 text-purple-600 border border-purple-100'
                        : 'bg-blue-50 text-blue-600 border border-blue-100'
                    }`}
                  >
                    {user.role}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Mail size={13} className="text-gray-400 shrink-0" />
                    <span className="truncate">{user.email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600">
                    <Phone size={13} className="text-green-500 shrink-0" />
                    <span>{user.whatsapp || 'N/A'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <DollarSign size={13} className="text-emerald-600 shrink-0" />
                    <span className="font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg text-xs">
                      ${displayAmount}
                    </span>
                  </div>
                </div>

                {canManageUsers && (
                  <div className="flex items-center gap-2 pt-1 border-t border-gray-50">
                    <button
                      onClick={() => handlePayUser(user)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-xs font-bold hover:bg-emerald-100 transition-colors cursor-pointer"
                    >
                      <Send size={13} /> Pay
                    </button>
                    <button
                      onClick={() => handleOpenModal(user)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-blue-50 text-blue-600 rounded-xl text-xs font-bold hover:bg-blue-100 transition-colors cursor-pointer"
                    >
                      <Edit size={13} /> Edit
                    </button>
                    <button
                      onClick={() => handleDeleteUser(user._id || user.id)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-red-50 text-red-600 rounded-xl text-xs font-bold hover:bg-red-100 transition-colors cursor-pointer"
                    >
                      <Trash2 size={13} /> Delete
                    </button>
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 py-12 text-center text-gray-400">
            <UserCheck size={30} className="mx-auto mb-2 opacity-30" />
            <p className="font-medium text-xs">No users found matching your filter.</p>
          </div>
        )}

        {/* Pagination - Mobile */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            itemsPerPage={itemsPerPage}
            totalItems={filteredUsers.length}
          />
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && canManageUsers && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-md p-5 sm:p-7 rounded-2xl shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-gray-900 mb-5 flex items-center gap-2">
              <UserCheck className="text-green-500" size={20} />
              {editingUserId ? 'Edit User Details' : 'Create New User'}
            </h2>

            <div className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. John Doe"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 outline-none text-xs sm:text-sm font-medium focus:border-green-500 focus:bg-white transition-all"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  placeholder="e.g. john@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 outline-none text-xs sm:text-sm font-medium focus:border-green-500 focus:bg-white transition-all"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                  {editingUserId ? 'New Password (Leave blank to keep old)' : 'Password'}
                </label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 outline-none text-xs sm:text-sm font-medium focus:border-green-500 focus:bg-white transition-all"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                  WhatsApp Number
                </label>
                <input
                  type="text"
                  placeholder="e.g. +8801700000000"
                  value={formData.whatsapp}
                  onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                  className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 outline-none text-xs sm:text-sm font-medium focus:border-green-500 focus:bg-white transition-all"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                  Dollar Rate (1$ = ? BDT)
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="Enter custom rate for this user"
                  value={formData.dollarRate}
                  onChange={(e) => setFormData({ ...formData, dollarRate: e.target.value })}
                  className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 outline-none text-xs sm:text-sm font-medium focus:border-green-500 focus:bg-white transition-all"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                  Role
                </label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full p-3 bg-gray-50/80 rounded-xl border border-gray-200 outline-none text-xs sm:text-sm font-medium cursor-pointer focus:border-green-500 focus:bg-white transition-all text-gray-700"
                >
                  <option value="single">Single</option>
                  {isMasterAdmin && (
                    <option value="team_leader">Team Leader</option>
                  )}
                </select>
                {isTeamLeader && (
                  <p className="text-[10px] text-gray-400 mt-1">
                    Team Leader can only create Single users.
                  </p>
                )}
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="w-1/2 bg-gray-100 text-gray-600 py-3 rounded-xl font-bold hover:bg-gray-200 transition cursor-pointer text-xs sm:text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveUser}
                  className="w-1/2 bg-green-500 text-white py-3 rounded-xl font-bold hover:bg-green-600 transition shadow-md shadow-green-100 cursor-pointer text-xs sm:text-sm"
                >
                  {editingUserId ? 'Update User' : 'Save User'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserCreate;