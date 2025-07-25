import React, { useState, useEffect, useRef } from 'react';
import { Plus, Search, Filter, Edit, Trash2, CheckCircle, XCircle, AlertTriangle,ViewIcon } from 'lucide-react';
import { indicatorApi } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { FormattedDate, FormattedTime } from 'react-intl';
interface Indicator {
  id: number;
  Name: string;
  Symbol: string;
  Leverage: string;
  MarginType: string;
  Description: string;
  LongText: string;
  ShortText: string;
  ExitText: string;
  Status: number;
  create_time: string;
  update_time: string;
  IndicatorType: string;
  IndicatorTimeframe: string;
  IndicatorCandles: string;
}

export default function Indicators() {
  const [indicators, setIndicators] = useState<Indicator[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingIndicator, setEditingIndicator] = useState<Indicator | null>(null);
  const [deletingIndicator, setDeletingIndicator] = useState<Indicator | null>(null);
  const { user } = useAuth();
  const [tvPopupOpen, setTvPopupOpen] = useState(false);
  const [selectedIndicator, setSelectedIndicator] = useState<any | null>(null);
  const [messageContent, setMessageContent] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<'long' | 'short' | 'exit_long' | 'exit_short' | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);


  const [formData, setFormData] = useState<Omit<Indicator, 'id' | 'create_time' | 'update_time'>>({
    Name: '',
    Symbol: '',
    Leverage: '1',
    MarginType: 'ISOLATED',
    Description: '',
    LongText: '',
    ShortText: '',
    ExitText: '',
    Status: 1,
    IndicatorType: '',
    IndicatorTimeframe: '',
    IndicatorCandles: ''
  });

  useEffect(() => {
    console.log('✅ Mapped indicators:', indicators);
    const fetchIndicators = async () => {
      try {
        let response;
        if (user?.role === 'admin' || user?.role === 'superadmin') {
          response = await indicatorApi.getAllIndicatorConfigs(); // Admin xem tất cả
        } else {
          response = await indicatorApi.getMyActiveIndicators(); // User chỉ xem indicator được gán cho họ
        }
        let rawIndicators: any[] = [];

        if (user?.role === 'admin' || user?.role === 'superadmin') {
          if (Array.isArray(response?.Data)) {
            rawIndicators = response.Data;
          } else {
            rawIndicators = response?.Data?.indicators ?? [];
          }
        } else {
          rawIndicators = Array.isArray(response?.Data) ? response.Data : [];
        }



        const mappedIndicators = rawIndicators.map((ind: any) => ({

          id: ind.id,
          Name: ind.Name,
          Symbol: ind.Symbol,
          Leverage: ind.Leverage,
          MarginType: ind.MarginType,
          Description: ind.Description,
          LongText: ind.LongText,
          ShortText: ind.ShortText,
          ExitText: ind.ExitText,
          Status: ind.Status,
          create_time: ind.create_time,
          update_time: ind.update_time ?? 'N/A'
        }));

        setIndicators(mappedIndicators);
      } catch (error) {
        console.error('Failed to fetch indicators:', error);
      }
    };

    fetchIndicators();
  }, []);


  const filteredIndicators = indicators
  .filter(ind => {
    const query = searchQuery.toLowerCase();
    return (
      ind.Name.toLowerCase().includes(query) ||
      ind.Symbol.toLowerCase().includes(query) ||
      ind.Description.toLowerCase().includes(query)
    );
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const payload = {
        ...formData,
        LongText: formData.LongText?.trim() || 'BUY,LONG',
        ShortText: formData.ShortText?.trim() || 'SELL,SHORT',
        ExitText: formData.ExitText?.trim() || 'EXIT,LONG EXIT,SHORT EXIT,SL,TP1',
        IndicatorType: formData.IndicatorType || 'SIDEWAY',
        IndicatorTimeframe: formData.IndicatorTimeframe || '1m',
        IndicatorCandles: formData.IndicatorCandles || '100'
      };

      console.log('📤 Payload gửi lên:', payload);

      if (editingIndicator) {
        // ✅ Update: cần id
        console.log('✅ Editing indicator ID:', editingIndicator.id);
        
        console.log('✅ Payload FINAL gọi API update:', {
  ...payload,
  id: editingIndicator?.id,
});
await indicatorApi.updateIndicatorConfig({
  ...payload,
  id: editingIndicator?.id,
});
      } else {
        // ✅ Create: KHÔNG truyền id
        const { id, ...createPayload } = payload; // ← gỡ id ra khỏi object
        await indicatorApi.createIndicatorConfig(createPayload);
      }

      await loadIndicators();

      setIsFormOpen(false);
      setEditingIndicator(null);
      setFormData({
        Name: '',
        Symbol: '',
        Leverage: '1',
        MarginType: 'ISOLATED',
        Description: '',
        LongText: '',
        ShortText: '',
        ExitText: '',
        Status: 1,
        IndicatorType: '',
        IndicatorTimeframe: '',
        IndicatorCandles: ''
      });
    } catch (err: any) {
      console.error('❌ Lỗi khi submit Indicator:', err);
      console.log('📛 Chi tiết từ backend:', err.response?.data || err.message);
      alert('❌ Lỗi khi lưu indicator. Kiểm tra console để biết thêm chi tiết.');
    }
  };







  const handleEdit = (indicator: Indicator) => {
    setEditingIndicator(indicator);
    setFormData({
      Name: indicator.Name,
      Symbol: indicator.Symbol,
      Leverage: indicator.Leverage,
      MarginType: indicator.MarginType,
      Description: indicator.Description,
      LongText: indicator.LongText,
      ShortText: indicator.ShortText,
      ExitText: indicator.ExitText,
      Status: indicator.Status,
      IndicatorType: indicator.IndicatorType || 'SIDEWAY',
      IndicatorTimeframe: indicator.IndicatorTimeframe || '1m',
      IndicatorCandles: indicator.IndicatorCandles || '100'
    });
    setIsFormOpen(true);
  };

  const handleDelete = (indicator: Indicator) => {
    setDeletingIndicator(indicator);
  };

  const confirmDelete = async () => {
    if (!deletingIndicator) return;

    try {
      // Gọi API xóa ở backend
      await indicatorApi.deleteIndicatorConfig(deletingIndicator.id);

      // Cập nhật lại danh sách từ backend
      await loadIndicators();

      // Reset state
      setDeletingIndicator(null);
    } catch (err) {
      console.error('❌ Lỗi khi xóa indicator:', err);
      alert('❌ Không thể xóa indicator. Vui lòng kiểm tra console.');
    }
  };

  const loadIndicators = async () => {
    try {
      const response = await indicatorApi.getAllIndicatorConfigs();
      const raw = response?.Data?.indicators ?? [];

      const mapped = raw.map((ind: any) => ({
        id: ind.id,
        Name: ind.Name,
        Symbol: ind.Symbol,
        Leverage: ind.Leverage,
        MarginType: ind.MarginType,
        Description: ind.Description,
        LongText: ind.LongText,
        ShortText: ind.ShortText,
        ExitText: ind.ExitText,
        Status: ind.Status,
        create_time: ind.create_time,
        update_time: ind.update_time
      }));

      setIndicators(mapped);
    } catch (err) {
      console.error('❌ Lỗi khi load indicators:', err);
    }
  };

  const generateMessage = (type: 'long' | 'short' | 'exit_long' | 'exit_short') => {
    if (!selectedIndicator) return '';
    const message = {
      indicatorMessage: {
        strategy: selectedIndicator.Name,
        indicator: selectedIndicator.Name,
        type: type === 'long' ? 'long' : type === 'short' ? 'short' : 'exit',
        action: type === 'short' || type === 'exit_short' ? 'SELL entry' : 'BUY entry',
        position: type === 'short' || type === 'exit_short' ? 'SELL' : 'BUY',
        general: {
          ticker: "{{ticker}}",
          exchange: "{{exchange}}",
          interval: "{{interval}}",
          time: "{{time}}",
          timenow: "{{timenow}}"
        },
        symbolData: {
          volume: "{{volume}}",
          high: "{{high}}",
          open: "{{open}}",
          close: "{{close}}"
        },
        currency: {
          quote: "{{syminfo.currency}}",
          base: "{{syminfo.basecurrency}}"
        }
      }
    };

    return JSON.stringify(message, null, 2);
  };
  const showStaticMessage = (type: 'long' | 'short' | 'exit_long' | 'exit_short') => {
    setSelectedType(type);
    setTimeout(() => {
      contentRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };
  const openTvPopup = (indicator: Indicator) => {
    setSelectedIndicator(indicator);
    setTvPopupOpen(true);
    setSelectedType(null); // reset lại selectedType mỗi lần mở mới
  };

const getCoinIcon = (symbol: string): string => {
  const normalized = symbol.toUpperCase();

  if (normalized.includes('PEPE')) return '/icons/pepe.png';
  if (normalized.includes('DOGE')) return '/icons/doge.png';
  if (normalized.includes('BTC')) return '/icons/btc.png';
  if (normalized.includes('ETH')) return '/icons/eth.png';
  if (normalized.includes('SOL')) return '/icons/sol.png';
  if (normalized.includes('SHIB')) return '/icons/shib.png';

  return '/icons/default-coin.png'; // fallback
};

const getExchangeLabel = (symbol: string): { icon: string; label: string } => {
  const s = symbol.toUpperCase();

  if (s.includes('PEPE')) return { icon: '/icons/binance.svg', label: 'Binance Futures USDT-M' };
  if (s.includes('DOGE')) return { icon: '/icons/binance.svg', label: 'Binance Futures USDT-M' };
  if (s.includes('BTC')) return { icon: '/icons/binance.svg', label: 'Binance Spot' };

  return { icon: '/icons/default-exchange.svg', label: 'Unknown Exchange' };
};


  return (
    <div className="w-full max-w-full overflow-x-hidden">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Indicators</h1>
            <p className="text-dark-400">Manage trading indicators and signals</p>
          </div>
          {(user?.role === 'admin' || user?.role === 'superadmin') && (
            <button
              className="btn btn-primary"
              onClick={() => {
                setEditingIndicator(null);
                setIsFormOpen(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Indicator
            </button>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <Search className="h-4 w-4 text-dark-400" />
            </div>
            <input
              type="text"
              className="form-input pl-10"
              placeholder="Search indicators..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-hidden">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
  {filteredIndicators.map((indicator) => (
    <div
      key={indicator.id}
      className="card bg-dark-800 border border-dark-700 rounded-lg p-4 relative hover:ring-2 hover:ring-primary-500 transition"
    >
      {/* Header: Name */}
      <div className="flex items-center space-x-2 mb-1">
        <div className="text-xl">🤖</div>
        <h3 className="text-lg font-semibold">{indicator.Name}</h3>
      </div>

      {/* Description */}
      <p className="text-sm text-dark-400 mb-2 line-clamp-2">
        {indicator.Description || 'No description provided'}
      </p>

      {/* Placeholder Sparkline */}
     {/* <div className="h-[45px] bg-dark-600 rounded flex items-center justify-center text-dark-400 text-xs mb-3">
        Sparkline
      </div>*/}

      {/* Symbol + Status */}
      <div className="flex justify-between text-sm text-dark-300">
        <div>{indicator.Symbol}</div>
        <div className={`${indicator.Status === 1 ? 'text-success-500' : 'text-danger-500'}`}>
          {indicator.Status === 1 ? 'Active' : 'Inactive'}
        </div>
      </div>
      {/* Exchange info */}
<div className="mt-4 flex items-center justify-center space-x-2 text-xs text-dark-300">
  <img
    src={getExchangeLabel(indicator.Symbol).icon}
    alt="exchange"
    className="h-4 w-4"
  />
  <span>{getExchangeLabel(indicator.Symbol).label}</span>
</div>

      {/* Last updated */}
      <div className="mt-3 text-xs text-dark-500 mt-1">
  {indicator.update_time && !isNaN(Date.parse(indicator.update_time)) ? (
    <>
      <FormattedDate value={new Date(indicator.update_time)} />{' '}
      <FormattedTime value={new Date(indicator.update_time)} />
    </>
  ) : (
    'N/A'
  )}
</div>

      {/* 3 buttons: 📈 ✏️ 🗑️ */}
      <div className="absolute bottom-3 right-3 flex space-x-3 text-dark-400">
        <button onClick={() => openTvPopup(indicator)} className="hover:text-primary-500">
          📈
        </button>
        <button onClick={() => handleEdit(indicator)} className="hover:text-yellow-500">
          <Edit className="h-4 w-4" />
        </button>
        <button onClick={() => handleDelete(indicator)} className="hover:text-danger-500">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  ))}

  {filteredIndicators.length === 0 && (
    <div className="text-center col-span-full text-dark-400 italic">No indicators found.</div>
  )}
</div>

        </div>

        {/* Form Modal */}
        {isFormOpen && (
          <div className="fixed inset-0 bg-dark-900/80 flex items-center justify-center p-4 z-50">
            <div className="card w-full max-w-2xl">
              <div className="card-header flex justify-between items-center">
                <h2 className="text-lg font-medium">
                  {editingIndicator ? 'Edit Indicator' : 'Add New Indicator'}
                </h2>
                <button
                  className="text-dark-400 hover:text-dark-300"
                  onClick={() => {
                    setIsFormOpen(false);
                    setEditingIndicator(null);
                  }}
                >
                  <XCircle className="h-5 w-5" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div>
                  <label htmlFor="name" className="form-label">Name</label>
                  <input
                    type="text"
                    id="name"
                    className="form-input"
                    value={formData.Name}
                    onChange={(e) => setFormData({ ...formData, Name: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label htmlFor="symbol" className="form-label">Symbol</label>
                  <input
                    type="text"
                    id="symbol"
                    className="form-input"
                    value={formData.Symbol}
                    onChange={(e) => setFormData({ ...formData, Symbol: e.target.value })}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="leverage" className="form-label">Leverage</label>
                    <input
                      type="text"
                      id="leverage"
                      className="form-input"
                      value={formData.Leverage}
                      onChange={(e) => setFormData({ ...formData, Leverage: e.target.value })}
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="marginType" className="form-label">Margin Type</label>
                    <select
                      id="marginType"
                      className="form-select"
                      value={formData.MarginType}
                      onChange={(e) => setFormData({ ...formData, MarginType: e.target.value })}
                      required
                    >
                      <option value="ISOLATED">ISOLATED</option>
                      <option value="CROSSED">CROSSED</option>
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
                    required
                  />
                </div>
                {/*<div>
              <div>
                <label htmlFor="longText" className="form-label">Long Text</label>
                <input
                  type="text"
                  id="longText"
                  className="form-input"
                  value={formData.LongText}
                  onChange={(e) => setFormData({ ...formData, LongText: e.target.value })}
                  required
                />
              </div>

              <div>
                <label htmlFor="shortText" className="form-label">Short Text</label>
                <input
                  type="text"
                  id="shortText"
                  className="form-input"
                  value={formData.ShortText}
                  onChange={(e) => setFormData({ ...formData, ShortText: e.target.value })}
                  required
                />
              </div>

              <div>
                <label htmlFor="exitText" className="form-label">Exit Text</label>
                <input
                  type="text"
                  id="exitText"
                  className="form-input"
                  value={formData.ExitText}
                  onChange={(e) => setFormData({ ...formData, ExitText: e.target.value })}
                  required
                />
              </div>
</div>*/}
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

                <div className="flex justify-end space-x-2 pt-4">
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => {
                      setIsFormOpen(false);
                      setEditingIndicator(null);
                    }}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    {editingIndicator ? 'Update' : 'Add'} Indicator
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deletingIndicator && (
          <div className="fixed inset-0 bg-dark-900/80 flex items-center justify-center p-4 z-50">
            <div className="card w-full max-w-md">
              <div className="p-6">
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-danger-500/10 mx-auto mb-4">
                  <AlertTriangle className="h-6 w-6 text-danger-500" />
                </div>

                <h3 className="text-lg font-medium text-center mb-2">Delete Indicator</h3>

                <p className="text-dark-400 text-center mb-6">
                  Are you sure you want to delete the indicator "{deletingIndicator.Name}"? This action cannot be undone.
                </p>

                <div className="flex justify-center space-x-3">
                  <button
                    className="btn btn-outline"
                    onClick={() => setDeletingIndicator(null)}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn bg-danger-500 hover:bg-danger-600 text-white"
                    onClick={confirmDelete}
                  >
                    Delete Indicator
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}


        {tvPopupOpen && selectedIndicator && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <div className="bg-dark-900 dark:bg-dark-800 p-6 rounded-lg w-full max-w-xl relative overflow-y-auto max-h-[90vh]">
              <button
                onClick={() => setTvPopupOpen(false)}
                className="absolute top-2 right-2 text-dark-400 hover:text-danger-500"
              >
                ✖
              </button>



              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-center">Signal Preview: {selectedIndicator?.Name}</h2>
                <p className="text-sm text-dark-400 text-center">
                  API Webhook: <code className="text-primary-500">http://45.77.33.141/listen/indicator</code>
                </p>

                {/* 4 nút chia 2 hàng, 2 cột */}
                <div className="grid grid-cols-2 gap-4">
                  <button className="btn btn-primary w-full" onClick={() => setSelectedType('long')}>Long Message</button>
                  <button className="btn btn-primary w-full" onClick={() => setSelectedType('short')}>Short Message</button>
                  <button className="btn btn-primary w-full" onClick={() => setSelectedType('exit_long')}>Exit Long</button>
                  <button className="btn btn-primary w-full" onClick={() => setSelectedType('exit_short')}>Exit Short</button>
                </div>

                {/* Nếu có selectedType thì hiện message JSON */}
                {selectedType && (
                  <pre className="mt-4 text-sm bg-dark-700 text-white p-4 rounded whitespace-pre-wrap break-all max-h-[400px] overflow-auto">
                    {generateMessage(selectedType)}
                  </pre>
                )}
              </div>

            </div>
          </div>
        )}



      </div>
    </div>
  );
}