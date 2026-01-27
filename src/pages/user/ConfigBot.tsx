import { User, Link2 } from 'lucide-react';

import React, { useState, useEffect } from 'react';
import {
  Plus, Search, Filter, Edit, Trash2, Save, XCircle,
  AlertTriangle, CheckCircle, Bot, Play, Pause,
  Settings, TrendingUp, Activity
} from 'lucide-react';
import { FormattedDate, FormattedTime } from 'react-intl';
import { configBotAPI } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { binanceAccountApi } from '../../utils/api';
import { indicatorApi } from '../../utils/api';
import { adminApi } from '../../utils/api';
import { accountApi } from '../../utils/api';
interface TradingStream {
  id: number;
  InternalAccountId: number;
  BinanceAccountId: number;
  Status: number;
  Type: number;
  StrategyId: number | null;
  indicatorId: string;
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
  Leverage: number | null;
  MarginType: 'CROSS' | 'ISOLATED' | null;
}

interface TradingStreamForm {
  InternalAccountId: string;
  BinanceAccountId: string;
  Status: number;
  StreamType: number;
  Leverage?: string;
  MarginType?: string;
  Type: number;
  StrategyId: string;
  indicatorId: string;
  StreamStatus: string;
  TrailingStop: number;
  TrailingStopPercent: string;
  TrailingStopValue: string;
  ATR: number;
  ATRPercent: number | null;
  ATRValue: number | null;
  thresholdPercent: string;
  OrderId: string;
  OrderPrice: string;
  StopLost: string;
  TakeProfit: string;
  CapitalUsageRatio: string;
  Description: string;
  TrendStatus: number;
  TrendType: string;
  Symbol: string; // ✅ thêm dòng này
}


export default function ConfigBot() {
  const [streams, setStreams] = useState<TradingStream[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<number | 'all'>('all');
  const isDev = import.meta.env.MODE === 'development';
  const [selectedType, setSelectedType] = useState<'all' | 0 | 1 | 2>('all');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingStream, setEditingStream] = useState<TradingStream | null>(null);
  const [deletingStream, setDeletingStream] = useState<TradingStream | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [togglingStream, setTogglingStream] = useState<TradingStream | null>(null);
  const { user } = useAuth();
  const [myBinanceAccountId, setMyBinanceAccountId] = useState<string>('1');
  const [accountUsernameMap, setAccountUsernameMap] = useState<Record<number, string>>({});
  const [page, setPage] = useState(1);
  const [limit] = useState(10); // số dòng mỗi trang, bạn có thể chỉnh
  const [totalPages, setTotalPages] = useState(1);
  const [showUpdateConfirm, setShowUpdateConfirm] = useState(false);





  const [leverage, setLeverage] = useState<number>(1);
  const [marginType, setMarginType] = useState<'ISOLATED' | 'CROSS'>('CROSS');
  const [indicators, setIndicators] = useState<{ id: number; name: string; symbol: string }[]>([]);
  const [binanceAccounts, setBinanceAccounts] = useState<{ id: number; name: string }[]>([]);
  const getBinanceAccountName = (id: number) => {
    const acc = binanceAccounts.find(acc => acc.id === id);
    return acc?.name || 'Unknown';
  };



  const indicatorMap: Record<number, string> = Object.fromEntries(
    indicators.map(ind => [ind.id, ind.name])
  );


  const [showLeveragePopup, setShowLeveragePopup] = useState(false);



  const SHOW_TYPE = false;
  const SHOW_STREAM_STATUS = false;
  const SHOW_ORDER_PRICE = false;
  const SHOW_TREND = false;


  const [formData, setFormData] = useState<TradingStreamForm>({
    InternalAccountId: user?.internalAccountId?.toString() || '1',
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
    ATRPercent: 2,
    ATRValue: 0.2,
    thresholdPercent: '',
    Symbol: '',
    OrderId: '',
    OrderPrice: '',
    StopLost: '1',
    TakeProfit: '4',
    CapitalUsageRatio: '10',
    Description: '',
    TrendStatus: 0,
    TrendType: 'SIDEWAYS',
    StreamType: 0,
    MarginType: 'CROSS',
    Leverage: '1'

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

      let response;
      console.log("📦 Gọi API với page:", page, "limit:", limit);
      if (user?.role === 'admin' || user?.role === 'superadmin') {
        response = await configBotAPI.getAllTradingStreams({ page, limit });
      } else {
        response = await configBotAPI.getMyTradingStreams({ page, limit });
      }

      const data = response?.Data?.streams || [];
      const total = response?.Data?.pagination?.total || data.length;
      setTotalPages(Math.ceil(total / limit));
      setStreams(data);
      setTotalPages(Math.ceil(total / limit));

      // 👉 Gọi mapping username
      const internalIds = [...new Set(data.map((s) => s.InternalAccountId))];
      await fetchUsernamesByInternalIds(internalIds);

    } catch (error) {
      console.error('❌ Lỗi khi load streams:', error);
    } finally {
      setIsLoading(false);
    }
  };
  useEffect(() => {
    loadStreams();
  }, [page]);



  const fetchUsernamesByInternalIds = async (ids: number[]) => {
    try {
      let map: Record<number, string> = {};

      // 👉 Nếu là admin/superadmin → lấy danh sách tất cả accounts
      if (user?.role === 'admin' || user?.role === 'superadmin') {
        const res = await accountApi.getListAccount();
        const accounts = res?.Data?.accounts || [];

        ids.forEach((id) => {
          const match = accounts.find((acc: any) => acc.id === id);
          map[id] = match?.Username || 'Unknown';
        });
      }

      // 👉 Nếu là user → chỉ gọi 1 ID chính mình
      else {
        const res = await accountApi.getAccountById(user.id);
        const username = res?.Data?.Username || 'Unknown';
        map[user.id] = username;
      }

      console.log('✅ Mapped username:', map);
      setAccountUsernameMap(map);

    } catch (err) {
      console.error('❌ Lỗi khi lấy thông tin account:', err);
    }
  };
  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages || newPage === page) return;
    setPage(newPage);
  };










  const confirmDelete = async () => {
    if (!deletingStream || !deletingStream.id) {
      console.error('❌ Không có stream để xóa');
      return;
    }

    try {

      console.log('🧪 Đang xoá stream với ID:', deletingStream.id);

      if (user?.role === 'admin' || user?.role === 'superadmin') {
  await configBotAPI.deleteTradingStream(deletingStream.id); // Admin dùng route này
} else {
  await configBotAPI.deleteMyTradingStream(deletingStream.id); // User dùng route này
}


      setMessage({ type: 'success', text: 'Deleted successfully' });

      await loadStreams(); // ✅ Đảm bảo stream reload xong mới xoá modal
      setDeletingStream(null); // ✅ Reset sau khi UI cập nhật
    } catch (error) {
      console.error('❌ Delete failed:', error);
      setMessage({ type: 'error', text: 'Failed to delete stream' });
    }
  };








  const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault(); // ⛔ Ngăn reload form

  if (formData.Description?.length > 255) {
    alert("🛑 Mô tả không được vượt quá 255 ký tự!");
    return;
  }

  const errors = validateForm(formData);
  if (errors.length > 0) {
    setValidationErrors(errors);
    console.log("⛔ Validation errors:", errors);
    return;
  }

  // Nếu đang edit → mở confirm popup
  if (editingStream) {
    setShowUpdateConfirm(true);
    return;
  }

  // Nếu là tạo mới → gửi luôn
  await submitStream();
};


const submitStream = async () => {
  setValidationErrors([]);
  setIsSaving(true);

  const cleanDescription =
    formData.Description?.includes('Config Warning')
      ? ''
      : formData.Description
          ?.replace(/\[.*?Warning:.*?\]/g, '')
          .trim()
          .slice(0, 250) || 'No description';

  const payload = {
    InternalAccountId: Number(formData.InternalAccountId),
    BinanceAccountId: Number(formData.BinanceAccountId),
    Status: formData.Status,
    Type: formData.Type,
    StrategyId: formData.StrategyId ? Number(formData.StrategyId) : null,
    indicatorId: Number(formData.indicatorId),
    StreamType: 0,
    Description: cleanDescription,
    Symbol: formData.Symbol || '',
    StreamStatus: SHOW_STREAM_STATUS ? formData.StreamStatus : 'waiting for setup',
    StopLost: Number(formData.StopLost),
    TakeProfit: Number(formData.TakeProfit),
    CapitalUsageRatio: Number(formData.CapitalUsageRatio),
    Leverage: Number(formData.Leverage?.replace('x1', '') || '1'),
    MarginType: formData.MarginType === 'CROSS' ? 'CROSSED' : 'ISOLATED',
    TrailingStop: formData.TrailingStop,
    TrailingStopPercent: formData.TrailingStopPercent ? Number(formData.TrailingStopPercent) : null,
    TrailingStopValue: formData.TrailingStopValue ? Number(formData.TrailingStopValue) : null,
    ATR: formData.ATR,
    ATRPercent: formData.ATRPercent ? Number(formData.ATRPercent) : null,
    ATRValue: formData.ATRValue ? Number(formData.ATRValue) : null,
    thresholdPercent: formData.thresholdPercent ? Number(formData.thresholdPercent) : null,
    ...(SHOW_TREND
      ? {
          TrendStatus: formData.TrendStatus,
          TrendType: formData.TrendType
        }
      : {
          TrendStatus: 0,
          TrendType: 'SIDEWAYS'
        }),
    OrderId: formData.OrderId,
    OrderPrice: SHOW_ORDER_PRICE ? Number(formData.OrderPrice) : 1,
  };

  console.log('📤 Payload gửi đi:', JSON.stringify(payload, null, 2));

  try {
    const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';

    if (editingStream) {
      await (isAdmin
        ? configBotAPI.updateTradingStream(editingStream.id, payload)
        : configBotAPI.updateMyTradingStream(editingStream.id, payload));
      setMessage({ type: 'success', text: 'Updated successfully' });
    } else {
      await (isAdmin
        ? configBotAPI.createTradingStream(payload)
        : configBotAPI.createMyTradingStream(payload));
      setMessage({ type: 'success', text: 'Created successfully' });
    }

    setIsFormOpen(false);
    setEditingStream(null);
    resetForm();
    await loadStreams();
  } catch (error: any) {
    console.error('❌ Submit failed:', error);
    console.log('📥 Server response:', error.response);

    if (error.response?.data?.Errors?.length) {
      setValidationErrors(error.response.data.Errors);
    } else {
      setMessage({ type: 'error', text: 'Failed to save stream' });
    }
  } finally {
    setIsSaving(false);
    setShowUpdateConfirm(false);
  }
};




  const validateForm = (form: TradingStreamForm): string[] => {
    const errors: string[] = [];
    if (SHOW_ORDER_PRICE) {
      if (!form.OrderPrice || isNaN(Number(form.OrderPrice))) {
        errors.push("Order Price is required and must be a number");
      } else if (Number(form.OrderPrice) <= 0) {
        errors.push("Order Price must be a positive number");
      }
    }


    if (!form.Description) errors.push("Description is required");
    if (form.OrderPrice !== '' && isNaN(Number(form.OrderPrice))) {
      errors.push("Order Price must be a valid number");
    }
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
      // ✅ Kiểm tra ATRPercent là số
      if (!form.ATRPercent || isNaN(Number(form.ATRPercent))) {
        errors.push("ATR % must be a valid number");
      } else if (!Number.isInteger(Number(form.ATRPercent))) {
        errors.push("ATR % must be an integer");
      }

      // ✅ Kiểm tra ATRValue (vẫn là float được)
      if (!form.ATRValue || isNaN(Number(form.ATRValue))) {
        errors.push("ATR Value must be a valid number");
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
      InternalAccountId: stream.InternalAccountId?.toString() || '',
      BinanceAccountId: stream.BinanceAccountId?.toString() || '',
      Status: stream.Status,
      Type: stream.Type,
      StrategyId: stream.StrategyId?.toString() || '',
      indicatorId: stream.indicatorId?.toString() || '1',
      StreamStatus: stream.StreamStatus || 'waiting for setup',
      TrailingStop: stream.TrailingStop,
      TrailingStopPercent: stream.TrailingStopPercent?.toString() || '',
      TrailingStopValue: stream.TrailingStopValue?.toString() || '',
      ATR: stream.ATR,
      ATRPercent: stream.ATRPercent?.toString() || '',
      ATRValue: stream.ATRValue?.toString() || '',
      thresholdPercent: stream.thresholdPercent?.toString() || '',
      Symbol: stream.Symbol || '',
      OrderId: stream.OrderId?.toString() || '',
      OrderPrice: stream.OrderPrice?.toString() || '',
      StopLost: stream.StopLost?.toString() || '',
      TakeProfit: stream.TakeProfit?.toString() || '',
      CapitalUsageRatio: stream.CapitalUsageRatio?.toString() || '',
      Description: stream.Description?.replace(/\[.*?Warning:.*?\]/g, '').trim() || '',
      TrendStatus: stream.TrendStatus ?? 0,
      TrendType: stream.TrendType || 'SIDEWAYS',
      StreamType: (stream as any).StreamType ?? 0,
      Leverage: stream.Leverage?.toString() || '1'
      ,
      MarginType: stream.MarginType || 'CROSS'
    });


    setIsFormOpen(true);
  };

  const handleDelete = (stream: TradingStream) => {
    setDeletingStream(stream);
  };
  const confirmResumeOrPause = (stream: TradingStream) => {
    setTogglingStream(stream); // Mở popup confirm Pause/Resume
  };


  const handleStatusToggle = async (stream: any) => {
    const updatedStatus = stream.Status === 1 ? 0 : 1;

    const updatedStream = {
      ...stream,
      Status: stream.Status === 1 ? 0 : 1,
      Leverage: String(stream.Leverage ?? '1'),
      MarginType: stream.MarginType ?? 'ISOLATED',
      OrderPrice: parseFloat(stream.OrderPrice ?? '1'),
      TakeProfit: parseFloat(stream.TakeProfit ?? '1'),
      StopLost: parseFloat(stream.StopLost ?? '0.1'),
      CapitalUsageRatio: parseInt(stream.CapitalUsageRatio ?? '10'),
      Description: stream.Description?.split("[")[0] ?? 'Unnamed Stream',
    };

    console.log('📦 Payload gửi khi update trạng thái:', updatedStream);

    console.log('📦 Payload gửi đi:', updatedStream);

    try {
      if (user?.role === 'admin' || user?.role === 'superadmin') {
        await configBotAPI.updateTradingStream(stream.id, updatedStream);
      } else {
        await configBotAPI.updateMyTradingStream(stream.id, updatedStream); // ✅ dùng endpoint cho user
      }

      console.log('✅ Update status thành công');


      await loadStreams(); // 🔥 THÊM DÒNG NÀY → để cập nhật UI
    } catch (err) {
      console.error('❌ Update failed:', err);
    }
  };







  const resetForm = () => {
    setFormData({
      InternalAccountId: user?.internalAccountId?.toString() || '1',
      BinanceAccountId: myBinanceAccountId || '1',
      Status: 0,
      Type: 0,
      StrategyId: '',
      indicatorId: '',
      StreamStatus: 'waiting for setup',
      TrailingStop: 0,
      TrailingStopPercent: '',
      TrailingStopValue: '',
      ATR: 0,
      ATRPercent: 2,
      ATRValue: 0.2,
      thresholdPercent: '',
      OrderId: '',
      OrderPrice: '',
      StopLost: '1',
      TakeProfit: '1',
      CapitalUsageRatio: '10',
      Description: '',
      TrendStatus: 0,
      StreamType: 0,
      TrendType: 'SIDEWAYS',
      Leverage: '1',
      MarginType: 'CROSS',
      Symbol: '' 
    });
  };

  useEffect(() => {
    console.log('🔐 User role:', user?.role);

    const fetchBinanceAccounts = async () => {
      try {
        const res =
          user?.role === 'admin' || user?.role === 'superadmin'
            ? await binanceAccountApi.getListAccounts()
            : await binanceAccountApi.getMyAccounts();

        const raw = res?.Data?.accounts || [];



        const mapped = raw.map((acc: any) => {
          const name = typeof acc.Name === 'string' ? acc.Name : acc.name;
          return {
            id: Number(acc.id),
            name: name || 'Unnamed',
          };
        });

        console.log('📦 BinanceAccounts mapped:', mapped);

        setBinanceAccounts(mapped);
      } catch (err) {
        console.error('❌ Lỗi khi load Binance Accounts:', err);
      }
    };


    fetchBinanceAccounts();
  }, []);


  useEffect(() => {
    const fetchIndicators = async () => {
      try {
        let res;
        if (user?.role === 'admin' || user?.role === 'superadmin') {
          res = await indicatorApi.getAllIndicatorConfigs();
        } else {
          res = await indicatorApi.getMyActiveIndicators(); // 👈 API dành cho user
        }

        console.log("📦 Raw indicator response:", res?.Data);

        // ✅ Kiểm tra Data có phải mảng không, nếu không thì lấy res.Data.indicators
        const raw = Array.isArray(res?.Data)
          ? res.Data
          : Array.isArray(res?.Data?.indicators)
            ? res.Data.indicators
            : [];

        if (!Array.isArray(raw)) {
          console.error('❌ Indicator API không trả về mảng:', res?.Data);
          return;
        }

        const mapped = raw.map((item: any) => {
          let fixedName = item.name || item.Name || 'Unknown';
          let fixedSymbol = item.symbol || item.Symbol || '';

          // Fix typo nếu có
          if (fixedName === 'EmaSingnal') {
            fixedName = 'EmaSignal';
            fixedSymbol = '1000PEPEUSDT';
          }

          return {
            id: Number(item.id),
            name: fixedName,
            symbol: fixedSymbol,
          };
        });

        setIndicators(mapped);
        console.log('✅ Mapped indicators:', mapped);
      } catch (err) {
        console.error('❌ Lỗi tải indicators:', err);
      }
    };

    fetchIndicators();
  }, []);







  // Load Binance account tương ứng với user đang login
  useEffect(() => {

    const fetchMyBinanceAccount = async () => {
      try {
        const res =
          user?.role === 'admin' || user?.role === 'superadmin'
            ? await binanceAccountApi.getListAccounts()
            : await binanceAccountApi.getMyAccounts();
        const accounts = res.Data.accounts || [];

        const matched = accounts.find(acc => acc.internalAccountId === user?.internalAccountId);

        if (!matched) {
          console.warn('⚠️ Admin chưa có BinanceAccount tương ứng');
          // Optional: hiện cảnh báo UI
          toast.error("⚠️ Bạn chưa có Binance Account. Vui lòng tạo trước!");
          return; // ⛔ Dừng lại không setFormData
        }

        // ✅ Nếu tìm thấy thì set ID vào form
        setMyBinanceAccountId(matched.id.toString());
        setFormData(prev => ({
          ...prev,
          BinanceAccountId: matched.id.toString(),
        }));
      } catch (err) {
        console.error('❌ Lỗi khi lấy BinanceAccount:', err);
      }
    };

    if (user?.internalAccountId) {
      fetchMyBinanceAccount();
    }
  }, [user]);
  const handleChangeIndicator = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const rawValue = e.target.value;

    if (!rawValue) {
      resetIndicator(); // ✅ Gọi hàm reset bạn đã tạo
      console.warn('⚠️ User chưa chọn indicator hợp lệ');
      return;
    }

    const selectedIndicator = indicators.find(i => i.id.toString() === rawValue);

    if (!selectedIndicator) {
      console.warn("⚠️ Không tìm thấy indicator tương ứng");
      return;
    }

    setFormData(prev => ({
      ...prev,
      indicatorId: rawValue, // ✅ giữ kiểu string
      Symbol: selectedIndicator.symbol || "",
    }));

    console.log("✅ Gán symbol khi chọn:", selectedIndicator.symbol);
  };








  const getStatusBadgeColor = (status: number) => {
    switch (status) {
      case 1: return 'bg-success-500/10 text-success-500';
      case 0: return 'bg-[#475569] text-gray-300';
      case -1: return 'bg-danger-500/10 text-danger-500'; // ✅ mới thêm
      default: return 'bg-[#475569] text-gray-300';
    }
  };

  const getStatusIcon = (status: number) => {
    switch (status) {
      case 1:
        return <Play className="h-3 w-3" />;
      case 0:
        return <XCircle className="h-3 w-3" />;
      case -1:
        return <Trash2 className="h-3 w-3" />; // (tuỳ bạn muốn dùng icon gì cho Deleted)
      default:
        return <XCircle className="h-3 w-3" />;
    }
  };

  const getStatusLabel = (status: number) => {
    switch (status) {
      case 1: return 'Active';
      case 0: return 'Inactive';
      case -1: return 'Deleted by user';
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
        return 'bg-[#475569] text-gray-300';
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
        return 'text-gray-400';
    }
  };
  const filteredStreams = streams
    .filter(stream => {
      // ✅ Ẩn stream nếu là soft-delete và user không phải admin/superadmin
      if (stream.Status === -1 && user?.role !== 'admin' && user?.role !== 'superadmin') {
        return false;
      }
      return true;
    })
    .filter(stream => {
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

  const handleApplyFilter = () => {
    setSelectedStatus(
      filterInputs.status === 'all'
        ? 'all'
        : parseInt(filterInputs.status, 10)
    );

    setSelectedType(filterInputs.type); // nếu cần
    setSearchQuery(filterInputs.query);
  };


  const [filterInputs, setFilterInputs] = useState({
    status: 'all',
    type: 'all',
    query: ''
  });
  const handleStatusCardClick = (status: 'all' | 1 | 0 | -1) => {
    setSelectedStatus(status);
    setFilterInputs((prev) => ({ ...prev, status: status.toString() }));
  };



  return (
    <div className="w-full">
      <div className="space-y-6 px-4 sm:px-4">
        <div className="space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 flex-1">
              <h1 className="text-xl sm:text-2xl font-bold">Trading Bot Configuration</h1>
              <p className="text-sm text-gray-400">Manage and configure your automated trading streams</p>
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
            <div className={`flex items-center gap-3 p-4 rounded-lg ${message.type === 'success'
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
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {/* Total */}
            <div
              className={`bg-[#1e293b] border border-[#334155] rounded-xl p-3 sm:p-4 cursor-pointer transition ${selectedStatus === 'all' ? 'ring-2 ring-primary-500' : ''
                }`}
              onClick={() => handleStatusCardClick('all')}
            >
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-primary-500/10">
                    <Bot className="h-4 w-4 sm:h-5 sm:w-5 text-primary-500" />
                  </div>
                </div>
                <div className="ml-3 min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-gray-400">Total Streams</p>
                  <p className="text-lg sm:text-xl font-semibold">{streams.length}</p>
                </div>
              </div>
            </div>

            {/* Active */}
            <div
              className={`bg-[#1e293b] border border-[#334155] rounded-xl p-3 sm:p-4 cursor-pointer transition ${selectedStatus === 1 ? 'ring-2 ring-success-500' : ''
                }`}
              onClick={() => handleStatusCardClick(1)}
            >
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-success-500/10">
                    <Play className="h-4 w-4 sm:h-5 sm:w-5 text-success-500" />
                  </div>
                </div>
                <div className="ml-3 min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-gray-400">Active</p>
                  <p className="text-lg sm:text-xl font-semibold">{streams.filter(s => s.Status === 1).length}</p>
                </div>
              </div>
            </div>

            {/* Inactive */}
            <div
              className={`bg-[#1e293b] border border-[#334155] rounded-xl p-3 sm:p-4 cursor-pointer transition ${selectedStatus === 0 ? 'ring-2 ring-dark-500' : ''
                }`}
              onClick={() => handleStatusCardClick(0)}
            >
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-[#475569]">
                    <XCircle className="h-4 w-4 sm:h-5 sm:w-5 text-gray-300" />
                  </div>
                </div>
                <div className="ml-3 min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-gray-400">Inactive</p>
                  <p className="text-lg sm:text-xl font-semibold">{streams.filter(s => s.Status === 0).length}</p>
                </div>
              </div>
            </div>

            {/* Deleted */}
            {['admin', 'superadmin'].includes(user?.role) && (
              <div
                className={`bg-[#1e293b] border border-[#334155] rounded-xl p-3 sm:p-4 cursor-pointer transition ${selectedStatus === -1 ? 'ring-2 ring-danger-500' : ''
                  }`}
                onClick={() => handleStatusCardClick(-1)}
              >
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-danger-500/10">
                      <Trash2 className="h-4 w-4 sm:h-5 sm:w-5 text-danger-500" />
                    </div>
                  </div>
                  <div className="ml-3 min-w-0">
                    <p className="text-xs sm:text-sm font-medium text-gray-400">Deleted</p>
                    <p className="text-lg sm:text-xl font-semibold">{streams.filter(s => s.Status === -1).length}</p>
                  </div>
                </div>
              </div>
            )}
          </div>



          {/* Search and filters - Responsive layout */}
          <div className="space-y-4">
            {/* Search bar - always full width */}
            <div className="w-full">
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Search className="h-4 w-4 text-gray-500" />
                </div>
                <input
                  type="text"
                  className="w-full bg-[#1e293b] border border-[#334155] rounded-lg pl-10 pr-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-[#f0b90b]"
                  placeholder="Search trading streams..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            {/* Filters row - responsive grid */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 sm:max-w-[180px]">
                <select
                  className="w-full bg-[#1e293b] border border-[#334155] rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-[#f0b90b]"
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value === 'all' ? 'all' : parseInt(e.target.value) as 0 | 1 | -1)}
                >

                  <option value="all">All Status</option>
                  <option value={1}>Active</option>
                  <option value={0}>Inactive</option>
                  {user?.role === 'admin' || user?.role === 'superadmin' ? (
                    <option value={-1}>Deleted</option>
                  ) : null}
                </select>
              </div>
              {SHOW_TYPE && (
                <div className="flex-1 sm:max-w-[180px]">
                  <select
                    className="w-full bg-[#1e293b] border border-[#334155] rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-[#f0b90b]"
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
              <div className="sm:w-auto">
                <button
                  className="w-full sm:w-auto flex items-center justify-center gap-2 bg-[#1e293b] border border-[#334155] rounded-lg px-4 py-2.5 hover:border-[#f0b90b] transition-colors"
                  onClick={handleApplyFilter}
                >
                  <Filter className="h-4 w-4" />
                  Filter
                </button>

              </div>
            </div>
          </div>

          {/* Trading streams table */}
          <div className="bg-[#1e293b] border border-[#334155] rounded-xl overflow-hidden">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-2 border-[#f0b90b] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-sm text-left text-gray-200">
                  <thead>
                    <tr className="border-b border-[#334155]">
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">Name</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">Stream</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">Symbol</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-400">Leverage</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-400">SL %</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-400">TP %</th>

                      {SHOW_TYPE && (
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">Type</th>
                      )}
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-400">Status</th>
                      {SHOW_TYPE && (
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">Stream Status</th>
                      )}
                      {SHOW_TYPE && (
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-400">Order Price</th>
                      )}
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-400">Capital %</th>
                      {SHOW_TYPE && (
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">Trend</th>)}
                      {SHOW_TYPE && (
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-400">Updated</th>)}
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-400">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#334155]">

                    {filteredStreams.map((stream) => (



                      <tr key={stream.id} className="hover:bg-[#334155]/30 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-white font-semibold">
                              <User className="h-4 w-4 text-primary-500" />
                              {accountUsernameMap[Number(stream.InternalAccountId)] || 'Unknown'}
                            </div>
                            <div className="flex items-center gap-2 text-sm text-gray-400">
                              <Link2 className="h-4 w-4 text-warning-300" />
                              {getBinanceAccountName(stream.BinanceAccountId)}
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="h-10 w-10 flex-shrink-0 rounded-full bg-primary-500/10 flex items-center justify-center">
                              <Bot className="h-5 w-5 text-primary-500" />
                            </div>
                            <div className="ml-4 min-w-0">
                              {(() => {
                                const description = stream.Description?.split(' [')[0] || 'Unnamed';
                                const indicatorName = indicatorMap[Number(stream.indicatorId)] || 'Unknown';

                                return (
                                  <div
                                    className="font-medium truncate max-w-[250px]"
                                    title={`${description} - ${indicatorName}`}
                                  >
                                    {description} - {indicatorName}
                                  </div>
                                );
                              })()}
                              {user?.role === 'admin' || user?.role === 'superadmin' ? (
                                <div className="text-sm text-gray-400">
                                  ID: {stream.id} | Indicator: {stream.indicatorId}
                                </div>) : null}
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="font-mono text-sm">{stream.Symbol}</span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-center">
                          x{stream.Leverage ?? '1'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right text-sm text-gray-400">
                          {stream.StopLost && stream.StopLost > 0 ? stream.StopLost.toFixed(2) : '--'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right text-sm text-gray-400">
                          {stream.TakeProfit && stream.TakeProfit > 0 ? stream.TakeProfit.toFixed(2) : '--'}
                        </td>



                        {SHOW_TYPE && (
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getTypeColor(stream.Type)}`}>
                              {getTypeLabel(stream.Type)}
                            </span>
                          </td>
                        )}

                        <td className="px-4 py-3 whitespace-nowrap text-center">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusBadgeColor(stream.Status)}`}>
                            {getStatusIcon(stream.Status)}
                            <span className="ml-1">{getStatusLabel(stream.Status)}</span>
                          </span>
                        </td>
                        {SHOW_TYPE && (
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="text-sm text-gray-300">{stream.StreamStatus}</span>
                          </td>
                        )}
                        {SHOW_TYPE && (
                          <td className="px-4 py-3 whitespace-nowrap text-right text-sm">
                            {stream.OrderPrice ? `$${parseFloat(stream.OrderPrice).toFixed(4)}` : '-'}
                          </td>
                        )}
                        <td className="px-4 py-3 whitespace-nowrap text-right text-sm">
                          {stream.CapitalUsageRatio}%
                        </td>
                        {SHOW_TYPE && (
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className={`w-2 h-2 rounded-full mr-2 ${stream.TrendType === 'UPTREND' ? 'bg-success-500' :
                                  stream.TrendType === 'DOWNTREND' ? 'bg-danger-500' : 'bg-warning-300'
                                }`}></div>
                              <span className={`text-xs font-medium ${getTrendColor(stream.TrendType)}`}>
                                {stream.TrendType}
                              </span>
                            </div>
                          </td>)}
                        {SHOW_TYPE && (
                          <td className="px-4 py-3 whitespace-nowrap text-right text-sm text-gray-400">
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
                          </td>)}
                        <td className="px-4 py-3 whitespace-nowrap text-right text-sm">
                          <div className="flex justify-end gap-2">
                            {stream.Status === 1 ? (
                              <button
                                onClick={() => confirmResumeOrPause(stream)}
                                className="text-gray-400 hover:text-warning-300"
                                title="Pause Stream"
                              >
                                <Pause className="h-4 w-4" />
                              </button>
                            ) : (
                              <button
                                onClick={() => confirmResumeOrPause(stream)}
                                className="text-gray-400 hover:text-success-500"
                                title="Activate Stream"
                              >
                                <Play className="h-4 w-4" />
                              </button>
                            )}

                            <button
                              onClick={() => handleEdit(stream)}
                              className="text-gray-400 hover:text-primary-500"
                              title="Edit Stream"
                            >
                              <Edit className="h-4 w-4" />
                            </button>

                            <button
                              onClick={() => handleDelete(stream)}
                              className="text-gray-400 hover:text-danger-500"
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
          {/* Pagination */}
          {!isLoading && filteredStreams.length > 0 && (
            <div className="flex justify-between items-center mt-4">
              <div className="text-sm text-gray-400">
                Showing page {page} of {totalPages}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handlePageChange(page - 1)}
                  disabled={page === 1}
                  className="btn btn-outline disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>

                <div className="flex gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const pageNum = Math.max(1, Math.min(totalPages - 4, page - 2)) + i;
                    if (pageNum > totalPages) return null;

                    return (
                      <button
                        key={pageNum}
                        onClick={() => handlePageChange(pageNum)}
                        className={`px-3 py-2 text-sm rounded-lg ${pageNum === page
                            ? 'bg-primary-500 text-white'
                            : 'text-gray-400 hover:text-dark-200 hover:bg-[#334155]'
                          }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => handlePageChange(page + 1)}
                  disabled={page === totalPages}
                  className="btn btn-outline disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}


          {/* Form Modal */}
          {isFormOpen && (
            <div className="fixed inset-0 bg-[#0f172a]/80 flex items-center justify-center p-4 z-50">
              <div className="bg-[#1e293b] border border-[#334155] rounded-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between p-4 sm:p-5 border-b border-[#334155]">
                  <h2 className="text-lg font-semibold">
                    {editingStream ? 'Edit Trading Stream' : 'Create New Trading Stream'}
                  </h2>
                  <button
                    className="p-2 text-gray-400 hover:text-white hover:bg-[#334155] rounded-lg transition-colors"
                    onClick={() => {
                      setIsFormOpen(false);
                      setEditingStream(null);
                      resetForm();
                    }}
                  >
                    <XCircle className="h-5 w-5" />
                  </button>
                </div>
                <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-6">
                  {/* Basic Information */}
                  {validationErrors.length > 0 && (
                    <div className="bg-danger-500/10 text-danger-500 border border-danger-500/20 p-3 rounded mt-4 space-y-1 text-sm">
                      {validationErrors.map((error, index) => (
                        <div key={index}>• {error}</div>
                      ))}
                    </div>
                  )}

                  <div>
                    <h3 className="text-base font-medium mb-4">Basic Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div>
                        <label htmlFor="description" className="block text-sm text-gray-400 mb-1.5">Description *</label>
                        <input
                          type="text"
                          id="description"
                          className="w-full bg-[#1e293b] border border-[#334155] rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-[#f0b90b]"
                          value={formData.Description}
                          onChange={(e) => setFormData({ ...formData, Description: e.target.value })}
                          required
                          placeholder="e.g., BTC-Scalping-Pro"
                        />
                      </div>

                      <div>
                        <label htmlFor="indicatorId" className="block text-sm text-gray-400 mb-1.5">Indicator</label>
                        <select
                          id="indicatorId"
                          className="w-full bg-[#1e293b] border border-[#334155] rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-[#f0b90b]"
                          value={formData.indicatorId?.toString() ?? ''}
                          onChange={handleChangeIndicator}
                        >
                          <option value="">Select indicator...</option>
                          {indicators.map((ind) => (
                            <option key={ind.id} value={ind.id.toString()}>
                              {ind.name} ({ind.symbol})
                            </option>
                          ))}
                        </select>
                      </div>





                      <div className="hidden">
                        <label htmlFor="streamStatus" className="block text-sm text-gray-400 mb-1.5">Stream Status</label>
                        <select
                          id="streamStatus"
                          className="w-full bg-[#1e293b] border border-[#334155] rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-[#f0b90b]"
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



                      {isDev && (
                        <div>
                          <label htmlFor="internalAccountId" className="block text-sm text-gray-400 mb-1.5">Internal Account ID</label>
                          <input
                            type="number"
                            id="internalAccountId"
                            className="w-full bg-[#1e293b] border border-[#334155] rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-[#f0b90b] bg-[#334155] cursor-not-allowed"
                            value={formData.InternalAccountId}
                            readOnly
                            disabled
                          />
                        </div>
                      )}


                      <div>
                        <label htmlFor="binanceAccountId" className="block text-sm text-gray-400 mb-1.5">Binance Account</label>
                        <select
                          id="binanceAccountId"
                          className="w-full bg-[#1e293b] border border-[#334155] rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-[#f0b90b]"
                          value={formData.BinanceAccountId}
                          onChange={(e) =>
                            setFormData({ ...formData, BinanceAccountId: e.target.value })
                          }
                        >
                          <option value="">Select account...</option>
                          {binanceAccounts.map((acc) => {
                            const showId = user?.role === 'admin' || user?.role === 'superadmin' || isDev;
                            const label = showId ? `${acc.name} (ID: ${acc.id})` : acc.name;

                            return (
                              <option key={acc.id} value={acc.id.toString()}>
                                {label}
                              </option>
                            );
                          })}
                        </select>
                      </div>






                    </div>
                  </div>

                  {/* Status and Type */}
                  <div>
                    <h3 className="text-base font-medium mb-4">Status & Type Configuration</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                      {/*<div>
                    <label htmlFor="status" className="block text-sm text-gray-400 mb-1.5">Status</label>
                    <select
                      id="status"
                      className="w-full bg-[#1e293b] border border-[#334155] rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-[#f0b90b]"
                      value={formData.Status}
                      onChange={(e) => setFormData({ ...formData, Status: parseInt(e.target.value) })}
                    >
                      <option value={0}>Inactive</option>
                      <option value={1}>Active</option>
                      <option value={2}>Paused</option>
                    </select>
                  </div>*/}

                      {SHOW_TYPE && (
                        <div>
                          <label htmlFor="type" className="block text-sm text-gray-400 mb-1.5">Type</label>
                          <select
                            id="type"
                            className="w-full bg-[#1e293b] border border-[#334155] rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-[#f0b90b]"
                            value={formData.Type}
                            onChange={(e) => setFormData({ ...formData, Type: parseInt(e.target.value) })}
                          >
                            <option value={0}>Basic</option>
                            <option value={1}>Advanced</option>
                            <option value={2}>Premium</option>
                          </select>
                        </div>
                      )}
                      {/* <div>
                    <label htmlFor="strategyId" className="block text-sm text-gray-400 mb-1.5">Strategy ID</label>
                    <input
                      type="number"
                      id="strategyId"
                      className="w-full bg-[#1e293b] border border-[#334155] rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-[#f0b90b]"
                      value={formData.StrategyId}
                      onChange={(e) => setFormData({ ...formData, StrategyId: e.target.value })}
                      placeholder="Optional"
                    />
                  </div>*/}

                      <div>
                        <label htmlFor="capitalUsageRatio" className="block text-sm text-gray-400 mb-1.5">Capital Usage %</label>
                        <input
                          type="number"
                          id="capitalUsageRatio"
                          className="w-full bg-[#1e293b] border border-[#334155] rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-[#f0b90b]"
                          value={formData.CapitalUsageRatio}
                          onChange={(e) => setFormData({ ...formData, CapitalUsageRatio: e.target.value })}
                          min="1"
                          max="100"
                          placeholder="10"
                        />
                      </div>
                      <div className="lg:col-span-2 gap-2">
                        <div className="lg:col-span-2 grid grid-cols-2 gap-4">

                          <div>
                            <label htmlFor="marginType" className="block text-sm text-gray-400 mb-1.5">Margin Type</label>
                            <select
                              id="marginType"
                              className="w-full bg-[#1e293b] border border-[#334155] rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-[#f0b90b]"
                              value={formData.MarginType}
                              onChange={(e) => {
                                const newMargin = e.target.value as 'ISOLATED' | 'CROSS';
                                setFormData({
                                  ...formData,
                                  MarginType: newMargin,
                                  Leverage: newMargin === 'CROSS' ? '1x' : formData.Leverage,
                                });
                              }}
                            >
                              <option value="CROSS">CROSSED</option>
                              <option value="ISOLATED">ISOLATED</option>

                            </select>
                          </div>

                          <div>
                            <label className="block text-sm text-gray-400 mb-1.5">Leverage</label>
                            <button
                              type="button"
                              className="w-full bg-[#1e293b] border border-[#334155] rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-[#f0b90b] text-left cursor-pointer"
                              onClick={() => setShowLeveragePopup(true)}
                            >
                              {formData.Leverage}x
                            </button>
                          </div>
                        </div>
                        {showLeveragePopup && (
                          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                            <div className="bg-[#0f172a] rounded-lg shadow-lg w-full max-w-md">
                              <div className="p-6 space-y-4">
                                <div className="flex justify-between items-center">
                                  <h2 className="text-lg font-bold">Điều chỉnh đòn bẩy</h2>
                                  <button onClick={() => setShowLeveragePopup(false)}>
                                    <XCircle className="h-5 w-5 text-gray-400 hover:text-red-500" />
                                  </button>
                                </div>

                                <div className="text-center font-semibold text-2xl">
                                  {formData.Leverage}x
                                </div>

                                <input
                                  type="range"
                                  min={1}
                                  max={125}
                                  value={Number(formData.Leverage) || 1}
                                  onChange={(e) =>
                                    setFormData({ ...formData, Leverage: e.target.value })
                                  }
                                  className="w-full"
                                />
                                <div className="flex justify-between text-xs text-gray-400">
                                  {[1, 25, 50, 75, 100, 125].map((v) => (
                                    <span key={v}>{v}x</span>
                                  ))}
                                </div>

                                <div className="text-sm text-gray-300 space-y-1 mt-2">
                                  <p>* Vị thế tối đa 200,000,000 USDT</p>
                                  <p>
                                    Xin lưu ý rằng việc thay đổi đòn bẩy sẽ áp dụng cho các vị thế mở
                                    và lệnh đang mở.
                                  </p>
                                  <p className="text-red-500">
                                    * Khi chọn đòn bẩy cao hơn, chẳng hạn như [10x], rủi ro thanh lý sẽ
                                    tăng lên. Hãy kiểm soát mức độ rủi ro của bạn.
                                  </p>
                                </div>

                                <button
                                  className="btn bg-primary-500 hover:bg-primary-600 text-white w-full"
                                  onClick={() => setShowLeveragePopup(false)}
                                >
                                  Xác nhận
                                </button>
                              </div>
                            </div>
                          </div>
                        )}

                      </div>

                    </div>
                  </div>

                  {/* Trading Configuration */}

                  <div>
                    <h3 className="text-base font-medium mb-4">Trading Configuration</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {SHOW_ORDER_PRICE && (
                        <div>
                          <label htmlFor="orderPrice" className="block text-sm text-gray-400 mb-1.5">Order Price</label>
                          <input
                            type="text"
                            id="orderPrice"
                            className="w-full bg-[#1e293b] border border-[#334155] rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-[#f0b90b]"
                            value={formData.OrderPrice}
                            onChange={(e) => setFormData({ ...formData, OrderPrice: e.target.value })}
                            placeholder="0.19189"
                          />
                        </div>
                      )}
                      <div>
                        <label htmlFor="stopLost" className="block text-sm text-gray-400 mb-1.5">Stop Lost</label>
                        <input
                          type="number"
                          id="stopLost"
                          className="w-full bg-[#1e293b] border border-[#334155] rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-[#f0b90b]"
                          value={formData.StopLost}
                          onChange={(e) => setFormData({ ...formData, StopLost: e.target.value })}
                          step="0.01"
                          placeholder="0.1"
                        />
                      </div>

                      <div>
                        <label htmlFor="takeProfit" className="block text-sm text-gray-400 mb-1.5">Take Profit</label>
                        <input
                          type="number"
                          id="takeProfit"
                          className="w-full bg-[#1e293b] border border-[#334155] rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-[#f0b90b]"
                          value={formData.TakeProfit}
                          onChange={(e) => setFormData({ ...formData, TakeProfit: e.target.value })}
                          step="0.01"
                          placeholder="1"
                        />
                      </div>

                      {/* <div>
                    <label htmlFor="orderId" className="block text-sm text-gray-400 mb-1.5">Order ID</label>
                    <input
                      type="text"
                      id="orderId"
                      className="w-full bg-[#1e293b] border border-[#334155] rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-[#f0b90b]"
                      value={formData.OrderId}
                      onChange={(e) => setFormData({ ...formData, OrderId: e.target.value })}
                      placeholder="74753557217"
                    />
                  </div>*/}
                    </div>
                  </div>

                  {/* Trailing Stop Configuration */}
                  {/*<div>
                <h3 className="text-base font-medium mb-4">Trailing Stop Configuration</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label htmlFor="trailingStop" className="block text-sm text-gray-400 mb-1.5">Trailing Stop</label>
                    <select
                      id="trailingStop"
                      className="w-full bg-[#1e293b] border border-[#334155] rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-[#f0b90b]"
                      value={formData.TrailingStop}
                      onChange={(e) => setFormData({ ...formData, TrailingStop: parseInt(e.target.value) })}
                    >
                      <option value={0}>Disabled</option>
                      <option value={1}>Enabled</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="trailingStopPercent" className="block text-sm text-gray-400 mb-1.5">Trailing Stop %</label>
                    <input
                      type="number"
                      id="trailingStopPercent"
                      className="w-full bg-[#1e293b] border border-[#334155] rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-[#f0b90b]"
                      value={formData.TrailingStopPercent}
                      onChange={(e) => setFormData({ ...formData, TrailingStopPercent: e.target.value })}
                      step="0.1"
                      placeholder="1"
                    />
                  </div>

                  <div>
                    <label htmlFor="trailingStopValue" className="block text-sm text-gray-400 mb-1.5">Trailing Stop Value</label>
                    <input
                      type="number"
                      id="trailingStopValue"
                      className="w-full bg-[#1e293b] border border-[#334155] rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-[#f0b90b]"
                      value={formData.TrailingStopValue}
                      onChange={(e) => setFormData({ ...formData, TrailingStopValue: e.target.value })}
                      step="0.01"
                      placeholder="0.3"
                    />
                  </div>

                  <div>
                    <label htmlFor="thresholdPercent" className="block text-sm text-gray-400 mb-1.5">Threshold %</label>
                    <input
                      type="number"
                      id="thresholdPercent"
                      className="w-full bg-[#1e293b] border border-[#334155] rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-[#f0b90b]"
                      value={formData.thresholdPercent}
                      onChange={(e) => setFormData({ ...formData, thresholdPercent: e.target.value })}
                      step="0.1"
                      placeholder="2.5"
                    />
                  </div>
                </div>
              </div> */}

                  {/* ATR Configuration */}
                  {/* <div>
                <h3 className="text-base font-medium mb-4">ATR Configuration</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label htmlFor="atr" className="block text-sm text-gray-400 mb-1.5">ATR</label>
                    <select
                      id="atr"
                      className="w-full bg-[#1e293b] border border-[#334155] rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-[#f0b90b]"
                      value={formData.ATR}
                      onChange={(e) => setFormData({ ...formData, ATR: parseInt(e.target.value) })}
                    >
                      <option value={0}>Disabled</option>
                      <option value={1}>Enabled</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="atrPercent" className="block text-sm text-gray-400 mb-1.5">ATR %</label>
                    <input
                      type="number"
                      id="atrPercent"
                      className="w-full bg-[#1e293b] border border-[#334155] rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-[#f0b90b]"
                      value={formData.ATRPercent}
                      onChange={(e) => setFormData({ ...formData, ATRPercent: e.target.value })}
                      step="0.1"
                      placeholder="1.5"
                    />
                  </div>

                  <div>
                    <label htmlFor="atrValue" className="block text-sm text-gray-400 mb-1.5">ATR Value</label>
                    <input
                      type="number"
                      id="atrValue"
                      className="w-full bg-[#1e293b] border border-[#334155] rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-[#f0b90b]"
                      value={formData.ATRValue}
                      onChange={(e) => setFormData({ ...formData, ATRValue: e.target.value })}
                      step="0.001"
                      placeholder="0.02"
                    />
                  </div>
                </div>
              </div>*/}

                  {/* Trend Configuration */}
                  <div>
                    {/* <h3 className="text-base font-medium mb-4">Trend Configuration</h3>*/}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/*  <div>
                    <label htmlFor="trendStatus" className="block text-sm text-gray-400 mb-1.5">Trend Status</label>
                    <select
                      id="trendStatus"
                      className="w-full bg-[#1e293b] border border-[#334155] rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-[#f0b90b]"
                      value={formData.TrendStatus}
                      onChange={(e) => setFormData({ ...formData, TrendStatus: parseInt(e.target.value) })}
                    >
                      <option value={0}>Inactive</option>
                      <option value={1}>Active</option>
                    </select>
                  </div>*/}
                      {SHOW_TYPE && (
                        <div>
                          <label htmlFor="trendType" className="block text-sm text-gray-400 mb-1.5">Trend Type</label>
                          <select
                            id="trendType"
                            className="w-full bg-[#1e293b] border border-[#334155] rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-[#f0b90b]"
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

                  <div className="flex justify-end gap-2 pt-4 border-t border-[#334155]">
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

         {/* Pause/Resume Confirmation Modal */}
{togglingStream !== null && (
  <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
    <div className="bg-[#1e293b] border border-[#334155] rounded-xl w-full max-w-md">
      <div className="p-6">
        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-yellow-500/20 mx-auto mb-4">
          <AlertTriangle className="h-6 w-6 text-yellow-400" />
        </div>

        <h3 className="text-lg font-semibold text-center mb-2 text-white">
          {togglingStream.Status === 1 ? 'Pause Trading Stream' : 'Resume Trading Stream'}
        </h3>

        <p className="text-gray-400 text-center mb-6 leading-relaxed">
          Are you sure you want to {togglingStream.Status === 1 ? 'pause' : 'resume'} the stream{' '}
          <span className="text-[#f0b90b] font-semibold break-words">{togglingStream.Description}</span>?
        </p>

        <div className="flex justify-center gap-3">
          <button
            className="px-5 py-2.5 text-gray-400 hover:text-white border border-[#334155] rounded-lg hover:bg-[#334155] transition-colors"
            onClick={() => setTogglingStream(null)}
          >
            Cancel
          </button>

          <button
            className="px-5 py-2.5 bg-[#f0b90b] hover:bg-[#d4a50a] text-black font-semibold rounded-lg transition-colors"
            onClick={async () => {
              if (!togglingStream) return;
              const nextStatus = togglingStream.Status === 1 ? 0 : 1;
              await handleStatusToggle(togglingStream, nextStatus);
              setTogglingStream(null);
            }}
          >
            {togglingStream.Status === 1 ? 'Pause Stream' : 'Resume Stream'}
          </button>
        </div>
      </div>
    </div>
  </div>
)}



          {/* Delete Confirmation Modal */}
          {deletingStream && (
            <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
              <div className="bg-[#1e293b] border border-[#334155] rounded-xl w-full max-w-md">
                <div className="p-6">
                  <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-500/20 mx-auto mb-4">
                    <AlertTriangle className="h-6 w-6 text-red-400" />
                  </div>

                  <h3 className="text-lg font-semibold text-center mb-2 text-white">Delete Trading Stream</h3>

                  <p className="text-gray-400 text-center mb-6">
                    Are you sure you want to delete the trading stream "{deletingStream.Description}"? This action cannot be undone.
                  </p>

                  <div className="flex justify-center gap-3">
                    <button
                      className="px-5 py-2.5 text-gray-400 hover:text-white border border-[#334155] rounded-lg hover:bg-[#334155] transition-colors"
                      onClick={() => setDeletingStream(null)}
                    >
                      Cancel
                    </button>
                    <button
                      className="px-5 py-2.5 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-lg transition-colors"
                      onClick={confirmDelete}
                    >
                      Delete Stream
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
          {showUpdateConfirm && (
  <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
    <div className="bg-[#1e293b] border border-[#334155] rounded-xl w-full max-w-md">
      <div className="p-6">
        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-yellow-500/20 mx-auto mb-4">
          <AlertTriangle className="h-6 w-6 text-yellow-400" />
        </div>
        <h3 className="text-lg font-semibold text-center text-white mb-2">Xác nhận cập nhật Stream</h3>
        <p className="text-gray-400 text-center mb-6">
          Bạn có chắc chắn muốn <span className="text-[#f0b90b] font-semibold">cập nhật</span> stream này?
        </p>
        <div className="flex justify-center gap-3">
          <button
            className="px-5 py-2.5 text-gray-400 hover:text-white border border-[#334155] rounded-lg hover:bg-[#334155] transition-colors"
            onClick={() => setShowUpdateConfirm(false)}
          >
            Hủy
          </button>
          <button
            className="px-5 py-2.5 bg-[#f0b90b] hover:bg-[#d4a50a] text-black font-semibold rounded-lg transition-colors"
            onClick={submitStream}
          >
            Xác nhận cập nhật
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