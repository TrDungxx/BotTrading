import axiosInstance from './axiosInstance';

export const API_BASE_URL = import.meta.env.VITE_REACT_APP_API_URL || 'http://45.77.33.141';

export interface ApiResponse<T = any> {
  message: string;
  status?: number;
  type?: number;
  data?: T;
  user?: {
    id: number;
    Username: string;
    Email: string;
    Status: number;
    Type: number;
    Approved: number;
  };
  token?: string;
}
export interface ApiRequestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: any;
  params?: Record<string, any>; // 👈 rất quan trọng!
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public response?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const checkApiHealth = async (): Promise<boolean> => {
  try {
    const response = await axiosInstance.get('/health');
    return response.status === 200;
  } catch {
    return false;
  }
};

export const apiRequest = async <T = any>(
  endpoint: string,
  options: ApiRequestOptions
): Promise<ApiResponse<T>> => {
  try {
    const config = {
      method: options.method,
      url: endpoint,
      data: options.body || undefined,
      params: options.params, // 👈 thêm dòng này để axios encode ?page= & limit=
    };

    console.log('📡 Making API request to:', API_BASE_URL + endpoint);
    console.log('📥 Params gửi đi:', options.params);

    const response = await axiosInstance.request(config);
    const data = response.data;

    console.log('📥 Response data:', data);

    if (!data || ('status' in data && data.status !== 1 && data.status !== 200)) {
      throw new ApiError(data?.message || 'API request failed', data?.status || 0, data);
    }

    return data;
  } catch (error: any) {
    console.error('❌ API request error:', error);

    throw new ApiError(
      error?.message || 'Lỗi không xác định',
      error?.response?.status || 0,
      error?.response?.data
    );
  }
};

// Raw request: bỏ qua kiểm tra status === 1 hoặc 200
export const rawRequest = async <T = any>(
  endpoint: string,
  options: ApiRequestOptions
): Promise<T> => {
  try {
    const config = {
      method: options.method,
      url: endpoint,
      data: options.body || undefined,
      params: options.params,
    };

    const response = await axiosInstance.request(config);
    return response.data; // ⚠️ Không kiểm tra status
  } catch (error: any) {
    console.error('❌ RAW API request error:', error);
    throw new ApiError(
      error?.message || 'Lỗi không xác định',
      error?.response?.status || 0,
      error?.response?.data
    );
  }
};

// -------------------- Auth API --------------------

export const authApi = {
  login: (username: string, password: string) =>
  apiRequest('/auth/login', {
    method: 'POST',
    body: {
      Username: username, 
      Password: password, 
    },
  }),

  logout: () =>
    apiRequest('/auth/logout', {
      method: 'POST',
    }),

  getCurrentUser: () =>
    apiRequest('/auth/me', {
      method: 'GET',
    }),

  refreshToken: () =>
    apiRequest('/auth/refresh', {
      method: 'POST',
    }),

  changePassword: (currentPassword: string, newPassword: string, confirmPassword: string) =>
  apiRequest('/accounts/change-password', {
    method: 'PUT',
    body: { currentPassword, newPassword, confirmPassword },
  }),

  // --------------Reset Password-------------------
resetPasswordAsAdmin: (accountId: number, newPassword: string, notifyUser = true) =>
  apiRequest('/accounts/admin/reset-password', {
    method: 'PUT',
    body: {
      accountId,
      newPassword,
      notifyUser
    },
  }),



  // Nếu backend có thì giữ, không thì xoá hoặc comment
  register: (username: string, password: string, email:string) =>
  apiRequest('/accounts/register', {
    method: 'POST',
    body: {
      Username: username,
      Password: password,
      Email: email,
    },
  }),

  forgotPassword: (email: string) =>
    apiRequest('/forgot-password', {
      method: 'POST',
      body: { email },
    }),

  createAdmin: (username: string, email: string, password: string, adminKey: string) =>
    apiRequest('/create-admin', {
      method: 'POST',
      body: { username, email, password, adminKey },
    }),
};


// -------------------- Order History API --------------------

export const orderHistoryApi = {
  getAllOrderHistory: (page?: number, limit?: number) => {
    const params = new URLSearchParams();
    if (page) params.append('page', page.toString());
    if (limit) params.append('limit', limit.toString());
    const endpoint = `/history/getAllOrderHistory${params.toString() ? `?${params}` : ''}`;
    return apiRequest(endpoint, { method: 'GET' });
  },

  getMyOrderHistory: (page = 1, limit = 20) =>
  apiRequest(`/history/getMyOrderHistory?page=${page}&limit=${limit}`, { method: 'GET' }),


  getMyOrderById: (id: number) => {
    return apiRequest(`/order/getMyOrder?id=${id}`, { method: 'GET' });
  },

  createOrder: (data: any) => {
    return apiRequest('/order/create', {
      method: 'POST',
      body: data
    });
  },

  updateMyOrder: (id: number, data: any) => {
    return apiRequest(`/order/updateMyOrder?id=${id}`, {
      method: 'PUT',
      body: data
    });
  },

  cancelMyOrder: (id: number) => {
    return apiRequest(`/order/cancelMyOrder?id=${id}`, {
      method: 'DELETE'
    });
  },

  getOrderById: (id: number) => {
    return apiRequest(`/order/getById?id=${id}`, {
      method: 'GET'
    });
  },

  updateOrder: (id: number, data: any) => {
    return apiRequest(`/order/update?id=${id}`, {
      method: 'PUT',
      body: data
    });
  },

  deleteOrder: (id: number) => {
    return apiRequest(`/order/delete?id=${id}`, {
      method: 'DELETE'
    });
  },

  getOrderStats: () => {
    return apiRequest('/order/stats', { method: 'GET' });
  },

  getOrdersBySymbol: (symbol: string) => {
    return apiRequest(`/order/by-symbol?symbol=${symbol}`, { method: 'GET' });
  }
};


// -------------------- Admin API --------------------

export const adminApi = {
  getListAccounts: () =>
    apiRequest('/accounts', { method: 'GET' }),

  createAccount: (accountData: any) =>
    apiRequest('/accounts/create', {
      method: 'POST',
      body: accountData,
    }),

  deleteAccount: (accountId: number) =>
    apiRequest(`/accounts/delete?id=${accountId}`, {
      method: 'DELETE',
    }),

  getAccountStats: () =>
    apiRequest('/accounts/stats', { method: 'GET' }),

  updateAccountRole: (accountId: number, newRole: string) =>
    apiRequest('/accounts/update-role', {
      method: 'PUT',
      body: { id: accountId, role: newRole },
    }),
};

// -------------------- Account Management API --------------------

export const accountApi = {
  getListAccount: (params?: { page?: number; limit?: number }) =>
  apiRequest('/accounts', {
    method: 'GET',
    params,
  }),

  getAccountById: (id: number) =>
    apiRequest(`/accounts/getById?id=${id}`, { method: 'GET' }),

  createAccount: (accountData: any) =>
  apiRequest('/accounts/create', {
    method: 'POST',
    body: {
      Username: accountData.Username,
      Password: accountData.Password,
    },
  }),


  updateAccount: (id: number, accountData: any) =>
  apiRequest(`/accounts/update?id=${id}`, {
    method: 'PUT',
    body: accountData, // KHÔNG chứa "id"
  }),



  deleteAccount: (id: number) =>
  apiRequest(`/accounts/delete?id=${id}`, {
    method: 'DELETE',
  }),

};
// -------------------- Indicator API --------------------
export const indicatorApi = {

getPublicActiveIndicators: () =>
  apiRequest('/m-sys/indicators/public-active', { method: 'GET' }),

getMyActiveIndicators: () =>
  apiRequest('/m-sys/indicators/my-active', { method: 'GET' }),


//----------------- Admin Indicator API --------------------

  getAllIndicatorConfigs: () =>
    apiRequest('/m-sys/indicators', { method: 'GET' }),

getIndicatorConfigById: (id: number) =>
  apiRequest(`/m-sys/indicators/getById?id=${id}`, { method: 'GET' }),

createIndicatorConfig: (payload: any) =>
  apiRequest('/m-sys/indicators/create', { method: 'POST', body: payload }),

updateIndicatorConfig: (payload: any) =>
  apiRequest(`/m-sys/indicators/update?id=${payload.id}`, {
    method: 'PUT',
    body: {
      ...payload,
      id: undefined // hoặc không truyền id trong body nếu backend không cần
    }
  }),

getActiveIndicators: () =>
  apiRequest('/m-sys/indicators/active/all', { method: 'GET' }),

getIndicatorStats: () =>
  apiRequest('/m-sys/indicators/stats', { method: 'GET' }),

toggleIndicatorStatus: (id: number) =>
  apiRequest('/m-sys/indicators/toggle-status', { method: 'PUT', body: { id } }),

//----------------- SuperAdmin Indicator API --------------------

deleteIndicatorConfig: (id: number) =>
  apiRequest(`/m-sys/indicators/delete?id=${id}`, { method: 'DELETE' }),

bulkUpdateIndicators: (payload: any) =>
  apiRequest('/m-sys/indicators/bulk-update', { method: 'PUT', body: payload }),
};

// -------------------- BinanceAccount API --------------------

export const binanceAccountApi = {
  // -------------------- USER APIs --------------------
  // Người dùng có thể thao tác trên tài khoản Binance của chính họ
  getMyAccounts: (params?: { page?: number; limit?: number }) =>
  apiRequest('/binance/my-accounts', {
    method: 'GET',
    params,
  }),

  getMyAccountById: (id: number) =>
    apiRequest(`/binance/my-account?id=${id}`, { method: 'GET' }),

  createMyAccount: (data: any) =>
    apiRequest('/binance/create-my-account', {
      method: 'POST',
      body: data,
    }),

  updateMyAccount: (id: number, data: any) =>
    apiRequest(`/binance/update-my-account?id=${id}`, {
      method: 'PUT',
      body: data,
    }),

  deleteMyAccount: (id: number) =>
    apiRequest(`/binance/delete-my-account?id=${id}`, {
      method: 'DELETE',
    }),

  // -------------------- ADMIN APIs --------------------
  // Admin có quyền quản lý tất cả tài khoản Binance
  getListAccounts: (params?: { page?: number; limit?: number }) =>
  apiRequest('/binance/accounts', {
    method: 'GET',
     params,
  }),


  getAccountById: (id: number) =>
    apiRequest(`/binance/accounts/getById?id=${id}`, { method: 'GET' }),

  createAccount: (data: any) =>
    apiRequest('/binance/accounts/create', {
      method: 'POST',
      body: data,
    }),

  updateAccount: (id: number, data: any) =>
    apiRequest(`/binance/accounts/update?id=${id}`, {
      method: 'PUT',
      body: data,
    }),

  getAccountStats: () =>
    apiRequest('/binance/accounts/stats', { method: 'GET' }),

  // -------------------- SUPER ADMIN APIs --------------------
  // Super admin có quyền xoá bất kỳ tài khoản Binance nào
  deleteAccount: (id: number) =>
    apiRequest(`/binance/accounts/delete?id=${id}`, {
      method: 'DELETE',
    }),
};


//------------------------------ ConfigBot API ---------------------------

export const configBotAPI = {
  
  getMyTradingStreams: () =>
    apiRequest('/stream/my-streams', { method: 'GET' }),

  
  getMyTradingStreamById: (id: number) =>
    apiRequest(`/stream/my-stream?id=${id}`, { method: 'GET' }),

  
  createMyTradingStream: (data: any) =>
    apiRequest('/stream/create-my-stream', {
      method: 'POST',
      body: data,
    }),

  
  updateMyTradingStream: (id: number, data: any) =>
    apiRequest(`/stream/update-my-stream?id=${id}`, {
      method: 'PUT',
      body: data,
    }),

 
  deleteMyTradingStream: (id: number) =>
    apiRequest(`/stream/delete-my-stream?id=${id}`, {
      method: 'DELETE',
    }),


  


//----------------------- quyen configbot admin api -------------------

getAllTradingStreams: ({ page, limit }: { page: number; limit: number }) =>
  apiRequest(`/stream/getAll?page=${page}&limit=${limit}`, {
    method: 'GET',
  }),

  getTradingStreamById: (id: number) =>
    apiRequest(`/stream/getById?id=${id}`, { method: 'GET' }),

  createTradingStream: (data: any) =>
    apiRequest('/stream/create', { method: 'POST', body: data }),

  

  updateTradingStream: (id: number, data: any) =>
    apiRequest(`/stream/update?id=${id}`, { method: 'PUT', body: data }),

  

  getTradingStreamStats: () =>
    apiRequest('/stream/stats', { method: 'GET' }),

  //----------------------- quyen configbot supper api -------------------

  deleteTradingStream: (id: number) =>
    apiRequest(`/stream/delete?id=${id}`, { method: 'DELETE' }),

};

// -------------------- Metrics API --------------------
export const metricsApi = {
  // 👤 User chỉ được xem của mình
  getMyMetrics: () =>
    apiRequest('/metrics/my-metrics', { method: 'GET' }),

  getLatestMetrics: () =>
    apiRequest('/metrics/latest', { method: 'GET' }),

  getMetricsStats: () =>
    apiRequest('/metrics/stats', { method: 'GET' }),

  // 🛡️ Admin được xem toàn bộ
  getAllMetrics: () =>
    apiRequest('/stream-performance/getAll', { method: 'GET' }),

  getMetricsById: (id: number) =>
    apiRequest(`/metrics/getById?id=${id}`, { method: 'GET' }),
};

// -------------------- Stream Performance API --------------------
export const streamPerformanceApi = {
  // 👤 User
  getMyStreamPerformance: () =>
    apiRequest('/stream-performance/my-performance', { method: 'GET' }),

  getLatestPerformance: () =>
    apiRequest('/stream-performance/latest', { method: 'GET' }),

  getPerformanceStats: () =>
    apiRequest('/stream-performance/stats', { method: 'GET' }),

  // 🛡️ Admin
  getAllStreamPerformance: () =>
    apiRequest('/stream-performance/getAll', { method: 'GET' }),

  getStreamPerformanceById: (id: number) =>
    apiRequest(`/stream-performance/getById?id=${id}`, { method: 'GET' }),
};

//--------------- Monitoring API --------------------------------

export const monitoringApi = {
  getAllSystemMonitors: () =>
    apiRequest('/m-sys/system-monitor', { method: 'GET' }),

  getSystemMonitorById: (id: string) =>
    apiRequest(`/m-sys/system-monitor/getById?id=${id}`, { method: 'GET' }),

  getCurrentSystemStatus: () =>
    apiRequest('/m-sys/system-monitor/current', { method: 'GET' }),

  getSystemStats: () =>
    apiRequest('/m-sys/system-monitor/stats', { method: 'GET' }),

  getSystemAlerts: () =>
    apiRequest('/m-sys/system-monitor/alerts', { method: 'GET' }),

  getPerformanceMetrics: () =>
    apiRequest('/m-sys/system-monitor/metrics', { method: 'GET' }),

  getLatestSystemStatus: () =>
    apiRequest('/m-sys/system-monitor/latest', { method: 'GET' }),

  manualCollect: () =>
    apiRequest('/m-sys/system-monitor/collect', { method: 'POST' }),

  cleanupOldRecords: () =>
    apiRequest('/m-sys/system-monitor/cleanup', { method: 'DELETE' }),

  getSystemDashboard: () =>
    apiRequest('/m-sys/system-monitor/dashboard', { method: 'GET' }),
};

// -------------------- System Stat API --------------------
export const systemStatApi = {
  getSystemStats: () =>
    rawRequest('/listen/indicator/stats', { method: 'GET' }),

  getSystemHealth: () =>
    rawRequest('/listen/indicator/health', { method: 'GET' }),
};

// -------------------- Binance Sync API --------------------

export const binanceSyncApi = {
  // USER
  getMyAnalytics: (accountId: number) =>
  apiRequest(`/binance/sync/analytics?accountId=${accountId}`, { method: 'GET' }),


  syncMyTradeHistory: () =>
    apiRequest('/binance/sync/my-trade-history', { method: 'POST' }),

  getMyTradeHistoryStatus: () =>
    apiRequest('/binance/sync/my-trade-history-status', { method: 'GET' }),

  // ADMIN
  getAccountAnalytics: (accountId: number) =>
    apiRequest(`/binance/sync/analytics?accountId=${accountId}`, { method: 'GET' }),



  getPortfolioOverview: () =>
    apiRequest('/binance/sync/portfolio', { method: 'GET' }),
};


