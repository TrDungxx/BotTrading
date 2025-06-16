import React, { useState, useEffect } from 'react';
import { Plus, Search, Filter, Edit, Trash2, Save, XCircle, AlertTriangle, CheckCircle, Building2 } from 'lucide-react';
import { FormattedDate, FormattedTime } from 'react-intl';
import { binanceAccountApi } from '../utils/api';

interface BinanceAccount {
  id: number;
  Status: number;
  internalAccountId: number;
  Email: string;
  Name: string;
  BinanceId: string | null;
  Description: string | null;
  create_time: string;
  update_time: string;
}

interface BinanceAccountForm {
  Status: number;
  internalAccountId: number;
  Email: string;
  Name: string;
  BinanceId: string;
  Description: string;
  ApiKey: string;
  SecretKey: string;
}

export default function BinanceAccounts() {
  const [accounts, setAccounts] = useState<BinanceAccount[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<BinanceAccount | null>(null);
  const [deletingAccount, setDeletingAccount] = useState<BinanceAccount | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [formData, setFormData] = useState<BinanceAccountForm>({
     Name: '',
  Email: '',
  ApiKey: '',
  SecretKey: '',
  Status: 1,
  internalAccountId: 1,
  BinanceId: '',
  Description: ''
  });

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    setIsLoading(true);
    try {
  const response = await binanceAccountApi.getListAccounts();
  console.log('🔥 Raw response:', response);

  // nếu response = { data: { ResponseCode, Description, Data: { accounts: [...] } } }
  const raw = response?.Data?.accounts || [];
  setAccounts(raw);
  console.log('✅ accounts:', accounts);
console.log('✅ filteredAccounts:', filteredAccounts);

  console.log('📦 Accounts trả về:', raw);
} catch (error) {
  console.error('Failed to fetch Binance accounts:', error);
  setMessage({ type: 'error', text: 'Lỗi khi tải danh sách tài khoản Binance' });
} finally {
  setIsLoading(false);
}
  };

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const query = searchQuery.trim().toLowerCase();

const filteredAccounts = query
  ? accounts.filter((account) =>
      (account.Name ?? '').toLowerCase().includes(query) ||
      (account.Email ?? '').toLowerCase().includes(query) ||
      (account.BinanceId ?? '').toLowerCase().includes(query) ||
      (account.Description ?? '').toLowerCase().includes(query)
    )
  : accounts;









  const handleCreateAccount = async () => {
  const payload = {
  Name: formData.Name?.trim(),
  Email: formData.Email?.trim(),
  ApiKey: formData.ApiKey?.trim(),
  SecretKey: formData.SecretKey?.trim(),
  Status: 1,
  internalAccountId: 1,
  BinanceId: null,
  Description: "Test from frontend"
};

  // ✅ Thêm kiểm tra bắt buộc ở đây
  if (!payload.Name || !payload.Email || !payload.ApiKey || !payload.SecretKey) {
    setMessage({ type: 'error', text: 'Vui lòng nhập đầy đủ các trường bắt buộc' });
    return;
  }

  try {
    console.log('📤 Payload gửi đi:', payload);
    await binanceAccountApi.createAccount(payload);
    fetchAccounts(); // hoặc load lại danh sách nếu có
    setMessage({ type: 'success', text: 'Tạo tài khoản Binance thành công' });
    setIsFormOpen(false);
    resetForm();
  } catch (error) {
    console.error('❌ Lỗi khi tạo account:', error);
    setMessage({ type: 'error', text: 'Tạo tài khoản Binance thất bại' });
  }
};


  const handleSubmit = (e: React.FormEvent) => {
  e.preventDefault();
  if (editingAccount) {
    handleUpdateAccount();
  } else {
    handleCreateAccount();
  }
};

const handleUpdateAccount = async () => {
  if (!editingAccount?.id) return;
  setIsSaving(true);
  try {
    const payload = {
      Name: formData.Name,
      Email: formData.Email,
      ApiKey: formData.ApiKey,
      SecretKey: formData.SecretKey,
      Status: Number(formData.Status),
      internalAccountId: Number(formData.internalAccountId),
      BinanceId: formData.BinanceId || null,
      Description: formData.Description || null
    };

    console.log('📝 Payload update gửi đi:', payload);
    await binanceAccountApi.updateAccount(editingAccount.id, payload);
    setMessage({ type: 'success', text: 'Cập nhật tài khoản Binance thành công' });

    // ✅ Sửa tại đây:
    fetchAccounts(); // hoặc loadAccounts() nếu bạn đã định nghĩa
    setIsFormOpen(false);
    setEditingAccount(null);
    resetForm();
  } catch (error) {
    console.error('❌ Lỗi khi cập nhật account:', error);
    setMessage({ type: 'error', text: 'Cập nhật tài khoản thất bại' });
  } finally {
    setIsSaving(false);
  }
};

  const handleEdit = (account: BinanceAccount) => {
    setEditingAccount(account);
    setFormData({
  Status: account.Status,
  internalAccountId: account.internalAccountId,
  Email: account.Email,
  Name: account.Name,
  BinanceId: account.BinanceId || '',
  Description: account.Description || '',
  ApiKey: '', 
  SecretKey: '' 
});
    setIsFormOpen(true);
  };

  const handleDelete = async (account: BinanceAccount) => {
    setDeletingAccount(account);
    try {
      await binanceAccountApi.deleteAccount(account.id);
      fetchAccounts();
      setMessage({ type: 'success', text: 'Binance account deleted successfully' });
    } catch (error) {
      console.error('Failed to delete account:', error);
      setMessage({ type: 'error', text: 'Failed to delete Binance account' });
    } finally {
      setDeletingAccount(null);
    }
  };

  const resetForm = () => {
    setFormData({
  Status: 1,
  internalAccountId: 0,
  Email: '',
  Name: '',
  BinanceId: '',
  Description: '',
  ApiKey: '',
  SecretKey: ''
});
  }

  const getStatusBadgeColor = (status: number) => {
    return status === 1 
      ? 'bg-success-500/10 text-success-500' 
      : 'bg-danger-500/10 text-danger-500';
  };

  const getStatusLabel = (status: number) => {
    return status === 1 ? 'Active' : 'Inactive';
  };
 const confirmDelete = () => {
    if (deletingAccount) {
      setAccounts(accounts.filter(account => account.id !== deletingAccount.id));
      setDeletingAccount(null);
      setMessage({ type: 'success', text: 'Binance account deleted successfully' });
    }
  };



  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Binance Accounts</h1>
          <p className="text-dark-400">Manage Binance trading accounts and connections</p>
        </div>
        <button 
          className="btn btn-primary"
          onClick={() => {
            setEditingAccount(null);
            resetForm();
            setIsFormOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Binance Account
        </button>
      </div>

      {/* Global message */}
      {message && (
        <div className={`flex items-center gap-3 p-4 rounded-lg ${
          message.type === 'success' 
            ? 'bg-success-500/10 border border-success-500/20' 
            : 'bg-danger-500/10 border border-danger-500/20'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle className="h-5 w-5 text-success-500 flex-shrink-0" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-danger-500 flex-shrink-0" />
          )}
          <p className={`text-sm ${message.type === 'success' ? 'text-success-500' : 'text-danger-500'}`}>
            {message.text}
          </p>
        </div>
      )}

      {/* Search and filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <Search className="h-4 w-4 text-dark-400" />
          </div>
          <input
            type="text"
            className="form-input pl-10"
            placeholder="Search accounts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex">
          <button className="btn btn-outline inline-flex items-center">
            <Filter className="mr-2 h-4 w-4" />
            Filter
          </button>
        </div>
      </div>

      {/* Accounts table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-dark-700">
              <thead>
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-dark-400">ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-dark-400">Account Info</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-dark-400">Binance ID</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-dark-400">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-dark-400">Description</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-dark-400">Created</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-dark-400">Last Updated</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-dark-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-700">
                {filteredAccounts.map((account) => (
                  <tr key={account.id} className="hover:bg-dark-700/40">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-10 w-10 flex-shrink-0 rounded-full bg-primary-500/10 flex items-center justify-center">
                          <Building2 className="h-5 w-5 text-primary-500" />
                        </div>
                        <div className="ml-3">
                          <div className="text-sm font-medium">#{account.id}</div>
                          <div className="text-xs text-dark-400">Internal: {account.internalAccountId}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium">{account.Name}</div>
                        <div className="text-xs text-dark-400">{account.Email}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {account.BinanceId ? (
                        <span className="inline-flex items-center rounded-full bg-warning-300/10 px-2.5 py-0.5 text-xs font-medium text-warning-300">
                          {account.BinanceId}
                        </span>
                      ) : (
                        <span className="text-xs text-dark-500">Not connected</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusBadgeColor(account.Status)}`}>
                        {account.Status === 1 ? (
                          <CheckCircle className="mr-1 h-3 w-3" />
                        ) : (
                          <XCircle className="mr-1 h-3 w-3" />
                        )}
                        {getStatusLabel(account.Status)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-dark-300 max-w-xs truncate">
                        {account.Description || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-dark-400">
                      <div>
                        <FormattedDate
                          value={account.create_time}
                          day="2-digit"
  month="2-digit"
  year="numeric"
                        />
                      </div>
                      <div className="text-xs">
                        <FormattedTime
                          value={account.create_time}
                          hour="2-digit"
                          minute="2-digit"
                        />
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-dark-400">
                      <div>
                        <FormattedDate
                          value={account.update_time}
                          year="numeric"
                          month="short"
                          day="2-digit"
                        />
                      </div>
                      <div className="text-xs">
                        <FormattedTime
                          value={account.update_time}
                          hour="2-digit"
                          minute="2-digit"
                        />
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      <div className="flex justify-end space-x-2">
                        <button
                          className="text-dark-400 hover:text-primary-500"
                          onClick={() => handleEdit(account)}
                          title="Edit Account"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          className="text-dark-400 hover:text-danger-500"
                          onClick={() => handleDelete(account)}
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

      {/* Form Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-dark-900/80 flex items-center justify-center p-4 z-50">
          <div className="card w-full max-w-2xl">
            <div className="card-header flex justify-between items-center">
              <h2 className="text-lg font-medium">
                {editingAccount ? 'Edit Binance Account' : 'Add New Binance Account'}
              </h2>
              <button
                className="text-dark-400 hover:text-dark-300"
                onClick={() => {
                  setIsFormOpen(false);
                  setEditingAccount(null);
                  resetForm();
                }}
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="name" className="form-label">Account Name *</label>
                  <input
                    type="text"
                    id="name"
                    className="form-input"
                    value={formData.Name}
                    onChange={(e) => setFormData({ ...formData, Name: e.target.value })}
                    required
                    placeholder="e.g., MainTrader"
                  />
                </div>

                <div>
                  <label htmlFor="email" className="form-label">Email *</label>
                  <input
                    type="email"
                    id="email"
                    className="form-input"
                    value={formData.Email}
                    onChange={(e) => setFormData({ ...formData, Email: e.target.value })}
                    required
                    placeholder="trader@example.com"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
  <div>
    <label htmlFor="apiKey" className="form-label">API Key *</label>
    <input
      type="text"
      id="apiKey"
      className="form-input"
      value={formData.ApiKey}
      onChange={(e) => setFormData({ ...formData, ApiKey: e.target.value })}
      required
      placeholder="Nhập Binance API Key"
    />
  </div>

  <div>
    <label htmlFor="secretKey" className="form-label">Secret Key *</label>
    <input
      type="text"
      id="secretKey"
      className="form-input"
      value={formData.SecretKey}
      onChange={(e) => setFormData({ ...formData, SecretKey: e.target.value })}
      required
      placeholder="Nhập Binance Secret Key"
    />
  </div>
</div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="internalAccountId" className="form-label">Internal Account ID</label>
                  <input
                    type="number"
                    id="internalAccountId"
                    className="form-input"
                    value={formData.internalAccountId || ''}
                    onChange={(e) => setFormData({ ...formData, internalAccountId: parseInt(e.target.value) || 0 })}
                    placeholder="Auto-generated if 0"
                  />
                </div>

                <div>
                  <label htmlFor="status" className="form-label">Status</label>
                  <select
                    id="status"
                    className="form-select"
                    value={formData.Status}
                    onChange={(e) => setFormData({ ...formData, Status: Number(e.target.value) })}
                  >
                    <option value={1}>Active</option>
                    <option value={0}>Inactive</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="binanceId" className="form-label">Binance ID</label>
                <input
                  type="text"
                  id="binanceId"
                  className="form-input"
                  value={formData.BinanceId}
                  onChange={(e) => setFormData({ ...formData, BinanceId: e.target.value })}
                  placeholder="BINANCE_123456 (optional)"
                />
                <p className="mt-1 text-xs text-dark-400">
                  Leave empty if not connected to Binance yet
                </p>
              </div>

              <div>
                <label htmlFor="description" className="form-label">Description</label>
                <textarea
                  id="description"
                  className="form-input"
                  value={formData.Description}
                  onChange={(e) => setFormData({ ...formData, Description: e.target.value })}
                  rows={3}
                  placeholder="Account description or notes..."
                />
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => {
                    setIsFormOpen(false);
                    setEditingAccount(null);
                    resetForm();
                  }}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  {editingAccount ? 'Update' : 'Create'} Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingAccount && (
        <div className="fixed inset-0 bg-dark-900/80 flex items-center justify-center p-4 z-50">
          <div className="card w-full max-w-md">
            <div className="p-6">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-danger-500/10 mx-auto mb-4">
                <AlertTriangle className="h-6 w-6 text-danger-500" />
              </div>
              
              <h3 className="text-lg font-medium text-center mb-2">Delete Binance Account</h3>
              
              <p className="text-dark-400 text-center mb-6">
                Are you sure you want to delete the account "{deletingAccount.Name}"? This action cannot be undone.
              </p>

              <div className="flex justify-center space-x-3">
                <button
                  className="btn btn-outline"
                  onClick={() => setDeletingAccount(null)}
                >
                  Cancel
                </button>
                <button
                  className="btn bg-danger-500 hover:bg-danger-600 text-white"
                  onClick={confirmDelete}
                >
                  Delete Account
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="card p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary-500/10">
                <Building2 className="h-4 w-4 text-primary-500" />
              </div>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-dark-400">Total Accounts</p>
              <p className="text-lg font-semibold">{accounts.length}</p>
            </div>
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-success-500/10">
                <CheckCircle className="h-4 w-4 text-success-500" />
              </div>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-dark-400">Active</p>
              <p className="text-lg font-semibold">{accounts.filter(a => a.Status === 1).length}</p>
            </div>
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-warning-300/10">
                <Building2 className="h-4 w-4 text-warning-300" />
              </div>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-dark-400">Connected</p>
              <p className="text-lg font-semibold">{accounts.filter(a => a.BinanceId).length}</p>
            </div>
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-danger-500/10">
                <XCircle className="h-4 w-4 text-danger-500" />
              </div>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-dark-400">Inactive</p>
              <p className="text-lg font-semibold">{accounts.filter(a => a.Status === 0).length}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
