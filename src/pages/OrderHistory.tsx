import React, { useState, useEffect, useRef } from 'react';
import { ArrowDown, ArrowUp, Search, Filter, Calendar, RefreshCw, Plus, Edit, Trash2, Save, XCircle, AlertTriangle } from 'lucide-react';
import { FormattedMessage, FormattedNumber, FormattedDate } from 'react-intl';
import { orderHistoryApi, ApiError, API_BASE_URL } from '../utils/api';

interface Order {
  orderId: string;
  symbol: string;
  status: 'NEW' | 'FILLED' | 'CANCELED' | 'PARTIALLY_FILLED';
  clientOrderId: string;
  price: string;
  avgPrice: string;
  origQty: string;
  executedQty: string;
  cumQty: string;
  cumQuote: string;
  timeInForce: string;
  type: 'LIMIT' | 'MARKET' | 'STOP_LIMIT';
  reduceOnly: boolean;
  closePosition: boolean;
  side: 'BUY' | 'SELL';
  positionSide: string;
  stopPrice: string;
  workingType: string;
  priceProtect: boolean;
  origType: string;
  priceMatch: string;
  selfTradePreventionMode: string;
  goodTillDate: string;
  binanceAccount: string | null;
  indicatorCall: string;
  description: string | null;
  create_time: string;
  update_time: string;
}

interface OrderHistoryResponse {
  page: number;
  limit: number;
  data: Order[];
}

interface OrderForm {
  orderId: string;
  symbol: string;
  status: 'NEW' | 'FILLED' | 'CANCELED' | 'PARTIALLY_FILLED';
  price: string;
  origQty: string;
  executedQty: string;
  type: 'LIMIT' | 'MARKET' | 'STOP_LIMIT';
  side: 'BUY' | 'SELL';
  indicatorCall: string;
  description: string;
}

export default function OrderHistory() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [deletingOrder, setDeletingOrder] = useState<Order | null>(null);
  
  // Use ref to prevent double calls
  const isInitialMount = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);


const SHOW_ADD_ORDER=false;


  const [formData, setFormData] = useState<OrderForm>({
    orderId: '',
    symbol: '',
    status: 'NEW',
    price: '',
    origQty: '',
    executedQty: '',
    type: 'LIMIT',
    side: 'BUY',
    indicatorCall: '',
    description: ''
  });

  const fetchOrders = async (pageNum: number = 1, showLoading: boolean = true) => {
  try {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();

    if (showLoading) setLoading(true);
    setError(null);

    console.log(`📡 Fetching orders for page ${pageNum}...`);

    const response = await orderHistoryApi.getAllOrderHistory(pageNum, 20);

    if (response.Data && Array.isArray(response.Data.orders)) {
      const orders = response.Data.orders;
      const pagination = response.Data.pagination;

      setOrders(orders);

      // ✅ Nếu backend trả totalPages → dùng nó
      if (pagination?.totalPages) {
        setTotalPages(pagination.totalPages);
      } else {
        // Nếu không có thì ước lượng đơn giản
        setTotalPages(orders.length >= 20 ? pageNum + 1 : pageNum);
      }
    } else {
      setOrders([]);
      setTotalPages(1);
    }

  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      console.log('⚠️ Request was aborted');
      return;
    }

    console.error('❌ Error fetching orders:', err);

    if (err instanceof ApiError) {
      switch (err.status) {
        case 0:
          setError(!err.response
            ? 'Network connection failed. Please check the API URL and your internet.'
            : 'Unexpected response format from API.');
          break;
        case 401:
          setError('Unauthorized. Please login again.');
          break;
        case 403:
          setError('Access denied. You do not have permission to view order history.');
          break;
        case 404:
          setError('Order history service not found.');
          break;
        case 500:
          setError('Server error. Please try again later.');
          break;
        default:
          setError(err.message || 'Failed to fetch order history');
      }
    } else {
      setError('Network error. Please check your connection and try again.');
    }

    setOrders([]);
  } finally {
    setLoading(false);
    setRefreshing(false);
    abortControllerRef.current = null;
  }
};



  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchOrders(page, false);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    fetchOrders(newPage);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const now = new Date().toISOString();
    
    if (editingOrder) {
      // Update existing order
      setOrders(prevOrders => 
        prevOrders.map(order => 
          order.orderId === editingOrder.orderId 
            ? {
                ...order,
                symbol: formData.symbol,
                status: formData.status,
                price: formData.price,
                origQty: formData.origQty,
                executedQty: formData.executedQty,
                type: formData.type,
                side: formData.side,
                indicatorCall: formData.indicatorCall,
                description: formData.description,
                update_time: now
              }
            : order
        )
      );
    } else {
      // Create new order
      const newOrder: Order = {
        orderId: formData.orderId || `ORDER_${Date.now()}`,
        symbol: formData.symbol,
        status: formData.status,
        clientOrderId: `CLIENT_${Date.now()}`,
        price: formData.price,
        avgPrice: formData.price,
        origQty: formData.origQty,
        executedQty: formData.executedQty,
        cumQty: formData.executedQty,
        cumQuote: (parseFloat(formData.price) * parseFloat(formData.executedQty)).toString(),
        timeInForce: 'GTC',
        type: formData.type,
        reduceOnly: false,
        closePosition: false,
        side: formData.side,
        positionSide: 'BOTH',
        stopPrice: '0',
        workingType: 'CONTRACT_PRICE',
        priceProtect: false,
        origType: formData.type,
        priceMatch: 'NONE',
        selfTradePreventionMode: 'NONE',
        goodTillDate: '0',
        binanceAccount: null,
        indicatorCall: formData.indicatorCall,
        description: formData.description,
        create_time: now,
        update_time: now
      };

      setOrders(prevOrders => [newOrder, ...prevOrders]);
    }
    
    setIsFormOpen(false);
    setEditingOrder(null);
    resetForm();
  };

  const handleEdit = (order: Order) => {
    setEditingOrder(order);
    setFormData({
      orderId: order.orderId,
      symbol: order.symbol,
      status: order.status,
      price: order.price,
      origQty: order.origQty,
      executedQty: order.executedQty,
      type: order.type,
      side: order.side,
      indicatorCall: order.indicatorCall,
      description: order.description || ''
    });
    setIsFormOpen(true);
  };

  const handleDelete = (order: Order) => {
    setDeletingOrder(order);
  };

  const confirmDelete = () => {
    if (deletingOrder) {
      setOrders(orders.filter(order => order.orderId !== deletingOrder.orderId));
      setDeletingOrder(null);
    }
  };

  const resetForm = () => {
    setFormData({
      orderId: '',
      symbol: '',
      status: 'NEW',
      price: '',
      origQty: '',
      executedQty: '',
      type: 'LIMIT',
      side: 'BUY',
      indicatorCall: '',
      description: ''
    });
  };

  useEffect(() => {
    // Prevent double call on initial mount in development mode
    if (isInitialMount.current) {
      isInitialMount.current = false;
      fetchOrders(page);
    }
    
    // Cleanup function to abort pending requests
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []); // Empty dependency array - only run once

  // Separate useEffect for page changes (after initial mount)
  useEffect(() => {
    if (!isInitialMount.current) {
      fetchOrders(page);
    }
  }, [page]);

  // Filter orders based on search query
  const filteredOrders = orders.filter(order => {
    if (!searchQuery) return true;
    
    const searchLower = searchQuery.toLowerCase();
    return (
      order.orderId.toLowerCase().includes(searchLower) ||
      order.symbol.toLowerCase().includes(searchLower) ||
      order.side.toLowerCase().includes(searchLower) ||
      order.type.toLowerCase().includes(searchLower) ||
      order.status.toLowerCase().includes(searchLower) ||
      (order.indicatorCall && order.indicatorCall.toLowerCase().includes(searchLower))
    );
  });

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'FILLED':
        return 'bg-success-500/10 text-success-500';
      case 'CANCELED':
        return 'bg-danger-500/10 text-danger-500';
      case 'NEW':
        return 'bg-warning-300/10 text-warning-300';
      case 'PARTIALLY_FILLED':
        return 'bg-primary-500/10 text-primary-500';
      default:
        return 'bg-dark-600 text-dark-300';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'FILLED':
        return 'Filled';
      case 'CANCELED':
        return 'Canceled';
      case 'NEW':
        return 'Open';
      case 'PARTIALLY_FILLED':
        return 'Partial';
      default:
        return status;
    }
  };

  const formatPrice = (price: string) => {
    const numPrice = parseFloat(price);
    return numPrice === 0 ? 'Market' : numPrice;
  };

  const formatQuantity = (qty: string) => {
    return parseFloat(qty);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">
            <FormattedMessage id="orderHistory.title" />
          </h1>
          <p className="text-dark-400">
            <FormattedMessage id="orderHistory.subtitle" />
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setEditingOrder(null);
              resetForm();
              setIsFormOpen(true);
            }}
            className="btn btn-primary"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Order
          </button>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="btn btn-outline inline-flex items-center"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-danger-500/10 border border-danger-500/20 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 rounded-full bg-danger-500 flex items-center justify-center">
              <span className="text-white text-xs">!</span>
            </div>
            <div>
              <h3 className="text-sm font-medium text-danger-500">Error Loading Order History</h3>
              <p className="text-sm text-danger-400 mt-1">{error}</p>
            </div>
          </div>
          <button
            onClick={() => fetchOrders(page)}
            className="mt-3 btn btn-outline text-danger-500 border-danger-500 hover:bg-danger-500/10"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Filters and search */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <Search className="h-4 w-4 text-dark-400" />
          </div>
          <input
            type="text"
            className="form-input pl-10"
            placeholder="Search orders..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <button className="btn btn-outline inline-flex items-center">
            <Calendar className="mr-2 h-4 w-4" />
            <FormattedMessage id="orderHistory.dateRange" />
          </button>
          <button className="btn btn-outline inline-flex items-center">
            <Filter className="mr-2 h-4 w-4" />
            <FormattedMessage id="common.filter" />
          </button>
        </div>
      </div>

      {/* Orders table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-dark-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="h-8 w-8 text-dark-400" />
            </div>
            <h3 className="text-lg font-medium text-dark-300 mb-2">No Orders Found</h3>
            <p className="text-dark-400">
              {searchQuery ? 'No orders match your search criteria.' : 'You haven\'t made any trades yet.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-dark-700">
              <thead>
                <tr>
                  <th className="px-4 py-3.5 text-left text-xs font-medium text-dark-400">
                    Order ID
                  </th>
                  <th className="px-4 py-3.5 text-left text-xs font-medium text-dark-400">
                    Symbol
                  </th>
                  <th className="px-4 py-3.5 text-left text-xs font-medium text-dark-400">
                    Side/Type
                  </th>
                  <th className="px-4 py-3.5 text-right text-xs font-medium text-dark-400">
                    Price
                  </th>
                  <th className="px-4 py-3.5 text-right text-xs font-medium text-dark-400">
                    Quantity
                  </th>
                  <th className="px-4 py-3.5 text-right text-xs font-medium text-dark-400">
                    Executed
                  </th>
                  <th className="px-4 py-3.5 text-center text-xs font-medium text-dark-400">
                    Status
                  </th>
                  <th className="px-4 py-3.5 text-left text-xs font-medium text-dark-400">
                    Indicator
                  </th>
                  <th className="px-4 py-3.5 text-right text-xs font-medium text-dark-400">
                    Date
                  </th>
                  <th className="px-4 py-3.5 text-right text-xs font-medium text-dark-400">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-700">
                {filteredOrders.map((order) => (
                  <tr key={order.orderId} className="hover:bg-dark-700/40">
                    <td className="whitespace-nowrap px-4 py-4 text-sm font-mono">
                      {order.orderId}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-sm font-medium">
                      {order.symbol}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-sm">
                      <div className="flex flex-col">
                        <span className={`inline-flex items-center ${
                          order.side === 'BUY' ? 'text-success-500' : 'text-danger-500'
                        }`}>
                          {order.side === 'BUY' ? (
                            <ArrowDown className="mr-1 h-4 w-4" />
                          ) : (
                            <ArrowUp className="mr-1 h-4 w-4" />
                          )}
                          {order.side}
                        </span>
                        <span className="text-xs text-dark-400">{order.type}</span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-sm text-right">
                      {order.type === 'MARKET' ? (
                        <span className="text-dark-400">Market</span>
                      ) : (
                        <FormattedNumber
                          value={Number(formatPrice(order.price))}
                          minimumFractionDigits={2}
                          maximumFractionDigits={8}
                        />
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-sm text-right">
                      <FormattedNumber
                        value={formatQuantity(order.origQty)}
                        minimumFractionDigits={0}
                        maximumFractionDigits={8}
                      />
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-sm text-right">
                      <div>
                        <FormattedNumber
                          value={formatQuantity(order.executedQty)}
                          minimumFractionDigits={0}
                          maximumFractionDigits={8}
                        />
                        <div className="text-xs text-dark-400">
                          {parseFloat(order.origQty) > 0 && (
                            <FormattedNumber
                              value={(parseFloat(order.executedQty) / parseFloat(order.origQty))}
                              style="percent"
                              minimumFractionDigits={0}
                              maximumFractionDigits={1}
                            />
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-sm text-center">
                      <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${getStatusBadgeColor(order.status)}`}>
                        {getStatusLabel(order.status)}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-sm">
                      <span className="inline-flex items-center rounded-full bg-primary-500/10 px-2 py-1 text-xs font-medium text-primary-500">
                        {order.indicatorCall}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-sm text-right text-dark-400">
                      <div>
                        <FormattedDate
                          value={order.update_time}
                          day="2-digit"
  month="2-digit"
  year="numeric"
                        />
                        <div className="text-xs">
                          <FormattedDate
                            value={order.update_time}
                            hour="2-digit"
                            minute="2-digit"
                            second="2-digit"
                          />
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-sm text-right">
                      <div className="flex justify-end space-x-2">
                        <button
                          className="text-dark-400 hover:text-primary-500"
                          onClick={() => handleEdit(order)}
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          className="text-dark-400 hover:text-danger-500"
                          onClick={() => handleDelete(order)}
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
      {!loading && filteredOrders.length > 0 && totalPages > 1 && (
        <div className="flex justify-between items-center">
          <div className="text-sm text-dark-400">
            <FormattedMessage
              id="orderHistory.showing"
              values={{ page, total: totalPages }}
            />
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => handlePageChange(page - 1)}
              disabled={page === 1}
              className="btn btn-outline disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FormattedMessage id="common.previous" />
            </button>
            
            {/* Page numbers */}
            <div className="flex space-x-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const pageNum = Math.max(1, Math.min(totalPages - 4, page - 2)) + i;
                if (pageNum > totalPages) return null;
                
                return (
                  <button
                    key={pageNum}
                    onClick={() => handlePageChange(pageNum)}
                    className={`px-3 py-2 text-sm rounded-md ${
                      pageNum === page
                        ? 'bg-primary-500 text-white'
                        : 'text-dark-400 hover:text-dark-200 hover:bg-dark-700'
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
              <FormattedMessage id="common.next" />
            </button>
          </div>
        </div>
      )}

      {/* Form Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-dark-900/80 flex items-center justify-center p-4 z-50">
          <div className="card w-full max-w-2xl">
            <div className="card-header flex justify-between items-center">
              <h2 className="text-lg font-medium">
                {editingOrder ? 'Edit Order' : 'Add New Order'}
              </h2>
              <button
                className="text-dark-400 hover:text-dark-300"
                onClick={() => {
                  setIsFormOpen(false);
                  setEditingOrder(null);
                  resetForm();
                }}
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="orderId" className="form-label">Order ID</label>
                  <input
                    type="text"
                    id="orderId"
                    className="form-input"
                    value={formData.orderId}
                    onChange={(e) => setFormData({ ...formData, orderId: e.target.value })}
                    placeholder="Auto-generated if empty"
                  />
                </div>

                <div>
                  <label htmlFor="symbol" className="form-label">Symbol</label>
                  <input
                    type="text"
                    id="symbol"
                    className="form-input"
                    value={formData.symbol}
                    onChange={(e) => setFormData({ ...formData, symbol: e.target.value })}
                    required
                    placeholder="e.g., BTCUSDT"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label htmlFor="side" className="form-label">Side</label>
                  <select
                    id="side"
                    className="form-select"
                    value={formData.side}
                    onChange={(e) => setFormData({ ...formData, side: e.target.value as 'BUY' | 'SELL' })}
                    required
                  >
                    <option value="BUY">BUY</option>
                    <option value="SELL">SELL</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="type" className="form-label">Type</label>
                  <select
                    id="type"
                    className="form-select"
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as 'LIMIT' | 'MARKET' | 'STOP_LIMIT' })}
                    required
                  >
                    <option value="LIMIT">LIMIT</option>
                    <option value="MARKET">MARKET</option>
                    <option value="STOP_LIMIT">STOP_LIMIT</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="status" className="form-label">Status</label>
                  <select
                    id="status"
                    className="form-select"
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as 'NEW' | 'FILLED' | 'CANCELED' | 'PARTIALLY_FILLED' })}
                    required
                  >
                    <option value="NEW">NEW</option>
                    <option value="FILLED">FILLED</option>
                    <option value="CANCELED">CANCELED</option>
                    <option value="PARTIALLY_FILLED">PARTIALLY_FILLED</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label htmlFor="price" className="form-label">Price</label>
                  <input
                    type="number"
                    id="price"
                    className="form-input"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    step="0.00000001"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="origQty" className="form-label">Original Quantity</label>
                  <input
                    type="number"
                    id="origQty"
                    className="form-input"
                    value={formData.origQty}
                    onChange={(e) => setFormData({ ...formData, origQty: e.target.value })}
                    step="0.00000001"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="executedQty" className="form-label">Executed Quantity</label>
                  <input
                    type="number"
                    id="executedQty"
                    className="form-input"
                    value={formData.executedQty}
                    onChange={(e) => setFormData({ ...formData, executedQty: e.target.value })}
                    step="0.00000001"
                    required
                  />
                </div>
              </div>

              <div>
                <label htmlFor="indicatorCall" className="form-label">Indicator Call</label>
                <input
                  type="text"
                  id="indicatorCall"
                  className="form-input"
                  value={formData.indicatorCall}
                  onChange={(e) => setFormData({ ...formData, indicatorCall: e.target.value })}
                  required
                />
              </div>

              <div>
                <label htmlFor="description" className="form-label">Description</label>
                <textarea
                  id="description"
                  className="form-input"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => {
                    setIsFormOpen(false);
                    setEditingOrder(null);
                    resetForm();
                  }}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  <Save className="mr-2 h-4 w-4" />
                  {editingOrder ? 'Update' : 'Add'} Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingOrder && (
        <div className="fixed inset-0 bg-dark-900/80 flex items-center justify-center p-4 z-50">
          <div className="card w-full max-w-md">
            <div className="p-6">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-danger-500/10 mx-auto mb-4">
                <AlertTriangle className="h-6 w-6 text-danger-500" />
              </div>
              
              <h3 className="text-lg font-medium text-center mb-2">Delete Order</h3>
              
              <p className="text-dark-400 text-center mb-6">
                Are you sure you want to delete order "{deletingOrder.orderId}"? This action cannot be undone.
              </p>

              <div className="flex justify-center space-x-3">
                <button
                  className="btn btn-outline"
                  onClick={() => setDeletingOrder(null)}
                >
                  Cancel
                </button>
                <button
                  className="btn bg-danger-500 hover:bg-danger-600 text-white"
                  onClick={confirmDelete}
                >
                  Delete Order
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* API Status Info */}
      <div className="text-center text-xs text-dark-500">
        <p className="mt-1">
          Status: <span className={error ? 'text-danger-500' : 'text-success-500'}>
            {error ? 'Error' : 'Connected'}
          </span>
        </p>
      </div>
    </div>
  );
}