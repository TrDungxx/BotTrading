import React, { useState, useEffect } from 'react';
import { Plus, Search, Filter, Edit, Trash2, Save, XCircle, AlertTriangle, CheckCircle, Building2, Shield, Eye } from 'lucide-react';
import { FormattedDate, FormattedTime } from 'react-intl';
import { binanceAccountApi, riskConfigApi } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import RiskConfigModal from '../../components/tabposition/dropdownfilter/RiskConfigModal';

// ==================== INTERFACES ====================
interface TradingHours {
  enabled: boolean;
  timezone: string;
  allowedHours: {
    start: string;
    end: string;
  };
  allowWeekends: boolean;
}

interface StopLossConfig {
  enabled: boolean;
  type: 'PERCENTAGE' | 'FIXED';
  value: number;
  orderType: 'STOP_MARKET' | 'STOP_LIMIT';
}

interface TakeProfitConfig {
  enabled: boolean;
  type: 'PERCENTAGE' | 'FIXED';
  value: number;
}

interface RiskConfig {
  id: number;
  name: string;
  description?: string;
  maxOpenPositions: number;
  maxPositionSizePercent: string;
  existingPositionSize: string;
  dailyLossLimit: string;
  maxDrawdownPercent: string;
  leverageLimit: number;
  tradingHours: TradingHours;
  stopLossConfig: StopLossConfig;
  takeProfitConfig: TakeProfitConfig;
  isActive: boolean;
  isDefault: boolean;
}

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
  RiskId?: number; // ✅ Field từ backend là RiskId, không phải risk_id
  riskConfigName?: string;
  isCustomRisk?: boolean;
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

// ==================== COMPONENT ====================
export default function BinanceAccounts() {
  const { user } = useAuth();
  const canEditRisk = user?.role === 'admin' || user?.role === 'superadmin';
  
  // Account States
  const [accounts, setAccounts] = useState<BinanceAccount[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<BinanceAccount | null>(null);
  const [deletingAccount, setDeletingAccount] = useState<BinanceAccount | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [showUpdateConfirm, setShowUpdateConfirm] = useState(false);
  const [hasUserChangedApiKey, setHasUserChangedApiKey] = useState(false);
  const [hasUserChangedSecretKey, setHasUserChangedSecretKey] = useState(false);
  const [selectedAccountStatus, setSelectedAccountStatus] = useState<'all' | 1 | 0>('all');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Risk Config States
  const [availableRiskConfigs, setAvailableRiskConfigs] = useState<RiskConfig[]>([]);
  const [selectedRiskConfigId, setSelectedRiskConfigId] = useState<number | null>(null);
  const [loadingRiskConfigs, setLoadingRiskConfigs] = useState(false);

  // Risk Config Modal States (để xem chi tiết)
  const [showRiskConfigModal, setShowRiskConfigModal] = useState(false);
  const [viewingRiskConfigAccount, setViewingRiskConfigAccount] = useState<BinanceAccount | null>(null);

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

  // ==================== FETCH DATA ====================
  useEffect(() => {
    fetchAccounts();
    fetchAvailableRiskConfigs();
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [page]);

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const getAccounts = (params: { page: number; limit: number }) => {
    if (user?.role === 'admin' || user?.role === 'superadmin') {
      return binanceAccountApi.getListAccounts(params);
    } else {
      return binanceAccountApi.getMyAccounts(params);
    }
  };

  const fetchAccounts = async () => {
    setIsLoading(true);
    try {
      const response = await getAccounts({ page, limit });
      const raw = response?.Data?.accounts || [];
      
      console.log('📦 Raw accounts:', raw);
      
      // Fetch risk config names for each account
      const accountsWithRiskInfo = await Promise.all(
        raw.map(async (account: BinanceAccount) => {
          if (account.RiskId) { // ✅ Đổi risk_id thành RiskId
            try {
              const riskResponse = await riskConfigApi.getRiskConfigById(account.RiskId);
              console.log(`🔍 Risk response for account ${account.id}:`, riskResponse);
              
              // Parse response - có thể là Data.data hoặc Data hoặc data
              let riskData = null;
              if (riskResponse?.Data?.data) {
                riskData = riskResponse.Data.data;
              } else if (riskResponse?.Data) {
                riskData = riskResponse.Data;
              } else if (riskResponse?.data) {
                riskData = riskResponse.data;
              }
              
              console.log(`✅ Parsed risk data:`, riskData);
              
              return {
                ...account,
                riskConfigName: riskData?.name || `Risk #${account.RiskId}`,
                isCustomRisk: riskData?.name?.toLowerCase().includes('custom') || false
              };
            } catch (error) {
              console.error(`❌ Failed to fetch risk config for account ${account.id}:`, error);
              return { ...account, riskConfigName: `Risk #${account.RiskId}` };
            }
          }
          return { ...account, riskConfigName: 'No Risk Config' };
        })
      );

      setAccounts(accountsWithRiskInfo);

      const pagination = response?.Data?.pagination;
      if (pagination?.totalPages) {
        setTotalPages(pagination.totalPages);
      } else {
        setTotalPages(Math.ceil(raw.length / limit));
      }
    } catch (error) {
      console.error('Failed to fetch Binance accounts:', error);
      setMessage({ type: 'error', text: 'Lỗi khi tải danh sách tài khoản Binance' });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAvailableRiskConfigs = async () => {
    setLoadingRiskConfigs(true);
    try {
      const response = await riskConfigApi.getAllRiskConfigs();
      const data = response?.Data?.data || response?.Data || response?.data?.data || [];
      const activeConfigs = Array.isArray(data) ? data.filter((c: RiskConfig) => c.isActive) : [];
      setAvailableRiskConfigs(activeConfigs);
    } catch (error) {
      console.error('Failed to fetch risk configs:', error);
    } finally {
      setLoadingRiskConfigs(false);
    }
  };

  // ==================== RISK CONFIG HANDLERS ====================
  // (Không cần custom mode - chỉ dùng dropdown)

  // ==================== ACCOUNT HANDLERS ====================
  const handleAccountStatusCardClick = (status: 'all' | 1 | 0) => {
    setSelectedAccountStatus(status);
  };

  const resetForm = () => {
    setFormData({
      Name: '',
      Email: '',
      ApiKey: '',
      SecretKey: '',
      Status: 1,
      internalAccountId: user?.internalAccountId || 1,
      BinanceId: '',
      Description: ''
    });
    setHasUserChangedApiKey(false);
    setHasUserChangedSecretKey(false);
    setSelectedRiskConfigId(null);
  };

  const handleEditAccount = (account: BinanceAccount) => {
    setEditingAccount(account);
    setFormData({
      Name: account.Name,
      Email: account.Email,
      ApiKey: '********',
      SecretKey: '********',
      Status: account.Status,
      internalAccountId: account.internalAccountId,
      BinanceId: account.BinanceId || '',
      Description: account.Description || ''
    });
    setSelectedRiskConfigId(account.RiskId || null); // ✅ Đổi risk_id thành RiskId
    setHasUserChangedApiKey(false);
    setHasUserChangedSecretKey(false);
    setIsFormOpen(true);
  };

  const handleDeleteAccount = (account: BinanceAccount) => {
    setDeletingAccount(account);
  };

  const confirmDelete = async () => {
    if (!deletingAccount) return;

    try {
      if (user?.role === 'user') {
        await binanceAccountApi.deleteMyAccount(deletingAccount.id);
      } else {
        await binanceAccountApi.deleteAccount(deletingAccount.id);
      }
      fetchAccounts();
      setMessage({ type: 'success', text: 'Xóa tài khoản Binance thành công' });
      setDeletingAccount(null);
    } catch (error) {
      console.error('Failed to delete account:', error);
      setMessage({ type: 'error', text: 'Lỗi khi xóa tài khoản Binance' });
    }
  };

  const handleCreateAccount = async () => {
    const payload = {
      Name: formData.Name?.trim(),
      Email: formData.Email?.trim(),
      ApiKey: formData.ApiKey?.trim(),
      SecretKey: formData.SecretKey?.trim(),
      Status: Number(formData.Status),
      internalAccountId: user?.internalAccountId || 0,
      BinanceId: formData.BinanceId?.trim() || undefined,
      Description: formData.Description?.toString().trim() || undefined,
      RiskId: selectedRiskConfigId || undefined, // ✅ Đổi risk_id thành RiskId
    };

    if (!payload.Name || !payload.Email || !payload.ApiKey || !payload.SecretKey) {
      setMessage({ type: 'error', text: 'Vui lòng nhập đầy đủ các trường bắt buộc' });
      return;
    }

    try {
      if (user?.role === 'admin' || user?.role === 'superadmin') {
        await binanceAccountApi.createAccount(payload);
      } else {
        await binanceAccountApi.createMyAccount(payload);
      }

      fetchAccounts();
      setMessage({ type: 'success', text: 'Tạo tài khoản Binance thành công' });
      setIsFormOpen(false);
      resetForm();
    } catch (error) {
      console.error('Failed to create account:', error);
      setMessage({ type: 'error', text: 'Tạo tài khoản Binance thất bại' });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (editingAccount) {
      setShowUpdateConfirm(true);
    } else {
      handleCreateAccount();
    }
  };

  const handleUpdateAccount = async () => {
    if (!editingAccount?.id) return;
    setIsSaving(true);

    try {
      const payload: any = {
        Name: formData.Name,
        Email: formData.Email,
        Status: Number(formData.Status),
        internalAccountId: Number(formData.internalAccountId),
        BinanceId: formData.BinanceId || null,
        Description: formData.Description || null,
        RiskId: selectedRiskConfigId || null, // ✅ Đổi risk_id thành RiskId
      };

      if (hasUserChangedApiKey && formData.ApiKey && formData.ApiKey !== '********') {
        payload.ApiKey = formData.ApiKey.trim();
      }

      if (hasUserChangedSecretKey && formData.SecretKey && formData.SecretKey !== '********') {
        payload.SecretKey = formData.SecretKey.trim();
      }

      console.log('🚀 Update Account Payload:', payload);
      console.log('📌 Selected RiskConfigId:', selectedRiskConfigId);

      if (user?.role === 'user') {
        await binanceAccountApi.updateMyAccount(editingAccount.id, payload);
      } else {
        await binanceAccountApi.updateAccount(editingAccount.id, payload);
      }

      // Refresh accounts và đợi xong
      await fetchAccounts();
      
      setMessage({ type: 'success', text: 'Cập nhật tài khoản Binance thành công' });
      setIsFormOpen(false);
      setEditingAccount(null);
      resetForm();
    } catch (error) {
      console.error('Failed to update account:', error);
      setMessage({ type: 'error', text: 'Cập nhật tài khoản Binance thất bại' });
    } finally {
      setIsSaving(false);
    }
  };

  // ==================== FILTERS ====================
  const query = searchQuery.trim().toLowerCase();
  const filteredAccounts = accounts
    .filter(account => {
      if (selectedAccountStatus === 'all') return true;
      return account.Status === selectedAccountStatus;
    })
    .filter(account =>
      (account.Name ?? '').toLowerCase().includes(query) ||
      (account.Email ?? '').toLowerCase().includes(query) ||
      (account.BinanceId ?? '').toLowerCase().includes(query) ||
      (account.Description ?? '').toLowerCase().includes(query) ||
      (account.riskConfigName ?? '').toLowerCase().includes(query)
    );

  const activeCount = accounts.filter(a => a.Status === 1).length;
  const inactiveCount = accounts.filter(a => a.Status === 0).length;

  // ==================== RENDER ====================
  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Binance Accounts</h1>
          <p className="text-sm text-gray-400 mt-1">Manage Binance trading accounts and connections</p>
        </div>
        {(user?.role === 'admin' || user?.role === 'superadmin' || user?.role === 'user') && (
          <button
            onClick={() => {
              setEditingAccount(null);
              resetForm();
              setIsFormOpen(true);
            }}
            className="flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Binance Account
          </button>
        )}
      </div>

      {/* Message Toast */}
      {message && (
        <div className={`p-4 rounded-lg ${
          message.type === 'success' ? 'bg-green-500/10 text-green-400 border border-green-500/30' : 'bg-red-500/10 text-red-400 border border-red-500/30'
        }`}>
          <div className="flex items-center gap-2">
            {message.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
            <span>{message.text}</span>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div
          onClick={() => handleAccountStatusCardClick('all')}
          className={`card p-4 cursor-pointer transition-colors ${
            selectedAccountStatus === 'all' ? 'border-primary-500 bg-primary-500/10' : 'hover:border-dark-400'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-dark-400">Total Accounts</p>
              <p className="text-2xl font-bold text-gray-100">{accounts.length}</p>
            </div>
            <Building2 className="w-8 h-8 text-primary-500" />
          </div>
        </div>

        <div
          onClick={() => handleAccountStatusCardClick(1)}
          className={`card p-4 cursor-pointer transition-colors ${
            selectedAccountStatus === 1 ? 'border-green-500 bg-green-500/10' : 'hover:border-dark-400'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-dark-400">Active</p>
              <p className="text-2xl font-bold text-green-400">{activeCount}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-400" />
          </div>
        </div>

        <div
          onClick={() => handleAccountStatusCardClick(0)}
          className={`card p-4 cursor-pointer transition-colors ${
            selectedAccountStatus === 0 ? 'border-red-500 bg-red-500/10' : 'hover:border-dark-400'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-dark-400">Inactive</p>
              <p className="text-2xl font-bold text-red-400">{inactiveCount}</p>
            </div>
            <XCircle className="w-8 h-8 text-red-400" />
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-dark-400" />
          <input
            type="text"
            placeholder="Search by name, email, Binance ID, or risk config..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-dark-800 border border-dark-600 rounded-lg text-gray-100 placeholder-dark-400 focus:outline-none focus:border-primary-500"
          />
        </div>
      </div>

      {/* Accounts Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-dark-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-dark-300 uppercase tracking-wider">ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-dark-300 uppercase tracking-wider">Account Info</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-dark-300 uppercase tracking-wider">Binance ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-dark-300 uppercase tracking-wider">Risk Config</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-dark-300 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-dark-300 uppercase tracking-wider">Created</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-dark-300 uppercase tracking-wider">Last Updated</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-dark-300 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-700">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-dark-400">
                    Loading accounts...
                  </td>
                </tr>
              ) : filteredAccounts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-dark-400">
                    No accounts found
                  </td>
                </tr>
              ) : (
                filteredAccounts.map((account) => (
                  <tr key={account.id} className="hover:bg-dark-700/50 transition-colors">
                    <td className="px-4 py-3 text-sm text-gray-100">#{account.internalAccountId}</td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-gray-100">{account.Name}</p>
                        <p className="text-xs text-dark-400">{account.Email}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {account.BinanceId ? (
                        <span className="text-sm text-yellow-400 font-mono">{account.BinanceId}</span>
                      ) : (
                        <span className="text-xs text-dark-500">Not connected</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {account.riskConfigName && account.riskConfigName !== 'No Risk Config' ? (
                        <div className="flex items-center gap-2">
                          <Shield className="w-4 h-4 text-yellow-400" />
                          <span className="text-sm text-gray-100">{account.riskConfigName}</span>
                          {account.isCustomRisk && (
                            <span className="text-xs px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded">Custom</span>
                          )}
                          {/* View Button */}
                          <button
                            onClick={() => {
                              setViewingRiskConfigAccount(account);
                              setShowRiskConfigModal(true);
                            }}
                            className="p-1 hover:bg-yellow-500/20 rounded transition-colors text-yellow-400 hover:text-yellow-300"
                            title="View Risk Config Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-dark-500">No Risk Config</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                        account.Status === 1
                          ? 'bg-green-500/10 text-green-400'
                          : 'bg-red-500/10 text-red-400'
                      }`}>
                        {account.Status === 1 ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-dark-400">
                      <FormattedDate value={new Date(account.create_time)} />
                    </td>
                    <td className="px-4 py-3 text-sm text-dark-400">
                      <FormattedDate value={new Date(account.update_time)} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleEditAccount(account)}
                          className="p-2 hover:bg-dark-600 rounded-lg transition-colors text-primary-400 hover:text-primary-300"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        {(user?.role === 'admin' || user?.role === 'superadmin') && (
                          <button
                            onClick={() => handleDeleteAccount(account)}
                            className="p-2 hover:bg-red-500/20 rounded-lg transition-colors text-red-400"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-dark-700">
            <p className="text-sm text-dark-400">
              Showing page {page} of {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 bg-dark-700 hover:bg-dark-600 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                const pageNum = i + 1;
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={`px-3 py-1 rounded transition-colors ${
                      page === pageNum
                        ? 'bg-primary-500 text-white'
                        : 'bg-dark-700 hover:bg-dark-600'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1 bg-dark-700 hover:bg-dark-600 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* CREATE/EDIT MODAL - PART 1 */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 border border-dark-600 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-dark-600">
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

            {/* Modal Body */}
            <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-140px)]">
              {/* Basic Account Info */}
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
                    type="password"
                    id="apiKey"
                    className="form-input"
                    value={formData.ApiKey}
                    onChange={(e) => {
                      setFormData({ ...formData, ApiKey: e.target.value });
                      setHasUserChangedApiKey(true);
                    }}
                    placeholder="Enter Binance API Key"
                  />
                </div>

                <div>
                  <label htmlFor="secretKey" className="form-label">Secret Key *</label>
                  <input
                    type="password"
                    id="secretKey"
                    className="form-input"
                    value={formData.SecretKey}
                    onChange={(e) => {
                      setFormData({ ...formData, SecretKey: e.target.value });
                      setHasUserChangedSecretKey(true);
                    }}
                    placeholder="Enter Binance Secret Key"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="internalAccountId" className="form-label">Internal Account ID</label>
                  <input
                    type="number"
                    id="internalAccountId"
                    className="form-input bg-dark-700 cursor-not-allowed"
                    value={formData.internalAccountId || ''}
                    disabled
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

              {/* RISK CONFIGURATION SECTION - Chỉ hiển thị cho Admin/SuperAdmin */}
              {canEditRisk && (
                <div className="bg-dark-700 rounded-xl p-5 border border-dark-600">
                  <div className="flex items-center gap-2 mb-4">
                    <Shield className="w-5 h-5 text-yellow-400" />
                    <h3 className="text-lg font-semibold text-gray-100">Risk Configuration</h3>
                  </div>

                  {/* Dropdown chọn Risk Config */}
                  <div>
                    <label className="form-label">Select Risk Config</label>
                    <select
                      className="form-select"
                      value={selectedRiskConfigId || ''}
                      onChange={(e) => setSelectedRiskConfigId(e.target.value ? Number(e.target.value) : null)}
                    >
                      <option value="">No Risk Config</option>
                      {loadingRiskConfigs ? (
                        <option disabled>Loading...</option>
                      ) : (
                        availableRiskConfigs.map(config => (
                          <option key={config.id} value={config.id}>
                            {config.name} {config.isDefault ? '(Default)' : ''}
                          </option>
                        ))
                      )}
                    </select>
                    {selectedRiskConfigId && (
                      <p className="text-xs text-dark-400 mt-2">
                        Selected risk config will be applied to this account.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Form Actions */}
              <div className="flex justify-end gap-3 pt-4">
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

      {/* DELETE CONFIRMATION MODAL */}
      {deletingAccount && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-dark-800 rounded-lg shadow-lg w-full max-w-md p-6 border border-dark-600">
            <div className="text-center">
              <AlertTriangle className="w-10 h-10 text-red-500 mx-auto mb-4" />
              <h2 className="text-lg font-semibold mb-2">Delete Binance Account</h2>
              <p className="text-dark-400 mb-6">
                Are you sure you want to delete <strong className="text-white">{deletingAccount.Name}</strong>? This action cannot be undone.
              </p>
            </div>

            <div className="flex justify-center gap-4">
              <button className="btn btn-outline" onClick={() => setDeletingAccount(null)}>
                Cancel
              </button>
              <button className="btn bg-red-500 hover:bg-red-600 text-white" onClick={confirmDelete}>
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* UPDATE CONFIRMATION MODAL */}
      {showUpdateConfirm && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="card w-full max-w-md">
            <div className="p-6">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-yellow-500/10 mx-auto mb-4">
                <AlertTriangle className="h-6 w-6 text-yellow-500" />
              </div>
              <h3 className="text-lg font-medium text-center text-white mb-2">Confirm Update</h3>
              <p className="text-dark-400 text-center mb-6">
                Are you sure you want to <span className="text-yellow-300 font-semibold">update</span> this Binance account?
              </p>
              <div className="flex justify-center space-x-3">
                <button
                  className="btn btn-outline"
                  onClick={() => setShowUpdateConfirm(false)}
                >
                  Cancel
                </button>
                <button
                  className="btn bg-primary-500 hover:bg-primary-600 text-white"
                  onClick={() => {
                    setShowUpdateConfirm(false);
                    handleUpdateAccount();
                  }}
                >
                  Confirm Update
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RISK CONFIG MODAL */}
      {showRiskConfigModal && viewingRiskConfigAccount && (
        <RiskConfigModal
          isOpen={showRiskConfigModal}
          onClose={() => {
            setShowRiskConfigModal(false);
            setViewingRiskConfigAccount(null);
          }}
          accountId={viewingRiskConfigAccount.id}
          accountName={viewingRiskConfigAccount.Name}
          accountEmail={viewingRiskConfigAccount.Email}
          riskConfigId={viewingRiskConfigAccount.RiskId} // ✅ Đổi risk_id thành RiskId
        />
      )}
    </div>
  );
}