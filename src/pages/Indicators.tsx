import React, { useState, useEffect } from 'react';
import { Plus, Search, Filter, Edit, Trash2, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { indicatorApi } from '../utils/api';
import { useAuth } from '../context/AuthContext';
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

  const [formData, setFormData] = useState<Omit<Indicator, 'id' | 'create_time' | 'update_time'>>({
    Name: '',
    Symbol: '',
    Leverage: '1',
    MarginType: 'ISOLATED',
    Description: '',
    LongText: '',
    ShortText: '',
    ExitText: '',
    Status: 1
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
      const rawIndicators = response?.Data?.indicators ?? [];


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
        update_time: ind.update_time,
      }));

      setIndicators(mappedIndicators);
    } catch (error) {
      console.error('Failed to fetch indicators:', error);
    }
  };

  fetchIndicators();
}, []);


  const filteredIndicators = indicators.filter(indicator => {
    const matchesSearch = 
      indicator.Name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      indicator.Symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
      indicator.Description.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesSearch;
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const now = new Date().toISOString().replace('T', ' ').replace('Z', '+07');

    if (editingIndicator) {
      setIndicators(prevIndicators => 
        prevIndicators.map(ind => 
          ind.id === editingIndicator.id 
            ? {
                ...ind,
                ...formData,
                update_time: now
              }
            : ind
        )
      );
    } else {
      const newId = indicators.length > 0 
        ? Math.max(...indicators.map(i => i.id)) + 1 
        : 1;

      const newIndicator: Indicator = {
        id: newId,
        ...formData,
        create_time: now,
        update_time: now
      };

      setIndicators(prevIndicators => [...prevIndicators, newIndicator]);
    }

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
      Status: 1
    });
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
      Status: indicator.Status
    });
    setIsFormOpen(true);
  };

  const handleDelete = (indicator: Indicator) => {
    setDeletingIndicator(indicator);
  };

  const confirmDelete = () => {
    if (deletingIndicator) {
      setIndicators(indicators.filter(ind => ind.id !== deletingIndicator.id));
      setDeletingIndicator(null);
    }
  };
const loadIndicators = async () => {
  try {
    const res = await indicatorApi.getAllIndicatorConfigs();
    const raw = res?.Data?.indicators ?? [];
    setIndicators(raw);
    console.log('✅ Loaded indicators:', raw);
  } catch (err) {
    console.error('❌ Lỗi khi fetch indicators:', err);
  }
};
const openTvPopup = (indicator: any) => {
  setSelectedIndicator(indicator);
  setMessageContent(null); // reset nếu có message trước
  setTvPopupOpen(true);
};
const showStaticMessage = (type: 'long' | 'short' | 'exit_long' | 'exit_short') => {
  if (!selectedIndicator) return;

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
        time: "{{time}} ",
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

  setMessageContent(JSON.stringify(message, null, 2));
};



  return (
    <div className="w-full max-w-full overflow-x-hidden">
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Indicators</h1>
          <p className="text-dark-400">Manage trading indicators and signals</p>
        </div>
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

      <div className="card overflow-hidden">
        <div className="card overflow-x-auto w-full">
          <table className="min-w-[800px] w-full table-auto divide-y divide-dark-700">
            <thead>
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-dark-400">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-dark-400">Symbol</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-dark-400">Leverage</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-dark-400">Margin Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-dark-400">Description</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-dark-400">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-dark-400">Last Updated</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-dark-400">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-700">
              {filteredIndicators.map((indicator) => (
                <tr key={indicator.id} className="hover:bg-dark-700/40">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-medium">{indicator.Name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {indicator.Symbol}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {indicator.Leverage}x
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {indicator.MarginType}
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-dark-300">{indicator.Description}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      indicator.Status === 1
                        ? 'bg-success-500/10 text-success-500'
                        : 'bg-danger-500/10 text-danger-500'
                    }`}>
                      {indicator.Status === 1 ? (
                        <CheckCircle className="mr-1 h-3 w-3" />
                      ) : (
                        <XCircle className="mr-1 h-3 w-3" />
                      )}
                      {indicator.Status === 1 ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-dark-400">
                    {indicator.update_time}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                    <div className="flex justify-end space-x-2">
                      <button
    className="text-dark-400 hover:text-yellow-500"
    onClick={() => openTvPopup(indicator)}
  >
    📈
  </button>
                      <button
                        className="text-dark-400 hover:text-primary-500"
                        onClick={() => handleEdit(indicator)}
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        className="text-dark-400 hover:text-danger-500"
                        onClick={() => handleDelete(indicator)}
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
    <div className="bg-dark-900 dark:bg-dark-800 p-6 rounded-lg w-full max-w-xl relative">
      <button
        onClick={() => setTvPopupOpen(false)}
        className="absolute top-2 right-2 text-dark-400 hover:text-danger-500"
      >
        ✖
      </button>

      <h2 className="text-xl font-semibold mb-4 text-center">
        Signal Preview: {selectedIndicator?.Name}
      </h2>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <button className="btn btn-primary" onClick={() => showStaticMessage('long')}>Long Message</button>
        <button className="btn btn-primary" onClick={() => showStaticMessage('short')}>Short Message</button>
        <button className="btn btn-primary" onClick={() => showStaticMessage('exit_long')}>Exit Long</button>
        <button className="btn btn-primary" onClick={() => showStaticMessage('exit_short')}>Exit Short</button>
      </div>

      {messageContent && (
        <pre className="text-sm bg-dark-700 text-white p-4 rounded whitespace-pre-wrap break-all">
          {messageContent}
        </pre>
      )}
    </div>
  </div>
)}


    </div>
    </div>
  );
}