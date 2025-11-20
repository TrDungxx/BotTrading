// utils/axiosInstance.ts
import axios from 'axios';

const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_REACT_APP_API_URL,
  //withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

axiosInstance.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers = config.headers || {}; 
    config.headers.Authorization = `Bearer ${token}`;
    console.log('📤 Gửi Authorization:', config.headers.Authorization); 
  }
  return config;
});


export default axiosInstance;
