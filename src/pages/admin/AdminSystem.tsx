import React, { useState, useEffect } from 'react';
import { Users, Shield, Activity, Settings, Search, Filter, MoreVertical, CheckCircle, XCircle, AlertCircle, UserPlus, UserMinus, Edit, Trash2, Clock, UserCheck, UserX, Plus, Save } from 'lucide-react';
import { FormattedMessage, FormattedNumber, FormattedDate, FormattedTime, FormattedRelativeTime } from 'react-intl';
import { useAuth } from '../../context/AuthContext';
import { Navigate } from 'react-router-dom';
import { adminApi, accountApi } from '../../utils/api';

// Mock data for users với type system




interface Account {
  id: number;
  username: string;
  email: string;
  type: number;
  status: number;
  approved: number;
  createdAt: string;
  lastLogin?: string;
}

interface CreateAccountForm {
  username: string;
  email: string;
  password: string;
  type: number;
  status: number;
  approved: number;
}

export default function AdminSystem() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'users' | 'pending' | 'system'>('users');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<'all' | 0 | 1 | 2>('all');



  const [selectedStatus, setSelectedStatus] = useState<'all' | 0 | 1 | 2>('all');
  const [selectedUser, setSelectedUser] = useState<typeof mockUsers[0] | null>(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [pendingUsers, setPendingUsers] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [page, setPage] = useState(1);
  const [limit] = useState(10); // hoặc số bạn muốn
  const [totalPages, setTotalPages] = useState(1);

  // Form states
  const [createForm, setCreateForm] = useState<CreateAccountForm>({
    username: '',
    email: '',
    password: '',
    type: 0, // Default to User
    status: 1, // Default to Active
    approved: 1 // Default to Approved
  });

  const [editForm, setEditForm] = useState<Partial<Account>>({});

  // Kiểm tra quyền admin (type 1)
  if (!user || ![1, 2, 99].includes(user.type)) {
    return <Navigate to="/" replace />;
  }

  // Load data on component mount and tab change
  useEffect(() => {
    if (activeTab === 'pending') {
      loadPendingUsers();
    } else if (activeTab === 'users') {
      loadAccounts();
    }
  }, [activeTab]);

  // Auto-hide messages after 5 seconds
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const loadAccounts = async () => {
    setIsLoading(true);
    try {
      const response = await accountApi.getListAccount({ page, limit });

      const rawAccounts = response.Data?.accounts || [];
      const pagination = response.Data?.pagination;

      const accountList = rawAccounts.map((acc: any) => ({
        id: acc.id,
        username: acc.Username,
        email: acc.Email,
        type: typeof acc.Type === 'number' ? acc.Type : 0,
        status: Number(acc.Status),
        approved: 1,
        createdAt: acc.create_time,
        lastLogin: acc.update_time,
      }));

      setAccounts(accountList);

      if (pagination?.totalPages) {
        setTotalPages(pagination.totalPages);
      } else {
        setTotalPages(Math.ceil(rawAccounts.length / limit));
      }
    } catch (error) {
      console.error('Failed to load accounts:', error);
      setMessage({ type: 'error', text: 'Failed to load accounts' });
    } finally {
      setIsLoading(false);
    }
  };

  //pagination

  useEffect(() => {
    if (activeTab === 'users') {
      loadAccounts();
    }
  }, [activeTab, page]);




  //const loadPendingUsers = async () => {
  //setIsLoading(true);
  // try {
  // const response = await adminApi.getPendingUsers();
  //setPendingUsers(response.data || []);
  // } catch (error) {
  // console.error('Failed to load pending users:', error);
  //setMessage({ type: 'error', text: 'Failed to load pending users' });
  // } finally {
  //  setIsLoading(false);
  // }
  // };

  const handleCreateAccount = async () => {
    try {
      const payload = {
        Username: createForm.username, // chuyển sang viết hoa key đúng
        Password: createForm.password,
      };

      console.log('📤 Payload gửi đi:', payload);
      await accountApi.createAccount(payload);

      setMessage({ type: 'success', text: 'Tạo tài khoản thành công' });
      setShowCreateModal(false);
      setCreateForm({
        username: '',
        email: '',
        password: '',
        type: 3,
        status: 1,
        approved: 1
      });
      loadAccounts(); // refresh lại danh sách
    } catch (error) {
      console.error('❌ Lỗi khi tạo tài khoản:', error);
      setMessage({ type: 'error', text: 'Tạo tài khoản thất bại' });
    }
  };


  const handleUpdateAccount = async () => {
    if (!editForm.id) return;

    setIsSaving(true);
    try {
      const { id, username, email, type, status, fullName } = editForm;

      // ❗ Kiểm tra quyền
      if (![1, 2, 99].includes(user?.type)) {
        setMessage({ type: 'error', text: '❌ Bạn không có quyền cập nhật thông tin người dùng' });
        setIsSaving(false); // ✅ THÊM DÒNG NÀY
        return;
      }

      const payload: any = {
        Username: username,
        Email: email,
        Status: Number(status),
        FullName: fullName || '',
      };

      // ✅ Chỉ superadmin được đổi Type
      if ([2, 99].includes(user?.type)) {
        payload.Type = typeof type === 'number' ? type : 0;
      }

      console.log('📤 Payload gửi lên:', payload);

      await accountApi.updateAccount(id, payload);

      setMessage({ type: 'success', text: 'Account updated successfully' });
      setShowEditModal(false);
      setEditForm({});
      await loadAccounts();
    } catch (error) {
      console.error('❌ Failed to update account:', error);
      setMessage({ type: 'error', text: 'Failed to update account' });
    } finally {
      setIsSaving(false);
    }
  };







  const handleDeleteAccount = async (accountId: number) => {
    if (!confirm('Are you sure you want to delete this account? This action cannot be undone.')) {
      return;
    }

    try {
      await accountApi.deleteAccount(accountId);
      setMessage({ type: 'success', text: 'Account deleted successfully' });
      loadAccounts(); // Reload accounts list
    } catch (error) {
      console.error('Failed to delete account:', error);
      setMessage({ type: 'error', text: 'Failed to delete account' });
    }
  };

  // Filter users based on search and filters
  const filteredUsers = accounts.filter(account => {
    const matchesSearch =
      account.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      account.email.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesType = selectedType === 'all' || account.type === selectedType;
    const matchesStatus = selectedStatus === 'all' || account.status === selectedStatus;

    return matchesSearch && matchesType && matchesStatus;
  });




  const getUserTypeBadgeColor = (type: number) => {
    switch (type) {
      case 1: return 'bg-danger-500/10 text-danger-500';
      case 2: return 'bg-warning-300/10 text-warning-300';
      case 3: return 'bg-primary-500/10 text-primary-500';
      default: return 'bg-dark-600 text-dark-300';
    }
  };

  const getStatusBadgeColor = (status: number) => {
    switch (status) {
      case 0: return 'bg-warning-300/10 text-warning-300';
      case 1: return 'bg-success-500/10 text-success-500';
      case -1: return 'bg-danger-500/10 text-danger-500';
      default: return 'bg-dark-600 text-dark-300';
    }
  };

  const getStatusLabel = (status: number) => {
    switch (status) {
      case 0: return 'Pending';
      case 1: return 'Active';
      case -1: return 'Delete by user';
      default: return 'Unknown';
    }
  };

  const handleUserAction = (account: Account, action: 'edit' | 'delete') => {
    if (action === 'edit') {
      setEditForm(account);
      setShowEditModal(true);
    } else if (action === 'delete') {
      handleDeleteAccount(account.id);
    }
  };

  const handleApprovalAction = async (userId: number, action: 'approve' | 'reject') => {
    try {
      await adminApi.approveUser(userId, action);
      setMessage({ type: 'success', text: `User ${action}d successfully` });
      loadPendingUsers(); // Reload pending users
    } catch (error) {
      console.error(`Failed to ${action} user:`, error);
      setMessage({ type: 'error', text: `Failed to ${action} user` });
    }
  };

  // Helper function to calculate time since registration
  const getTimeSinceRegistration = (createdAt: string) => {
    const now = new Date();
    const created = new Date(createdAt);
    const diffInMs = now.getTime() - created.getTime();

    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

    if (diffInMinutes < 60) {
      return `${diffInMinutes} phút trước`;
    } else if (diffInHours < 24) {
      return `${diffInHours} giờ trước`;
    } else {
      return `${diffInDays} ngày trước`;
    }
  };
  function getUserTypeLabel(type: number | null | undefined): string {
  switch (type) {
    case 0: return 'User';
    case 1: return 'Admin';
    case 2:
    case 99: return 'SuperAdmin';
    default: return 'Unknown';
  }
}






  return (

    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Admin System</h1>
        <p className="text-dark-400">Manage users, permissions, and monitor system performance</p>
      </div>

      {/* Global message */}
      {message && (
        <div className={`flex items-center gap-3 p-4 rounded-lg ${message.type === 'success'
            ? 'bg-success-500/10 border border-success-500/20'
            : 'bg-danger-500/10 border border-danger-500/20'
          }`}>
          {message.type === 'success' ? (
            <CheckCircle className="h-5 w-5 text-success-500 flex-shrink-0" />
          ) : (
            <AlertCircle className="h-5 w-5 text-danger-500 flex-shrink-0" />
          )}
          <p className={`text-sm ${message.type === 'success' ? 'text-success-500' : 'text-danger-500'}`}>
            {message.text}
          </p>
        </div>
      )}

      {/* System Stats */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary-500/10">
                <Users className="h-6 w-6 text-primary-500" />
              </div>
            </div>
            <div className="ml-4">
              <h2 className="text-sm font-medium text-dark-400">Total Users</h2>
              <div className="mt-1 flex items-baseline">
                <p className="text-2xl font-semibold">{accounts.length}</p>
<p className="ml-2 text-sm text-dark-400">
  ({accounts.filter(a => a.status === 1).length} active)
</p>
              </div>
              <div className="mt-1 text-xs text-dark-500">
                Admin: {accounts.filter(a => a.type === 1).length} |
Super: {accounts.filter(a => a.type === 2 || a.type === 99).length} |
User: {accounts.filter(a => a.type === 0).length}
              </div>
            </div>
          </div>
        </div>






      </div>

      {/* Tabs */}
      <div className="border-b border-dark-700">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('users')}
            className={`border-b-2 px-1 py-4 text-sm font-medium ${activeTab === 'users'
                ? 'border-primary-500 text-primary-500'
                : 'border-transparent text-dark-400 hover:text-dark-300 hover:border-dark-600'
              }`}
          >
            All Users
          </button>


        </nav>
      </div>

      {/* Content based on active tab */}
      {activeTab === 'users' && (
        <>
          {/* Filters and search */}
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="relative flex-1">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <Search className="h-4 w-4 text-dark-400" />
              </div>
              <input
                type="text"
                className="form-input pl-10"
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-2 lg:flex-shrink-0">
              <select
                className="form-select min-w-[140px]"
                value={selectedType}
                onChange={(e) =>
                  setSelectedType(e.target.value === 'all' ? 'all' : Number(e.target.value) as 0 | 1 | 2)
                }
              >
                <option value="all">All Types</option>
                <option value={0}>User</option>
                <option value={1}>Admin</option>
                <option value={2}>SuperAdmin</option>

              </select>

              <select
                className="form-select min-w-[120px]"
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value === 'all' ? 'all' : Number(e.target.value) as 0 | 1 | 2)}
              >
                <option value="all">All Status</option>
                <option value={0}>Pending</option>
                <option value={1}>Active</option>
                <option value={-1}>Deleted</option>
              </select>
              <button
                onClick={() => setShowCreateModal(true)}
                className="btn btn-primary inline-flex items-center whitespace-nowrap"
              >
                <Plus className="mr-2 h-4 w-4" />
                Create Account
              </button>
            </div>
          </div>

          {/* Users table */}
          <div className="card overflow-hidden">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-[800px] w-full divide-y divide-dark-700">
                  <thead>
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-dark-400">User</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-dark-400">Type</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-dark-400">Status</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-dark-400">Created</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-dark-400">Last Login</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-dark-400">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-dark-700">
                    {filteredUsers.map((account) => (
                      <tr key={account.id} className="hover:bg-dark-700/40">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="h-10 w-10 flex-shrink-0 rounded-full bg-dark-600 flex items-center justify-center">
                              <span className="text-lg font-medium">{account.username[0].toUpperCase()}</span>
                            </div>
                            <div className="ml-4">
                              <div className="font-medium">{account.username}</div>
                              <div className="text-sm text-dark-400">{account.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getUserTypeBadgeColor(account.type)}`}>
                            {getUserTypeLabel(account.type)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusBadgeColor(account.status)}`}>
                            {account.status === 0 && <Clock className="mr-1 h-3 w-3" />}
                            {account.status === 1 && <CheckCircle className="mr-1 h-3 w-3" />}
                            {account.status === 2 && <XCircle className="mr-1 h-3 w-3" />}
                            {getStatusLabel(account.status)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-dark-400">
                          <FormattedDate
                            value={account.createdAt}
                            day="2-digit"
                            month="2-digit"
                            year="numeric"
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-dark-400">
                          {account.lastLogin ? (
                            <FormattedDate
                              value={account.lastLogin}
                              day="2-digit"
                              month="2-digit"
                              year="numeric"
                              hour="2-digit"
                              minute="2-digit"
                            />
                          ) : (
                            'Never'
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                          <div className="flex justify-end space-x-2">
                            <button
                              onClick={() => handleUserAction(account, 'edit')}
                              className="text-dark-400 hover:text-primary-500"
                              title="Edit Account"
                            >
                              <Edit className="h-4 w-4" />
                            </button>

                            <button
                              onClick={() => handleUserAction(account, 'delete')}
                              className="text-dark-400 hover:text-danger-500"
                              title="Delete Account"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>

                    ))}
                  </tbody>


                </table>

              </div>

            )}

          </div>
          {!isLoading && accounts.length > 0 && (
            <div className="flex justify-between items-center mt-4 px-6">
              <div className="text-sm text-dark-400">
                Showing page {page} of {totalPages}
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                  className="btn btn-outline disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>

                {Array.from({ length: totalPages }, (_, i) => (
                  <button
                    key={i + 1}
                    onClick={() => setPage(i + 1)}
                    className={`px-3 py-2 text-sm rounded-md ${i + 1 === page
                        ? 'bg-primary-500 text-white'
                        : 'text-dark-400 hover:text-dark-200 hover:bg-dark-700'
                      }`}
                  >
                    {i + 1}
                  </button>
                ))}

                <button
                  onClick={() => setPage(page + 1)}
                  disabled={page === totalPages}
                  className="btn btn-outline disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}

        </>

      )}


      {activeTab === 'pending' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium">Pending User Approvals</h2>
            <button
              onClick={loadPendingUsers}
              className="btn btn-outline inline-flex items-center"
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-dark-400 border-t-transparent rounded-full animate-spin mr-2" />
              ) : (
                <Activity className="mr-2 h-4 w-4" />
              )}
              Refresh
            </button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : pendingUsers.length === 0 ? (
            <div className="card p-8 text-center">
              <UserCheck className="h-12 w-12 text-dark-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-dark-300 mb-2">No Pending Approvals</h3>
              <p className="text-dark-400">All user registrations have been reviewed.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {pendingUsers.map((user) => (
                <div key={user.id} className="card overflow-hidden">
                  <div className="p-6">
                    <div className="flex items-center mb-4">
                      <div className="h-12 w-12 rounded-full bg-dark-600 flex items-center justify-center">
                        <span className="text-lg font-medium">{user.username[0].toUpperCase()}</span>
                      </div>
                      <div className="ml-4">
                        <h3 className="font-medium">{user.username}</h3>
                        <p className="text-sm text-dark-400">{user.email}</p>
                      </div>
                    </div>

                    <div className="space-y-2 mb-6">
                      <div className="flex justify-between text-sm">
                        <span className="text-dark-400">Type:</span>
                        <span className={`px-2 py-1 rounded text-xs ${getUserTypeBadgeColor(user.type)}`}>
                          {getUserTypeLabel(user.type)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-dark-400">Registered:</span>
                        <div className="text-right">
                          <div>
                            <FormattedDate
                              value={user.createdAt}
                              year="numeric"
                              month="short"
                              day="2-digit"
                            />
                          </div>
                          <div className="text-xs text-dark-500">
                            <FormattedTime
                              value={user.createdAt}
                              hour="2-digit"
                              minute="2-digit"
                            />
                          </div>
                        </div>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-dark-400">Waiting time:</span>
                        <span className="text-warning-300 text-xs">
                          {getTimeSinceRegistration(user.createdAt)}
                        </span>
                      </div>
                    </div>

                    <div className="flex space-x-3">
                      <button
                        onClick={() => handleApprovalAction(user.id, 'approve')}
                        className="flex-1 btn bg-success-500 hover:bg-success-600 text-white py-2 text-sm"
                      >
                        <UserCheck className="mr-2 h-4 w-4" />
                        Approve
                      </button>
                      <button
                        onClick={() => handleApprovalAction(user.id, 'reject')}
                        className="flex-1 btn bg-danger-500 hover:bg-danger-600 text-white py-2 text-sm"
                      >
                        <UserX className="mr-2 h-4 w-4" />
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'system' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="card">
            <div className="card-header">
              <h2 className="text-lg font-medium">System Status</h2>
            </div>
            <div className="p-6 space-y-6">
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-dark-400">Memory Usage</span>
                  <span className="text-sm">{systemStats.memoryUsage}%</span>
                </div>
                <div className="h-2 bg-dark-700 rounded-full">
                  <div
                    className="h-2 bg-primary-500 rounded-full"
                    style={{ width: `${systemStats.memoryUsage}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-dark-400">Uptime</div>
                  <div className="text-lg font-medium">{systemStats.uptime}</div>
                </div>
                <div>
                  <div className="text-sm text-dark-400">Last Backup</div>
                  <div className="text-lg font-medium">
                    <FormattedDate
                      value={systemStats.lastBackup}
                      year="numeric"
                      month="short"
                      day="2-digit"
                      hour="2-digit"
                      minute="2-digit"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h2 className="text-lg font-medium">Quick Actions</h2>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 gap-4">
                <button className="btn btn-primary">
                  <Shield className="mr-2 h-4 w-4" />
                  Security Audit
                </button>
                <button className="btn btn-primary">
                  <Activity className="mr-2 h-4 w-4" />
                  System Health Check
                </button>
                <button className="btn btn-primary">
                  <Users className="mr-2 h-4 w-4" />
                  Export User Data
                </button>
                <button className="btn btn-primary">
                  <Settings className="mr-2 h-4 w-4" />
                  System Settings
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Account Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-dark-900/80 flex items-center justify-center p-4 z-50">
          <div className="card w-full max-w-md">
            <div className="card-header flex justify-between items-center">
              <h2 className="text-lg font-medium">Create New Account</h2>
              <button
                className="text-dark-400 hover:text-dark-300"
                onClick={() => setShowCreateModal(false)}
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label htmlFor="create-username" className="form-label">Username</label>
                <input
                  type="text"
                  id="create-username"
                  className="form-input"
                  value={createForm.username}
                  onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })}
                  required
                />
              </div>

              <div>
                <label htmlFor="create-email" className="form-label">Email</label>
                <input
                  type="email"
                  id="create-email"
                  className="form-input"
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  required
                />
              </div>

              <div>
                <label htmlFor="create-password" className="form-label">Password</label>
                <input
                  type="password"
                  id="create-password"
                  className="form-input"
                  value={createForm.password}
                  onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="create-type" className="form-label">Type</label>
                  <select
                    id="create-type"
                    className="form-select"
                    value={createForm.type}
                    onChange={(e) => setCreateForm({ ...createForm, type: Number(e.target.value) })}
                  >
                    <option value={1}>Admin</option>
                    <option value={2}>SuperAdmin</option>

                    <option value={0}>User</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="create-status" className="form-label">Status</label>
                  <select
                    id="create-status"
                    className="form-select"
                    value={createForm.status}
                    onChange={(e) => setCreateForm({ ...createForm, status: Number(e.target.value) })}
                  >
                    <option value={0}>Pending</option>
                    <option value={1}>Active</option>
                    <option value={2}>Suspended</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateAccount}
                  disabled={isSaving}
                  className="btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Create Account
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Account Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-dark-900/80 flex items-center justify-center p-4 z-50">
          <div className="card w-full max-w-md">
            <div className="card-header flex justify-between items-center">
              <h2 className="text-lg font-medium">Edit Account</h2>
              <button
                className="text-dark-400 hover:text-dark-300"
                onClick={() => setShowEditModal(false)}
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label htmlFor="edit-username" className="form-label">Username</label>
                <input
                  type="text"
                  id="edit-username"
                  className="form-input"
                  value={editForm.username || ''}
                  onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                />
              </div>

              <div>
                <label htmlFor="edit-email" className="form-label">Email</label>
                <input
                  type="email"
                  id="edit-email"
                  className="form-input"
                  value={editForm.email || ''}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="edit-type" className="form-label">Type</label>
                  <select
                    id="edit-type"
                    className="form-select"
                    value={editForm.type ?? 0}
                    onChange={(e) => setEditForm({ ...editForm, type: Number(e.target.value) })}
                  >
                    <option value={1}>Admin</option>
                    <option value={2}>SuperAdmin</option>
                    <option value={0}>User</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="edit-status" className="form-label">Status</label>
                  <select
                    id="edit-status"
                    className="form-select"
                    value={editForm.status !== undefined ? editForm.status : 1}

                    onChange={(e) => setEditForm({ ...editForm, status: Number(e.target.value) })}
                  >
                    <option value={0}>Pending</option>
                    <option value={1}>Active</option>
                    <option value={2}>Suspended</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setShowEditModal(false)}
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateAccount}
                  disabled={isSaving}
                  className="btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Update Account
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}