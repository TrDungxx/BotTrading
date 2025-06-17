import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

import { authApi, ApiError } from '../utils/api';
import jwtDecode from 'jwt-decode'; 

interface User {
  id: number;
  username: string;
  email: string;
  status: number;
  type: number;
  
  avatar?: string;
  role: 'admin' | 'superadmin' | 'user';
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isGuestMode: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;

  logout: () => void;
  resetPassword: (email: string) => Promise<void>;
  enterGuestMode: () => void;
  exitGuestMode: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isGuestMode, setIsGuestMode] = useState(false);
const [isAuthenticating, setIsAuthenticating] = useState(true); // ✅ thêm

  useEffect(() => {
  const fetchUser = async () => {
    const token = localStorage.getItem('authToken');
    console.log('Token hiện tại:', token);

    if (!token) {
      console.warn('⛔ Không có token → bỏ qua fetchUser');
      setIsAuthenticating(false); // ✅ kết thúc xác thực
      return;
    }

    try {
      const res = await authApi.getCurrentUser();
      const apiUser = res.Data?.user;
      console.log("Mapped user:", apiUser); 
console.log("Final user role:", apiUser.role);

      if (!apiUser) {
        throw new Error('❌ API không trả về thông tin user');
      }

      const mappedUser: User = {
  id: apiUser.id,
  username: apiUser.Username || apiUser.username || '',
  email: apiUser.Email || apiUser.email || '',
  status: apiUser.Status ?? apiUser.status ?? 1,
  type: apiUser.Type ?? apiUser.type ?? 3,
  approved: apiUser.Approved ?? apiUser.approved ?? 1,
  avatar: 'https://images.pexels.com/photos/415829/pexels-photo-415829.jpeg?auto=compress&cs=tinysrgb&w=150',
  role: mapRole(
    apiUser.Role ??
    apiUser.role ??
    apiUser.Type ?? // phải có dòng này
    apiUser.type ??
    0
  )
}

      setUser(mappedUser);
    } catch (error) {
      console.error('❌ Không khôi phục được user từ token:', error);
      localStorage.removeItem('authToken');
    } finally {
      setIsAuthenticating(false); // ✅ kết thúc xác thực
    }
  };

  fetchUser();
}, []);

function mapRole(role: number | string): 'admin' | 'superadmin' | 'user' {
  if (role === 'superadmin' || role === 2 || role === 99) return 'superadmin';
  if (role === 'admin' || role === 1) return 'admin';
  return 'user';
}


  const login = async (username: string, password: string) => {
    
    try {
      const response = await authApi.login(username, password);
const data = response.Data;

console.log('Token nhận được:', data.token);
console.log('User:', data.user);

if (!data.user) {
  throw new Error('API không trả về thông tin user');
}

      if (!data.user) {
        throw new Error('API không trả về thông tin user');
      }
      
      // Handle both lowercase and uppercase field names from API
      const apiUser = data.user;
      console.log('User:', data.user);
console.log('Role raw:', apiUser.Role ?? apiUser.role ?? apiUser.Type ?? apiUser.type);

console.log('Mapped role:', mapRole(apiUser.Role ?? apiUser.role ?? apiUser.Type ?? apiUser.type ?? 0));


      const mappedUser: User = {
  id: apiUser.id,
  username: apiUser.Username || apiUser.username || '',
  email: apiUser.Email || apiUser.email || '',
  status: apiUser.Status ?? apiUser.status ?? 1,
  type: apiUser.Type ?? apiUser.type ?? 3,
  approved: apiUser.Approved ?? apiUser.approved ?? 1,
  avatar: 'https://images.pexels.com/photos/415829/pexels-photo-415829.jpeg?auto=compress&cs=tinysrgb&w=150',
  role: mapRole(apiUser.Role ?? apiUser.role ?? apiUser.Type ?? apiUser.type ?? 0), 
};

      
      console.log('Mapped user:', mappedUser); // Debug log
      console.log('User type from API:', apiUser.Type || apiUser.Type); // Debug log
      console.log('Final user role:', mappedUser.role); // Debug log
      
      setUser(mappedUser);
      setIsGuestMode(false);
      
      // Lưu token nếu có trong response
      if (data.token) {
        localStorage.setItem('authToken', data.token);
      }
      
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const register = async (username: string,  password: string) => {
    try {
      const data = await authApi.register(username, password);
      
      console.log('Register API response:', data); // Debug log
      
      // Registration successful - user will be in pending state
      // Don't set user state since they need approval first
      
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  };

  const resetPassword = async (email: string) => {
    try {
      await authApi.forgotPassword(email);
    } catch (error) {
      console.error('Reset password error:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      // Call logout API
      await authApi.logout(); 
    } catch (error) {
      console.error('Logout API error:', error);
      // Continue with logout even if API call fails
    } finally {
      // Always clear local state
      setUser(null);
      setIsGuestMode(false);
      localStorage.removeItem('authToken');
    }
  };

  const enterGuestMode = () => {
    setIsGuestMode(true);
    setUser(null);
  };

  const exitGuestMode = () => {
    setIsGuestMode(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isGuestMode,
        isAuthenticating,
        login,
        register,
        logout,
        resetPassword,
        enterGuestMode,
        exitGuestMode,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};