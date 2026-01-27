import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { riskConfigApi } from '../../utils/api';
import {
  Shield,
  Plus,
  Search,
  Filter,
  Edit,
  Trash2,
  Eye,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Clock,
  Target,
  ChevronLeft,
  ChevronRight,
  X,
  Save,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';

// ==================== TYPES ====================
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
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

interface RiskConfigStats {
  total: number;
  active: number;
  inactive: number;
}

// ==================== DEFAULT VALUES ====================
const defaultRiskConfig: Omit<RiskConfig, 'id' | 'createdAt' | 'updatedAt'> = {
  name: '',
  description: '',
  maxOpenPositions: 10,
  maxPositionSizePercent: '5.00',
  existingPositionSize: '3.00',
  dailyLossLimit: '10.00',
  maxDrawdownPercent: '25.00',
  leverageLimit: 20,
  tradingHours: {
    enabled: false,
    timezone: 'Asia/Ho_Chi_Minh',
    allowedHours: { start: '00:00', end: '23:59' },
    allowWeekends: true,
  },
  stopLossConfig: {
    enabled: true,
    type: 'PERCENTAGE',
    value: 2,
    orderType: 'STOP_MARKET',
  },
  takeProfitConfig: {
    enabled: true,
    type: 'PERCENTAGE',
    value: 3,
  },
  isActive: true,
  isDefault: false,
};

// ==================== COMPONENT ====================
export default function RiskConfigManagement() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'superadmin';
  const canEdit = user?.role === 'superadmin' || user?.role === 'admin';

  // State
  const [configs, setConfigs] = useState<RiskConfig[]>([]);
  const [stats, setStats] = useState<RiskConfigStats>({ total: 0, active: 0, inactive: 0 });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'view'>('create');
  const [selectedConfig, setSelectedConfig] = useState<RiskConfig | null>(null);
  const [formData, setFormData] = useState<Omit<RiskConfig, 'id' | 'createdAt' | 'updatedAt'>>(defaultRiskConfig);
  const [saving, setSaving] = useState(false);

  // Delete Modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [configToDelete, setConfigToDelete] = useState<RiskConfig | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ==================== FETCH DATA ====================
  useEffect(() => {
    fetchConfigs();
  }, []);

  const fetchConfigs = async () => {
  try {
    setLoading(true);
    const response = await riskConfigApi.getAllRiskConfigs();
    
    console.log('🔍 Full API Response:', response);
    
    // Fix: Data.data chứa array
    let data: RiskConfig[] = [];
    const responseData = response.Data || response.data;
    
    if (responseData) {
      if (Array.isArray(responseData)) {
        data = responseData;
      } else if (Array.isArray(responseData.data)) {
        // 👈 Thêm case này!
        data = responseData.data;
      } else if (Array.isArray(responseData.configs)) {
        data = responseData.configs;
      } else if (Array.isArray(responseData.items)) {
        data = responseData.items;
      }
    }
    
    console.log('📊 Parsed configs:', data);
    
    setConfigs(data);
    
    const activeCount = data.filter((c: RiskConfig) => c?.isActive).length;
    setStats({
      total: data.length,
      active: activeCount,
      inactive: data.length - activeCount,
    });
  } catch (error) {
    console.error('❌ Error fetching risk configs:', error);
    setConfigs([]);
    setStats({ total: 0, active: 0, inactive: 0 });
  } finally {
    setLoading(false);
  }
};

  // ==================== FILTER & PAGINATION ====================
  const filteredConfigs = configs.filter((config) => {
    if (!config) return false;
    const matchesSearch = (config.name || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && config.isActive) ||
      (statusFilter === 'inactive' && !config.isActive);
    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.ceil(filteredConfigs.length / itemsPerPage);
  const paginatedConfigs = filteredConfigs.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // ==================== HANDLERS ====================
  const handleCreate = () => {
    setModalMode('create');
    setSelectedConfig(null);
    setFormData(defaultRiskConfig);
    setShowModal(true);
  };

  const handleEdit = (config: RiskConfig) => {
    setModalMode('edit');
    setSelectedConfig(config);
    setFormData({
      name: config.name || '',
      description: config.description || '',
      maxOpenPositions: config.maxOpenPositions || 10,
      maxPositionSizePercent: config.maxPositionSizePercent || '5.00',
      existingPositionSize: config.existingPositionSize || '3.00',
      dailyLossLimit: config.dailyLossLimit || '10.00',
      maxDrawdownPercent: config.maxDrawdownPercent || '25.00',
      leverageLimit: config.leverageLimit || 20,
      tradingHours: config.tradingHours || defaultRiskConfig.tradingHours,
      stopLossConfig: config.stopLossConfig || defaultRiskConfig.stopLossConfig,
      takeProfitConfig: config.takeProfitConfig || defaultRiskConfig.takeProfitConfig,
      isActive: config.isActive ?? true,
      isDefault: config.isDefault ?? false,
    });
    setShowModal(true);
  };

  const handleView = (config: RiskConfig) => {
    setModalMode('view');
    setSelectedConfig(config);
    setFormData({
      name: config.name || '',
      description: config.description || '',
      maxOpenPositions: config.maxOpenPositions || 10,
      maxPositionSizePercent: config.maxPositionSizePercent || '5.00',
      existingPositionSize: config.existingPositionSize || '3.00',
      dailyLossLimit: config.dailyLossLimit || '10.00',
      maxDrawdownPercent: config.maxDrawdownPercent || '25.00',
      leverageLimit: config.leverageLimit || 20,
      tradingHours: config.tradingHours || defaultRiskConfig.tradingHours,
      stopLossConfig: config.stopLossConfig || defaultRiskConfig.stopLossConfig,
      takeProfitConfig: config.takeProfitConfig || defaultRiskConfig.takeProfitConfig,
      isActive: config.isActive ?? true,
      isDefault: config.isDefault ?? false,
    });
    setShowModal(true);
  };

  const handleDelete = (config: RiskConfig) => {
    setConfigToDelete(config);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!configToDelete) return;
    try {
      setDeleting(true);
      await riskConfigApi.deleteRiskConfig(configToDelete.id);
      await fetchConfigs();
      setShowDeleteModal(false);
      setConfigToDelete(null);
    } catch (error) {
      console.error('Error deleting config:', error);
    } finally {
      setDeleting(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      if (modalMode === 'create') {
        await riskConfigApi.createRiskConfig(formData);
      } else if (modalMode === 'edit' && selectedConfig) {
        await riskConfigApi.updateRiskConfig(selectedConfig.id, formData);
      }
      await fetchConfigs();
      setShowModal(false);
    } catch (error) {
      console.error('Error saving config:', error);
    } finally {
      setSaving(false);
    }
  };

  // ==================== RENDER ====================
  return (
    <div className="min-h-screen bg-[#1e293b] text-white p-6">
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Shield className="w-7 h-7 text-yellow-500" />
            Risk Config Management
          </h1>
          <p className="text-gray-400 mt-1">
            Quản lý các preset cấu hình rủi ro cho TP/SL
          </p>
        </div>
        <button
          onClick={handleCreate}
          className="flex items-center gap-2 bg-blue-500 hover:bg-[#d4a50a] text-black font-semibold px-4 py-2.5 rounded-lg transition-colors"
        >
          <Plus className="w-5 h-5" />
          Tạo Risk Config
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-[#1e293b] border border-[#334155] rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/20 rounded-lg">
              <Shield className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-gray-400 text-sm">Total Configs</p>
              <p className="text-2xl font-bold">{stats.total}</p>
            </div>
          </div>
        </div>

        <div className="bg-[#1e293b] border border-[#334155] rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-green-500/20 rounded-lg">
              <TrendingUp className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-gray-400 text-sm">Active</p>
              <p className="text-2xl font-bold text-green-400">{stats.active}</p>
            </div>
          </div>
        </div>

        <div className="bg-[#1e293b] border border-[#334155] rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gray-500/20 rounded-lg">
              <TrendingDown className="w-5 h-5 text-gray-400" />
            </div>
            <div>
              <p className="text-gray-400 text-sm">Inactive</p>
              <p className="text-2xl font-bold text-gray-400">{stats.inactive}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          <input
            type="text"
            placeholder="Tìm kiếm risk config..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#1e293b] border border-[#334155] rounded-lg pl-10 pr-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-[#f0b90b]"
          />
        </div>

        <div className="flex gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="bg-[#1e293b] border border-[#334155] rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-[#f0b90b] cursor-pointer"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>

          <button className="flex items-center gap-2 bg-[#1e293b] border border-[#334155] rounded-lg px-4 py-2.5 hover:border-[#f0b90b] transition-colors">
            <Filter className="w-4 h-4" />
            Filter
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#1e293b] border border-[#334155] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#334155]">
                <th className="text-left py-4 px-4 text-gray-400 font-medium">Tên Config</th>
                <th className="text-left py-4 px-4 text-gray-400 font-medium">Leverage</th>
                <th className="text-left py-4 px-4 text-gray-400 font-medium">Max Positions</th>
                <th className="text-left py-4 px-4 text-gray-400 font-medium">Stop Loss %</th>
                <th className="text-left py-4 px-4 text-gray-400 font-medium">Take Profit %</th>
                <th className="text-left py-4 px-4 text-gray-400 font-medium">Daily Loss Limit</th>
                <th className="text-center py-4 px-4 text-gray-400 font-medium">Status</th>
                <th className="text-center py-4 px-4 text-gray-400 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-12">
                    <div className="flex items-center justify-center gap-2 text-gray-400">
                      <div className="w-5 h-5 border-2 border-[#f0b90b] border-t-transparent rounded-full animate-spin" />
                      Đang tải...
                    </div>
                  </td>
                </tr>
              ) : paginatedConfigs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-gray-400">
                    <div className="flex flex-col items-center gap-3">
                      <Shield className="w-12 h-12 text-gray-600" />
                      <p>Không tìm thấy risk config nào</p>
                      <button
                        onClick={handleCreate}
                        className="text-[#f0b90b] hover:underline text-sm"
                      >
                        + Tạo config đầu tiên
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedConfigs.map((config) => (
                  <tr
                    key={config.id}
                    className="border-b border-[#334155] hover:bg-[#334155]/30 transition-colors"
                  >
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-[#f0b90b]/20 rounded-lg">
                          <Shield className="w-4 h-4 text-[#f0b90b]" />
                        </div>
                        <div>
                          <p className="font-medium">{config.name}</p>
                          {config.isDefault && (
                            <span className="text-xs text-[#f0b90b]">Default</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <span className="text-yellow-400 font-medium">x{config.leverageLimit}</span>
                    </td>
                    <td className="py-4 px-4">{config.maxOpenPositions}</td>
                    <td className="py-4 px-4">
                      {config.stopLossConfig?.enabled ? (
                        <span className="text-red-400">{config.stopLossConfig.value}%</span>
                      ) : (
                        <span className="text-gray-500">—</span>
                      )}
                    </td>
                    <td className="py-4 px-4">
                      {config.takeProfitConfig?.enabled ? (
                        <span className="text-green-400">{config.takeProfitConfig.value}%</span>
                      ) : (
                        <span className="text-gray-500">—</span>
                      )}
                    </td>
                    <td className="py-4 px-4">
                      <span className="text-orange-400">{config.dailyLossLimit}%</span>
                    </td>
                    <td className="py-4 px-4 text-center">
                      {config.isActive ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-500/20 text-green-400 rounded-full text-xs font-medium">
                          <span className="w-1.5 h-1.5 bg-green-400 rounded-full" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-500/20 text-gray-400 rounded-full text-xs font-medium">
                          <span className="w-1.5 h-1.5 bg-gray-400 rounded-full" />
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleView(config)}
                          className="p-2 hover:bg-[#334155] rounded-lg transition-colors text-gray-400 hover:text-white"
                          title="Xem chi tiết"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleEdit(config)}
                          className="p-2 hover:bg-[#334155] rounded-lg transition-colors text-gray-400 hover:text-[#f0b90b]"
                          title="Chỉnh sửa"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        {canEdit && (
                          <button
                            onClick={() => handleDelete(config)}
                            className="p-2 hover:bg-red-500/20 rounded-lg transition-colors text-gray-400 hover:text-red-400"
                            title="Xóa"
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
          <div className="flex items-center justify-between px-4 py-3 border-t border-[#334155]">
            <p className="text-sm text-gray-400">
              Showing page {currentPage} of {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-2 hover:bg-[#334155] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`w-8 h-8 rounded-lg transition-colors ${
                    currentPage === page
                      ? 'bg-[#f0b90b] text-black font-medium'
                      : 'hover:bg-[#334155]'
                  }`}
                >
                  {page}
                </button>
              ))}
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-2 hover:bg-[#334155] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1e293b] border border-[#334155] rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-[#334155]">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Shield className="w-5 h-5 text-[#f0b90b]" />
                {modalMode === 'create' && 'Tạo Risk Config mới'}
                {modalMode === 'edit' && 'Chỉnh sửa Risk Config'}
                {modalMode === 'view' && 'Chi tiết Risk Config'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-[#334155] rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto max-h-[calc(90vh-140px)]">
              <div className="space-y-6">
                {/* Basic Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Tên Config *</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      disabled={modalMode === 'view'}
                      placeholder="VD: Conservative Strategy"
                      className="w-full bg-[#1e293b] border border-[#334155] rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-[#f0b90b] disabled:opacity-60"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Mô tả</label>
                    <input
                      type="text"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      disabled={modalMode === 'view'}
                      placeholder="Mô tả ngắn về config"
                      className="w-full bg-[#1e293b] border border-[#334155] rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-[#f0b90b] disabled:opacity-60"
                    />
                  </div>
                </div>

                {/* Position Limits */}
                <div className="bg-[#1e293b] rounded-xl p-4 border border-[#334155]">
                  <h3 className="text-sm font-medium text-gray-300 mb-4 flex items-center gap-2">
                    <Target className="w-4 h-4 text-blue-400" />
                    Giới hạn Position
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1.5">Leverage tối đa</label>
                      <input
                        type="number"
                        value={formData.leverageLimit}
                        onChange={(e) =>
                          setFormData({ ...formData, leverageLimit: parseInt(e.target.value) || 1 })
                        }
                        disabled={modalMode === 'view'}
                        min={1}
                        max={125}
                        className="w-full bg-[#1e293b] border border-[#334155] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#f0b90b] disabled:opacity-60"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1.5">Max Open Positions</label>
                      <input
                        type="number"
                        value={formData.maxOpenPositions}
                        onChange={(e) =>
                          setFormData({ ...formData, maxOpenPositions: parseInt(e.target.value) || 1 })
                        }
                        disabled={modalMode === 'view'}
                        min={1}
                        className="w-full bg-[#1e293b] border border-[#334155] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#f0b90b] disabled:opacity-60"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1.5">Max Position Size %</label>
                      <input
                        type="text"
                        value={formData.maxPositionSizePercent}
                        onChange={(e) =>
                          setFormData({ ...formData, maxPositionSizePercent: e.target.value })
                        }
                        disabled={modalMode === 'view'}
                        className="w-full bg-[#1e293b] border border-[#334155] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#f0b90b] disabled:opacity-60"
                      />
                    </div>
                  </div>
                </div>

                {/* Risk Limits */}
                <div className="bg-[#1e293b] rounded-xl p-4 border border-[#334155]">
                  <h3 className="text-sm font-medium text-gray-300 mb-4 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-orange-400" />
                    Giới hạn Rủi ro
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1.5">Daily Loss Limit %</label>
                      <input
                        type="text"
                        value={formData.dailyLossLimit}
                        onChange={(e) => setFormData({ ...formData, dailyLossLimit: e.target.value })}
                        disabled={modalMode === 'view'}
                        className="w-full bg-[#1e293b] border border-[#334155] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#f0b90b] disabled:opacity-60"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1.5">Max Drawdown %</label>
                      <input
                        type="text"
                        value={formData.maxDrawdownPercent}
                        onChange={(e) =>
                          setFormData({ ...formData, maxDrawdownPercent: e.target.value })
                        }
                        disabled={modalMode === 'view'}
                        className="w-full bg-[#1e293b] border border-[#334155] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#f0b90b] disabled:opacity-60"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1.5">Existing Position Size %</label>
                      <input
                        type="text"
                        value={formData.existingPositionSize}
                        onChange={(e) =>
                          setFormData({ ...formData, existingPositionSize: e.target.value })
                        }
                        disabled={modalMode === 'view'}
                        className="w-full bg-[#1e293b] border border-[#334155] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#f0b90b] disabled:opacity-60"
                      />
                    </div>
                  </div>
                </div>

                {/* Stop Loss Config */}
                <div className="bg-[#1e293b] rounded-xl p-4 border border-[#334155]">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-medium text-gray-300 flex items-center gap-2">
                      <TrendingDown className="w-4 h-4 text-red-400" />
                      Stop Loss Config
                    </h3>
                    <button
                      onClick={() =>
                        modalMode !== 'view' &&
                        setFormData({
                          ...formData,
                          stopLossConfig: {
                            ...formData.stopLossConfig,
                            enabled: !formData.stopLossConfig.enabled,
                          },
                        })
                      }
                      disabled={modalMode === 'view'}
                      className="text-gray-400 hover:text-white disabled:cursor-not-allowed"
                    >
                      {formData.stopLossConfig.enabled ? (
                        <ToggleRight className="w-8 h-8 text-green-400" />
                      ) : (
                        <ToggleLeft className="w-8 h-8" />
                      )}
                    </button>
                  </div>
                  {formData.stopLossConfig.enabled && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1.5">Type</label>
                        <select
                          value={formData.stopLossConfig.type}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              stopLossConfig: {
                                ...formData.stopLossConfig,
                                type: e.target.value as 'PERCENTAGE' | 'FIXED',
                              },
                            })
                          }
                          disabled={modalMode === 'view'}
                          className="w-full bg-[#1e293b] border border-[#334155] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#f0b90b] disabled:opacity-60"
                        >
                          <option value="PERCENTAGE">Percentage</option>
                          <option value="FIXED">Fixed</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1.5">Value</label>
                        <input
                          type="number"
                          value={formData.stopLossConfig.value}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              stopLossConfig: {
                                ...formData.stopLossConfig,
                                value: parseFloat(e.target.value) || 0,
                              },
                            })
                          }
                          disabled={modalMode === 'view'}
                          className="w-full bg-[#1e293b] border border-[#334155] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#f0b90b] disabled:opacity-60"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1.5">Order Type</label>
                        <select
                          value={formData.stopLossConfig.orderType}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              stopLossConfig: {
                                ...formData.stopLossConfig,
                                orderType: e.target.value as 'STOP_MARKET' | 'STOP_LIMIT',
                              },
                            })
                          }
                          disabled={modalMode === 'view'}
                          className="w-full bg-[#1e293b] border border-[#334155] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#f0b90b] disabled:opacity-60"
                        >
                          <option value="STOP_MARKET">Stop Market</option>
                          <option value="STOP_LIMIT">Stop Limit</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                {/* Take Profit Config */}
                <div className="bg-[#1e293b] rounded-xl p-4 border border-[#334155]">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-medium text-gray-300 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-green-400" />
                      Take Profit Config
                    </h3>
                    <button
                      onClick={() =>
                        modalMode !== 'view' &&
                        setFormData({
                          ...formData,
                          takeProfitConfig: {
                            ...formData.takeProfitConfig,
                            enabled: !formData.takeProfitConfig.enabled,
                          },
                        })
                      }
                      disabled={modalMode === 'view'}
                      className="text-gray-400 hover:text-white disabled:cursor-not-allowed"
                    >
                      {formData.takeProfitConfig.enabled ? (
                        <ToggleRight className="w-8 h-8 text-green-400" />
                      ) : (
                        <ToggleLeft className="w-8 h-8" />
                      )}
                    </button>
                  </div>
                  {formData.takeProfitConfig.enabled && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1.5">Type</label>
                        <select
                          value={formData.takeProfitConfig.type}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              takeProfitConfig: {
                                ...formData.takeProfitConfig,
                                type: e.target.value as 'PERCENTAGE' | 'FIXED',
                              },
                            })
                          }
                          disabled={modalMode === 'view'}
                          className="w-full bg-[#1e293b] border border-[#334155] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#f0b90b] disabled:opacity-60"
                        >
                          <option value="PERCENTAGE">Percentage</option>
                          <option value="FIXED">Fixed</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1.5">Value</label>
                        <input
                          type="number"
                          value={formData.takeProfitConfig.value}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              takeProfitConfig: {
                                ...formData.takeProfitConfig,
                                value: parseFloat(e.target.value) || 0,
                              },
                            })
                          }
                          disabled={modalMode === 'view'}
                          className="w-full bg-[#1e293b] border border-[#334155] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#f0b90b] disabled:opacity-60"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Trading Hours */}
                <div className="bg-[#1e293b] rounded-xl p-4 border border-[#334155]">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-medium text-gray-300 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-purple-400" />
                      Trading Hours
                    </h3>
                    <button
                      onClick={() =>
                        modalMode !== 'view' &&
                        setFormData({
                          ...formData,
                          tradingHours: {
                            ...formData.tradingHours,
                            enabled: !formData.tradingHours.enabled,
                          },
                        })
                      }
                      disabled={modalMode === 'view'}
                      className="text-gray-400 hover:text-white disabled:cursor-not-allowed"
                    >
                      {formData.tradingHours.enabled ? (
                        <ToggleRight className="w-8 h-8 text-green-400" />
                      ) : (
                        <ToggleLeft className="w-8 h-8" />
                      )}
                    </button>
                  </div>
                  {formData.tradingHours.enabled && (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1.5">Timezone</label>
                        <select
                          value={formData.tradingHours.timezone}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              tradingHours: { ...formData.tradingHours, timezone: e.target.value },
                            })
                          }
                          disabled={modalMode === 'view'}
                          className="w-full bg-[#1e293b] border border-[#334155] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#f0b90b] disabled:opacity-60"
                        >
                          <option value="Asia/Ho_Chi_Minh">Asia/Ho_Chi_Minh (UTC+7)</option>
                          <option value="UTC">UTC</option>
                          <option value="America/New_York">America/New_York</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1.5">Start Time</label>
                        <input
                          type="time"
                          value={formData.tradingHours.allowedHours.start}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              tradingHours: {
                                ...formData.tradingHours,
                                allowedHours: {
                                  ...formData.tradingHours.allowedHours,
                                  start: e.target.value,
                                },
                              },
                            })
                          }
                          disabled={modalMode === 'view'}
                          className="w-full bg-[#1e293b] border border-[#334155] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#f0b90b] disabled:opacity-60"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1.5">End Time</label>
                        <input
                          type="time"
                          value={formData.tradingHours.allowedHours.end}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              tradingHours: {
                                ...formData.tradingHours,
                                allowedHours: {
                                  ...formData.tradingHours.allowedHours,
                                  end: e.target.value,
                                },
                              },
                            })
                          }
                          disabled={modalMode === 'view'}
                          className="w-full bg-[#1e293b] border border-[#334155] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#f0b90b] disabled:opacity-60"
                        />
                      </div>
                      <div className="flex items-end">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.tradingHours.allowWeekends}
                            onChange={(e) =>
                              modalMode !== 'view' &&
                              setFormData({
                                ...formData,
                                tradingHours: {
                                  ...formData.tradingHours,
                                  allowWeekends: e.target.checked,
                                },
                              })
                            }
                            disabled={modalMode === 'view'}
                            className="w-4 h-4 rounded border-[#334155] bg-[#1e293b] text-[#f0b90b] focus:ring-[#f0b90b]"
                          />
                          <span className="text-sm text-gray-400">Allow Weekends</span>
                        </label>
                      </div>
                    </div>
                  )}
                </div>

                {/* Status Toggles */}
                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) =>
                        modalMode !== 'view' && setFormData({ ...formData, isActive: e.target.checked })
                      }
                      disabled={modalMode === 'view'}
                      className="w-4 h-4 rounded border-[#334155] bg-[#1e293b] text-[#f0b90b] focus:ring-[#f0b90b]"
                    />
                    <span className="text-sm text-gray-300">Active</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isDefault}
                      onChange={(e) =>
                        modalMode !== 'view' && setFormData({ ...formData, isDefault: e.target.checked })
                      }
                      disabled={modalMode === 'view'}
                      className="w-4 h-4 rounded border-[#334155] bg-[#1e293b] text-[#f0b90b] focus:ring-[#f0b90b]"
                    />
                    <span className="text-sm text-gray-300">Set as Default</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            {modalMode !== 'view' && (
              <div className="flex items-center justify-end gap-3 p-5 border-t border-[#334155]">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-5 py-2.5 text-gray-400 hover:text-white transition-colors"
                >
                  Hủy
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !formData.name.trim()}
                  className="flex items-center gap-2 bg-[#f0b90b] hover:bg-[#d4a50a] text-black font-semibold px-5 py-2.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? (
                    <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  {modalMode === 'create' ? 'Tạo mới' : 'Lưu thay đổi'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && configToDelete && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1e293b] border border-[#334155] rounded-2xl w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-red-500/20 rounded-full">
                <AlertTriangle className="w-6 h-6 text-red-400" />
              </div>
              <h3 className="text-lg font-bold">Xác nhận xóa</h3>
            </div>
            <p className="text-gray-400 mb-6">
              Bạn có chắc chắn muốn xóa risk config{' '}
              <span className="text-white font-medium">"{configToDelete.name}"</span>? Hành động
              này không thể hoàn tác.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setConfigToDelete(null);
                }}
                className="px-5 py-2.5 text-gray-400 hover:text-white transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white font-semibold px-5 py-2.5 rounded-lg transition-colors disabled:opacity-50"
              >
                {deleting ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                Xóa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}