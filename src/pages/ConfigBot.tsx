import React, { useState, useEffect } from 'react';
import {
  Plus, Search, Filter, Edit, Trash2, Save, XCircle,
  AlertTriangle, CheckCircle, Bot, Play, Pause,
  Settings, TrendingUp, Activity
} from 'lucide-react';
import { FormattedDate, FormattedTime } from 'react-intl';
import { configBotAPI } from '../utils/api';

interface TradingStream {
  id: number;
  InternalAccountId: number;
  BinanceAccountId: number;
  Status: number;
  Type: number;
  StrategyId: number | null;
  indicatorId: number;
  StreamStatus: string;
  TrailingStop: number;
  TrailingStopPercent: number;
  TrailingStopValue: number;
  ATR: number;
  ATRPercent: number | null;
  ATRValue: number | null;
  thresholdPercent: number | null;
  Symbol: string;
  OrderId: string;
  OrderPrice: string;
  StopLost: number;
  TakeProfit: number;
  CapitalUsageRatio: number;
  Description: string;
  TrendStatus: number;
  TrendType: string;
  create_time: string;
  update_time: string;
}

interface TradingStreamForm {
  InternalAccountId: string;
  BinanceAccountId: string;
  Status: number;
  StreamType: number;

  Type: number;
  StrategyId: string;
  indicatorId: string;
  StreamStatus: string;
  TrailingStop: number;
  TrailingStopPercent: string;
  TrailingStopValue: string;
  ATR: number;
  ATRPercent: string;
  ATRValue: string;
  thresholdPercent: string;
  Symbol: string;
  OrderId: string;
  OrderPrice: string;
  StopLost: string;
  TakeProfit: string;
  CapitalUsageRatio: string;
  Description: string;
  TrendStatus: number;
  TrendType: string;
}

export default function ConfigBot() {
  const [streams, setStreams] = useState<TradingStream[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 0 | 1 | 2>('all');
  const [selectedType, setSelectedType] = useState<'all' | 0 | 1 | 2>('all');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingStream, setEditingStream] = useState<TradingStream | null>(null);
  const [deletingStream, setDeletingStream] = useState<TradingStream | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

const SHOW_TYPE = false;
const SHOW_STREAM_STATUS = false;
const SHOW_ORDER_PRICE = false;
const SHOW_TREND = false;


  const [formData, setFormData] = useState<TradingStreamForm>({
    InternalAccountId: '1',
    BinanceAccountId: '1',
    Status: 0,
    Type: 0,
    StrategyId: '',
    indicatorId: '1',
    StreamStatus: 'waiting for setup',
    TrailingStop: 0,
    TrailingStopPercent: '',
    TrailingStopValue: '',
    ATR: 0,
    ATRPercent: '',
    ATRValue: '',
    thresholdPercent: '',
    Symbol: '',
    OrderId: '',
    OrderPrice: '',
    StopLost: '',
    TakeProfit: '',
    CapitalUsageRatio: '',
    Description: '',
    TrendStatus: 0,
    TrendType: 'SIDEWAYS',
    StreamType: 0
  });

  useEffect(() => {
    loadStreams();
  }, []);

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const loadStreams = async () => {
  setIsLoading(true);
  try {
    const res = await configBotAPI.getAllTradingStreams();
    console.log('📥 API raw result:', res);

    const raw = res?.Data?.streams ?? []; // ✅ TRUY CẬP ĐÚNG
    setStreams(raw);
    console.log('✅ Gán streams:', raw);
  } catch (error) {
    console.error('Lỗi khi load streams:', error);
    setMessage({ type: 'error', text: 'Không thể tải danh sách stream' });
  } finally {
    setIsLoading(false);
  }
};



  const confirmDelete = async () => {
  if (!deletingStream) return;
  try {
    await configBotAPI.deleteTradingStream(deletingStream.id);
    setMessage({ type: 'success', text: 'Deleted successfully' });
    await loadStreams();
  } catch (error) {
    console.error('Delete failed:', error);
    setMessage({ type: 'error', text: 'Failed to delete stream' });
  } finally {
    setDeletingStream(null);
  }
};



  const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault(); // ✅ Ngăn reload form

  // ✅ Validate trước khi submit
  const errors = validateForm(formData);
  if (errors.length > 0) {
    setValidationErrors(errors); // hiển thị lỗi trên UI
    return;
  }

  setValidationErrors([]); // xoá lỗi nếu form valid
  setIsSaving(true);

  const payload = {
    InternalAccountId: parseInt(formData.InternalAccountId),
    BinanceAccountId: parseInt(formData.BinanceAccountId),
    Status: formData.Status,
    Type: formData.Type,
    StrategyId: formData.StrategyId ? parseInt(formData.StrategyId) : null,
    indicatorId: parseInt(formData.indicatorId),
    StreamStatus: formData.StreamStatus,
    StreamType: 0,
    TrailingStop: formData.TrailingStop,
    TrailingStopPercent: formData.TrailingStopPercent ? parseFloat(formData.TrailingStopPercent) : null,
    TrailingStopValue: formData.TrailingStopValue ? parseFloat(formData.TrailingStopValue) : null,
    ATR: formData.ATR,
    ATRPercent: formData.ATRPercent ? parseFloat(formData.ATRPercent) : null,
    ATRValue: formData.ATRValue ? parseFloat(formData.ATRValue) : null,
    thresholdPercent: formData.thresholdPercent ? parseFloat(formData.thresholdPercent) : null,
    Symbol: formData.Symbol,
    OrderId: formData.OrderId,
    OrderPrice: parseFloat(formData.OrderPrice),
    StopLost: parseFloat(formData.StopLost),
    TakeProfit: parseFloat(formData.TakeProfit),
    CapitalUsageRatio: parseInt(formData.CapitalUsageRatio),
    Description: formData.Description,
    TrendStatus: formData.TrendStatus,
    TrendType: formData.TrendType
  };

  console.log('📤 Payload gửi đi:', JSON.stringify(payload, null, 2));

  try {
    if (editingStream) {
      await configBotAPI.updateTradingStream(editingStream.id, payload);
      setMessage({ type: 'success', text: 'Updated successfully' });
    } else {
      await configBotAPI.createTradingStream(payload);
      setMessage({ type: 'success', text: 'Created successfully' });
    }

    setIsFormOpen(false);
    setEditingStream(null);
    resetForm();
    await loadStreams();
  } catch (error: any) {
    console.error('❌ Submit failed:', error);
    console.log('📥 Server response:', error.response?.data);

    // ✅ Nếu backend trả về mảng lỗi
    if (error.response?.data?.Errors?.length) {
      setValidationErrors(error.response.data.Errors);
    } else {
      setMessage({ type: 'error', text: 'Failed to save stream' });
    }
  } finally {
    setIsSaving(false);
  }
};

  const validateForm = (form: TradingStreamForm): string[] => {
  const errors: string[] = [];

  if (!form.Symbol) errors.push("Symbol is required");
  if (!form.Description) errors.push("Description is required");
  if (!form.OrderPrice || isNaN(Number(form.OrderPrice))) errors.push("Order Price must be a valid number");
  if (!form.StopLost || isNaN(Number(form.StopLost))) errors.push("Stop Loss must be a number");
  if (!form.TakeProfit || isNaN(Number(form.TakeProfit))) errors.push("Take Profit must be a number");

  if (!form.CapitalUsageRatio || isNaN(Number(form.CapitalUsageRatio))) errors.push("Capital Usage Ratio must be a number");

  if (form.TrailingStop === 1) {
    if (!form.TrailingStopPercent || isNaN(Number(form.TrailingStopPercent))) {
      errors.push("Trailing Stop % must be a number");
    }
    if (!form.TrailingStopValue || isNaN(Number(form.TrailingStopValue))) {
      errors.push("Trailing Stop Value must be a number");
    }
  }

  if (form.ATR === 1) {
    if (!form.ATRPercent || isNaN(Number(form.ATRPercent))) {
      errors.push("ATR % must be a number");
    }
    if (!form.ATRValue || isNaN(Number(form.ATRValue))) {
      errors.push("ATR Value must be a number");
    }
  }

  if (form.thresholdPercent && isNaN(Number(form.thresholdPercent))) {
    errors.push("Threshold % must be a number");
  }

  return errors;
};

  const handleEdit = (stream: TradingStream) => {
    setEditingStream(stream);
    setFormData({
      InternalAccountId: stream.InternalAccountId.toString(),
    BinanceAccountId: stream.BinanceAccountId.toString(),
    Status: stream.Status,
    Type: stream.Type,
    StrategyId: stream.StrategyId?.toString() || '',
    indicatorId: stream.indicatorId.toString(),
    StreamStatus: stream.StreamStatus,
    TrailingStop: stream.TrailingStop,
    TrailingStopPercent: stream.TrailingStopPercent?.toString() || '',
    TrailingStopValue: stream.TrailingStopValue?.toString() || '',
    ATR: stream.ATR,
    ATRPercent: stream.ATRPercent?.toString() || '',
    ATRValue: stream.ATRValue?.toString() || '',
    thresholdPercent: stream.thresholdPercent?.toString() || '',
    Symbol: stream.Symbol,
    OrderId: stream.OrderId.toString(),
    OrderPrice: stream.OrderPrice.toString(),
    StopLost: stream.StopLost.toString(),
    TakeProfit: stream.TakeProfit.toString(),
    CapitalUsageRatio: stream.CapitalUsageRatio.toString(),
    Description: stream.Description,
    TrendStatus: stream.TrendStatus,
    TrendType: stream.TrendType,
    StreamType: (stream as any).StreamType ?? 0

    });
    setIsFormOpen(true);
  };

  const handleDelete = (stream: TradingStream) => {
    setDeletingStream(stream);
  };

  

  const handleStatusToggle = async (stream: TradingStream, newStatus: number) => {
  if (!stream.id) {
    console.error('❌ Không có stream.id', stream);
    return;
  }

  const payload = {
    ...stream,
    Status: newStatus,
    update_time: new Date().toISOString().replace('T', ' ').replace('Z', '+07')
  };

  try {
    await configBotAPI.updateTradingStream(stream.id, payload);
    setMessage({ type: 'success', text: 'Stream updated' });
    await loadStreams();
  } catch (error) {
    console.error('❌ Update failed:', error);
    setMessage({ type: 'error', text: 'Failed to update stream' });
  }
};




  const resetForm = () => {
    setFormData({
      InternalAccountId: '1',
      BinanceAccountId: '1',
      Status: 0,
      Type: 0,
      StrategyId: '',
      indicatorId: '1',
      StreamStatus: 'waiting for setup',
      TrailingStop: 0,
      TrailingStopPercent: '',
      TrailingStopValue: '',
      ATR: 0,
      ATRPercent: '',
      ATRValue: '',
      thresholdPercent: '',
      Symbol: '',
      OrderId: '',
      OrderPrice: '',
      StopLost: '',
      TakeProfit: '',
      CapitalUsageRatio: '',
      Description: '',
      TrendStatus: 0,
      StreamType: 0,
      TrendType: 'SIDEWAYS'
    });
  };

  const getStatusBadgeColor = (status: number) => {
    switch (status) {
      case 1:
        return 'bg-success-500/10 text-success-500';
      case 2:
        return 'bg-warning-300/10 text-warning-300';
      case 0:
        return 'bg-dark-600 text-dark-300';
      default:
        return 'bg-dark-600 text-dark-300';
    }
  };

  const getStatusIcon = (status: number) => {
    switch (status) {
      case 1:
        return <Play className="h-3 w-3" />;
      case 2:
        return <Pause className="h-3 w-3" />;
      case 0:
        return <XCircle className="h-3 w-3" />;
      default:
        return <XCircle className="h-3 w-3" />;
    }
  };

  const getStatusLabel = (status: number) => {
    switch (status) {
      case 1: return 'Active';
      case 2: return 'Paused';
      case 0: return 'Inactive';
      default: return 'Unknown';
    }
  };

  const getTypeLabel = (type: number) => {
    switch (type) {
      case 0: return 'Basic';
      case 1: return 'Advanced';
      case 2: return 'Premium';
      default: return 'Unknown';
    }
  };

  const getTypeColor = (type: number) => {
    switch (type) {
      case 0:
        return 'bg-primary-500/10 text-primary-500';
      case 1:
        return 'bg-warning-300/10 text-warning-300';
      case 2:
        return 'bg-danger-500/10 text-danger-500';
      default:
        return 'bg-dark-600 text-dark-300';
    }
  };

  const getTrendColor = (trendType: string) => {
    switch (trendType) {
      case 'UPTREND':
        return 'text-success-500';
      case 'DOWNTREND':
        return 'text-danger-500';
      case 'SIDEWAYS':
        return 'text-warning-300';
      default:
        return 'text-dark-400';
    }
  };
const filteredStreams = streams.filter(stream => {
  const matchesSearch =
    searchQuery === '' ||
    stream.Description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    stream.Symbol?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    stream.StreamStatus?.toLowerCase().includes(searchQuery.toLowerCase());

  const matchesStatus =
    selectedStatus === 'all' || stream.Status === Number(selectedStatus);

  const matchesType =
    selectedType === 'all' || stream.Type === Number(selectedType);

  return matchesSearch && matchesStatus && matchesType;
});



  return (
    <div className="w-full overflow-x-auto">
    <div className="min-w-[1000px] space-y-6">
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold">Trading Bot Configuration</h1>
          <p className="text-dark-400">Manage and configure your automated trading streams</p>
        </div>
        <div className="flex-shrink-0">
          <button 
            className="btn btn-primary w-full sm:w-auto"
            onClick={() => {
              setEditingStream(null);
              resetForm();
              setIsFormOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Create Trading Stream
          </button>
        </div>
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

      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="card p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary-500/10">
                <Bot className="h-4 w-4 text-primary-500" />
              </div>
            </div>
            <div className="ml-3 min-w-0">
              <p className="text-sm font-medium text-dark-400">Total Streams</p>
              <p className="text-lg font-semibold">{streams.length}</p>
            </div>
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-success-500/10">
                <Play className="h-4 w-4 text-success-500" />
              </div>
            </div>
            <div className="ml-3 min-w-0">
              <p className="text-sm font-medium text-dark-400">Active</p>
              <p className="text-lg font-semibold">{streams.filter(s => s.Status === 1).length}</p>
            </div>
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-warning-300/10">
                <Pause className="h-4 w-4 text-warning-300" />
              </div>
            </div>
            <div className="ml-3 min-w-0">
              <p className="text-sm font-medium text-dark-400">Paused</p>
              <p className="text-lg font-semibold">{streams.filter(s => s.Status === 2).length}</p>
            </div>
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-dark-600">
                <XCircle className="h-4 w-4 text-dark-300" />
              </div>
            </div>
            <div className="ml-3 min-w-0">
              <p className="text-sm font-medium text-dark-400">Inactive</p>
              <p className="text-lg font-semibold">{streams.filter(s => s.Status === 0).length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search and filters - Completely redesigned responsive layout */}
      <div className="space-y-4">
        {/* Search bar - always full width */}
        <div className="w-full">
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <Search className="h-4 w-4 text-dark-400" />
            </div>
            <input
              type="text"
              className="form-input pl-10 w-full"
              placeholder="Search trading streams..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        
        {/* Filters row - responsive grid */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:flex lg:gap-4">
          <div className="lg:min-w-[140px]">
            <select
              className="form-select w-full"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value === 'all' ? 'all' : parseInt(e.target.value) as 0 | 1 | 2)}
            >
              <option value="all">All Status</option>
              <option value={1}>Active</option>
              <option value={2}>Paused</option>
              <option value={0}>Inactive</option>
            </select>
          </div>
          {SHOW_TYPE && (
          <div className="lg:min-w-[140px]">
            <select
              className="form-select w-full"
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value === 'all' ? 'all' : parseInt(e.target.value) as 0 | 1 | 2)}
            >
              <option value="all">All Types</option>
              <option value={0}>Basic</option>
              <option value={1}>Advanced</option>
              <option value={2}>Premium</option>
            </select>
          </div>
          )}
          <div className="lg:min-w-[120px]">
            <button className="btn btn-outline w-full inline-flex items-center justify-center">
              <Filter className="mr-2 h-4 w-4" />
              Filter
            </button>
          </div>
        </div>
      </div>

      {/* Trading streams table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className=" overflow-x-auto">
            <table className=" configbot-table min-w-[800px] w-full divide-y divide-dark-700">
              <thead>
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-dark-400 ">Stream</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-dark-400 ">Symbol</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-dark-400 ">StopLost</th>
<th className="px-6 py-3 text-right text-xs font-medium text-dark-400 min-w-[80px]">Take Profit</th>

                  {SHOW_TYPE && (
  <th className="px-6 py-3 text-left text-xs font-medium text-dark-400 min-w-[100px]">Type</th>
)}
                  <th className="px-6 py-3 text-center text-xs font-medium text-dark-400 min-w-[100px]">Status</th>
                  {SHOW_TYPE && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-dark-400 min-w-[150px]">Stream Status</th>
                  )}
                  {SHOW_TYPE && (
                  <th className="px-6 py-3 text-right text-xs font-medium text-dark-400 min-w-[120px]">Order Price</th>
                         )}
                  <th className="px-6 py-3 text-right text-xs font-medium text-dark-400 ">Capital %</th>
                  {SHOW_TYPE && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-dark-400 ">Trend</th>)}
                  {SHOW_TYPE && (
                  <th className="px-6 py-3 text-right text-xs font-medium text-dark-400 ">Last Updated</th>)}
                  <th className="px-6 py-3 text-right text-xs font-medium text-dark-400 ">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-700">
                {filteredStreams.map((stream) => (
                  <tr key={stream.id} className="hover:bg-dark-700/40">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-10 w-10 flex-shrink-0 rounded-full bg-primary-500/10 flex items-center justify-center">
                          <Bot className="h-5 w-5 text-primary-500" />
                        </div>
                        <div className="ml-4 min-w-0">
                          <div className="font-medium truncate">{stream.Description}</div>
                          <div className="text-sm text-dark-400">ID: {stream.id} | Indicator: {stream.indicatorId}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="font-mono text-sm">{stream.Symbol}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-dark-400">
  {stream.StopLost && stream.StopLost > 0 ? stream.StopLost.toFixed(2) : '--'}
</td>
<td className="px-6 py-4 whitespace-nowrap text-right text-sm text-dark-400">
  {stream.TakeProfit && stream.TakeProfit > 0 ? stream.TakeProfit.toFixed(2) : '--'}
</td>



                    {SHOW_TYPE && (
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getTypeColor(stream.Type)}`}>
                        {getTypeLabel(stream.Type)}
                      </span>
                    </td>
                    )}
                    
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusBadgeColor(stream.Status)}`}>
                        {getStatusIcon(stream.Status)}
                        <span className="ml-1">{getStatusLabel(stream.Status)}</span>
                      </span>
                    </td>
                    {SHOW_TYPE && (
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-dark-300">{stream.StreamStatus}</span>
                    </td>
                           )}
                           {SHOW_TYPE && (
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      {stream.OrderPrice ? `$${parseFloat(stream.OrderPrice).toFixed(4)}` : '-'}
                    </td>
                          )}
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      {stream.CapitalUsageRatio}%
                    </td>
                    {SHOW_TYPE &&(
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className={`w-2 h-2 rounded-full mr-2 ${
                          stream.TrendType === 'UPTREND' ? 'bg-success-500' :
                          stream.TrendType === 'DOWNTREND' ? 'bg-danger-500' : 'bg-warning-300'
                        }`}></div>
                        <span className={`text-xs font-medium ${getTrendColor(stream.TrendType)}`}>
                          {stream.TrendType}
                        </span>
                      </div>
                    </td>)}
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-dark-400">
                      <div>
                        <FormattedDate
  value={stream.update_time}
  day="2-digit"
  month="2-digit"
  year="numeric"
/>
                      </div>
                      <div className="text-xs">
                        <FormattedTime
                          value={stream.update_time}
                          hour="2-digit"
                          minute="2-digit"
                        />
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      <div className="flex justify-end space-x-2">
                        {stream.Status === 1 ? (
                          <button
                            onClick={() => handleStatusToggle(stream, 2)}
                            className="text-dark-400 hover:text-warning-300"
                            title="Pause Stream"
                          >
                            <Pause className="h-4 w-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleStatusToggle(stream, 1)}
                            className="text-dark-400 hover:text-success-500"
                            title="Activate Stream"
                          >
                            <Play className="h-4 w-4" />
                          </button>
                        )}
                        
                        <button
                          onClick={() => handleEdit(stream)}
                          className="text-dark-400 hover:text-primary-500"
                          title="Edit Stream"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        
                        <button
                          onClick={() => handleDelete(stream)}
                          className="text-dark-400 hover:text-danger-500"
                          title="Delete Stream"
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
          <div className="card w-full max-w-6xl max-h-[90vh] overflow-y-auto">
            <div className="card-header flex justify-between items-center">
              <h2 className="text-lg font-medium">
                {editingStream ? 'Edit Trading Stream' : 'Create New Trading Stream'}
              </h2>
              <button
                className="text-dark-400 hover:text-dark-300"
                onClick={() => {
                  setIsFormOpen(false);
                  setEditingStream(null);
                  resetForm();
                }}
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Basic Information */}
              {validationErrors.length > 0 && (
    <div className="bg-danger-500/10 text-danger-500 p-4 rounded-md border border-danger-500/30 mb-4">
      <ul className="list-disc pl-5 space-y-1 text-sm">
        {validationErrors.map((err, idx) => (
          <li key={idx}>{err}</li>
        ))}
      </ul>
    </div>
  )}
              <div>
                <h3 className="text-base font-medium mb-4">Basic Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label htmlFor="description" className="form-label">Description *</label>
                    <input
                      type="text"
                      id="description"
                      className="form-input"
                      value={formData.Description}
                      onChange={(e) => setFormData({ ...formData, Description: e.target.value })}
                      required
                      placeholder="e.g., BTC-Scalping-Pro"
                    />
                  </div>

                  <div>
                    <label htmlFor="symbol" className="form-label">Trading Symbol *</label>
                    <input
                      type="text"
                      id="symbol"
                      className="form-input"
                      value={formData.Symbol}
                      onChange={(e) => setFormData({ ...formData, Symbol: e.target.value.toUpperCase() })}
                      required
                      placeholder="e.g., BTCUSDT"
                    />
                  </div>
                  

                  <div className="hidden">
                    <label htmlFor="streamStatus" className="form-label">Stream Status</label>
                    <select
                      id="streamStatus"
                      className="form-select"
                      value={formData.StreamStatus}
                      onChange={(e) => setFormData({ ...formData, StreamStatus: e.target.value })}
                    >
                      <option value="waiting for setup">Waiting for Setup</option>
                      <option value="no order in stream">No Order in Stream</option>
                      <option value="monitoring signals">Monitoring Signals</option>
                      <option value="active trading">Active Trading</option>
                      <option value="paused by user">Paused by User</option>
                    </select>
                  </div>
                  <div >
  <label htmlFor="streamType" className="form-label">Stream Type</label>
  <select
    id="streamType"
    className="form-select"
    value={formData.StreamType}
    onChange={(e) => setFormData({ ...formData, StreamType: parseInt(e.target.value) })}
  >
    <option value={0}>Manual</option>
    <option value={1}>Signal-Based</option>
    <option value={2}>Auto-AI</option>
  </select>
</div>


                  <div>
                    <label htmlFor="internalAccountId" className="form-label">Internal Account ID</label>
                    <input
                      type="number"
                      id="internalAccountId"
                      className="form-input"
                      value={formData.InternalAccountId}
                      onChange={(e) => setFormData({ ...formData, InternalAccountId: e.target.value })}
                      min="1"
                    />
                  </div>

                  <div>
                    <label htmlFor="binanceAccountId" className="form-label">Binance Account ID</label>
                    <input
                      type="number"
                      id="binanceAccountId"
                      className="form-input"
                      value={formData.BinanceAccountId}
                      onChange={(e) => setFormData({ ...formData, BinanceAccountId: e.target.value })}
                      min="1"
                    />
                  </div>

                  <div>
                    <label htmlFor="indicatorId" className="form-label">Indicator ID</label>
                    <input
                      type="number"
                      id="indicatorId"
                      className="form-input"
                      value={formData.indicatorId}
                      onChange={(e) => setFormData({ ...formData, indicatorId: e.target.value })}
                      min="1"
                    />
                  </div>
                </div>
              </div>

              {/* Status and Type */}
              <div>
                <h3 className="text-base font-medium mb-4">Status & Type Configuration</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label htmlFor="status" className="form-label">Status</label>
                    <select
                      id="status"
                      className="form-select"
                      value={formData.Status}
                      onChange={(e) => setFormData({ ...formData, Status: parseInt(e.target.value) })}
                    >
                      <option value={0}>Inactive</option>
                      <option value={1}>Active</option>
                      <option value={2}>Paused</option>
                    </select>
                  </div>

{SHOW_TYPE && (
                  <div>
                    <label htmlFor="type" className="form-label">Type</label>
                    <select
                      id="type"
                      className="form-select"
                      value={formData.Type}
                      onChange={(e) => setFormData({ ...formData, Type: parseInt(e.target.value) })}
                    >
                      <option value={0}>Basic</option>
                      <option value={1}>Advanced</option>
                      <option value={2}>Premium</option>
                    </select>
                  </div>
)}
                  <div>
                    <label htmlFor="strategyId" className="form-label">Strategy ID</label>
                    <input
                      type="number"
                      id="strategyId"
                      className="form-input"
                      value={formData.StrategyId}
                      onChange={(e) => setFormData({ ...formData, StrategyId: e.target.value })}
                      placeholder="Optional"
                    />
                  </div>

                  <div>
                    <label htmlFor="capitalUsageRatio" className="form-label">Capital Usage %</label>
                    <input
                      type="number"
                      id="capitalUsageRatio"
                      className="form-input"
                      value={formData.CapitalUsageRatio}
                      onChange={(e) => setFormData({ ...formData, CapitalUsageRatio: e.target.value })}
                      min="1"
                      max="100"
                      placeholder="10"
                    />
                  </div>
                </div>
              </div>

              {/* Trading Configuration */}
              
              <div>
                <h3 className="text-base font-medium mb-4">Trading Configuration</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {SHOW_TYPE && (
                  <div>
                    <label htmlFor="orderPrice" className="form-label">Order Price</label>
                    <input
                      type="text"
                      id="orderPrice"
                      className="form-input"
                      value={formData.OrderPrice}
                      onChange={(e) => setFormData({ ...formData, OrderPrice: e.target.value })}
                      placeholder="0.19189"
                    />
                  </div>
                  )}
                  <div>
                    <label htmlFor="stopLost" className="form-label">Stop Loss</label>
                    <input
                      type="number"
                      id="stopLost"
                      className="form-input"
                      value={formData.StopLost}
                      onChange={(e) => setFormData({ ...formData, StopLost: e.target.value })}
                      step="0.01"
                      placeholder="0.1"
                    />
                  </div>

                  <div>
                    <label htmlFor="takeProfit" className="form-label">Take Profit</label>
                    <input
                      type="number"
                      id="takeProfit"
                      className="form-input"
                      value={formData.TakeProfit}
                      onChange={(e) => setFormData({ ...formData, TakeProfit: e.target.value })}
                      step="0.01"
                      placeholder="1"
                    />
                  </div>

                  <div>
                    <label htmlFor="orderId" className="form-label">Order ID</label>
                    <input
                      type="text"
                      id="orderId"
                      className="form-input"
                      value={formData.OrderId}
                      onChange={(e) => setFormData({ ...formData, OrderId: e.target.value })}
                      placeholder="74753557217"
                    />
                  </div>
                </div>
              </div>

              {/* Trailing Stop Configuration */}
              <div>
                <h3 className="text-base font-medium mb-4">Trailing Stop Configuration</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label htmlFor="trailingStop" className="form-label">Trailing Stop</label>
                    <select
                      id="trailingStop"
                      className="form-select"
                      value={formData.TrailingStop}
                      onChange={(e) => setFormData({ ...formData, TrailingStop: parseInt(e.target.value) })}
                    >
                      <option value={0}>Disabled</option>
                      <option value={1}>Enabled</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="trailingStopPercent" className="form-label">Trailing Stop %</label>
                    <input
                      type="number"
                      id="trailingStopPercent"
                      className="form-input"
                      value={formData.TrailingStopPercent}
                      onChange={(e) => setFormData({ ...formData, TrailingStopPercent: e.target.value })}
                      step="0.1"
                      placeholder="1"
                    />
                  </div>

                  <div>
                    <label htmlFor="trailingStopValue" className="form-label">Trailing Stop Value</label>
                    <input
                      type="number"
                      id="trailingStopValue"
                      className="form-input"
                      value={formData.TrailingStopValue}
                      onChange={(e) => setFormData({ ...formData, TrailingStopValue: e.target.value })}
                      step="0.01"
                      placeholder="0.3"
                    />
                  </div>

                  <div>
                    <label htmlFor="thresholdPercent" className="form-label">Threshold %</label>
                    <input
                      type="number"
                      id="thresholdPercent"
                      className="form-input"
                      value={formData.thresholdPercent}
                      onChange={(e) => setFormData({ ...formData, thresholdPercent: e.target.value })}
                      step="0.1"
                      placeholder="2.5"
                    />
                  </div>
                </div>
              </div>

              {/* ATR Configuration */}
              <div>
                <h3 className="text-base font-medium mb-4">ATR Configuration</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label htmlFor="atr" className="form-label">ATR</label>
                    <select
                      id="atr"
                      className="form-select"
                      value={formData.ATR}
                      onChange={(e) => setFormData({ ...formData, ATR: parseInt(e.target.value) })}
                    >
                      <option value={0}>Disabled</option>
                      <option value={1}>Enabled</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="atrPercent" className="form-label">ATR %</label>
                    <input
                      type="number"
                      id="atrPercent"
                      className="form-input"
                      value={formData.ATRPercent}
                      onChange={(e) => setFormData({ ...formData, ATRPercent: e.target.value })}
                      step="0.1"
                      placeholder="1.5"
                    />
                  </div>

                  <div>
                    <label htmlFor="atrValue" className="form-label">ATR Value</label>
                    <input
                      type="number"
                      id="atrValue"
                      className="form-input"
                      value={formData.ATRValue}
                      onChange={(e) => setFormData({ ...formData, ATRValue: e.target.value })}
                      step="0.001"
                      placeholder="0.02"
                    />
                  </div>
                </div>
              </div>

              {/* Trend Configuration */}
              <div>
                <h3 className="text-base font-medium mb-4">Trend Configuration</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="trendStatus" className="form-label">Trend Status</label>
                    <select
                      id="trendStatus"
                      className="form-select"
                      value={formData.TrendStatus}
                      onChange={(e) => setFormData({ ...formData, TrendStatus: parseInt(e.target.value) })}
                    >
                      <option value={0}>Inactive</option>
                      <option value={1}>Active</option>
                    </select>
                  </div>
{SHOW_TYPE && (
                  <div>
                    <label htmlFor="trendType" className="form-label">Trend Type</label>
                    <select
                      id="trendType"
                      className="form-select"
                      value={formData.TrendType}
                      onChange={(e) => setFormData({ ...formData, TrendType: e.target.value })}
                    >
                      <option value="UPTREND">UPTREND</option>
                      <option value="DOWNTREND">DOWNTREND</option>
                      <option value="SIDEWAYS">SIDEWAYS</option>
                    </select>
                  </div>)}
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-4 border-t border-dark-700">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => {
                    setIsFormOpen(false);
                    setEditingStream(null);
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
                  {editingStream ? 'Update' : 'Create'} Stream
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingStream && (
        <div className="fixed inset-0 bg-dark-900/80 flex items-center justify-center p-4 z-50">
          <div className="card w-full max-w-md">
            <div className="p-6">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-danger-500/10 mx-auto mb-4">
                <AlertTriangle className="h-6 w-6 text-danger-500" />
              </div>
              
              <h3 className="text-lg font-medium text-center mb-2">Delete Trading Stream</h3>
              
              <p className="text-dark-400 text-center mb-6">
                Are you sure you want to delete the trading stream "{deletingStream.Description}"? This action cannot be undone.
              </p>

              <div className="flex justify-center space-x-3">
                <button
                  className="btn btn-outline"
                  onClick={() => setDeletingStream(null)}
                >
                  Cancel
                </button>
                <button
                  className="btn bg-danger-500 hover:bg-danger-600 text-white"
                  onClick={confirmDelete}
                >
                  Delete Stream
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
    </div>
    </div>
  );
}