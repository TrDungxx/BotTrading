import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { authApi } from '../utils/api';
import {jwtDecode} from 'jwt-decode';

// ========== Types ==========
interface User {
  id: number;
  username: string;
  email: string;
  status: number;
  type: number;

  avatar?: string;
  fullName?: string;
  timezone?: string;
  language?: string;
  approved?: number;
  createdAt?: string;
  lastLogin?: string;

  role: 'admin' | 'superadmin' | 'user';
  internalAccountId?: number;

  DiscordWebhookUrl?: string | null;
  DiscordUsername?: string | null;
  DiscordNotificationsEnabled?: boolean;
  DiscordSettings?: any;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isGuestMode: boolean;
  isAuthenticating: boolean; // ✅ thêm vào type để khớp Provider
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string, email: string) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  enterGuestMode: () => void;
  exitGuestMode: () => void;
}

// ========== Helpers ==========
function mapRole(role: number | string): 'admin' | 'superadmin' | 'user' {
  if (role === 'superadmin' || role === 2 || role === 99) return 'superadmin';
  if (role === 'admin' || role === 1) return 'admin';
  return 'user';
}

function safeParseJSON<T = any>(raw: string, fallback: T): T {
  try {
    const v = JSON.parse(raw);
    return v ?? fallback;
  } catch {
    return fallback;
  }
}

// ========== Context ==========
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ========== Provider ==========
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isGuestMode, setIsGuestMode] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(true);
  const didInit = useRef(false); // ✅ guard StrictMode

  useEffect(() => {
    if (didInit.current) return; // chặn chạy 2 lần trong Dev StrictMode
    didInit.current = true;

    const fetchUser = async () => {
      const token = localStorage.getItem('authToken');
      console.log('Token hiện tại:', token);

      if (!token) {
        console.warn('⛔ Không có token → bỏ qua fetchUser');
        setIsAuthenticating(false);
        return;
      }

      // ✅ check token hết hạn để tránh gọi API vô ích
      try {
        const decoded: any = jwtDecode(token);
        if (decoded?.exp && Date.now() / 1000 >= decoded.exp) {
          console.warn('⛔ Token đã hết hạn → xoá & bỏ qua fetchUser');
          localStorage.removeItem('authToken');
          setIsAuthenticating(false);
          return;
        }
      } catch {
        // token hỏng → xem như không hợp lệ
      }

      try {
        const res = await authApi.getCurrentUser();
        const apiUser = res.Data?.user;
        const apiRoleTop = res.Data?.role;

        console.log('📥 Response data:', res.Data);
        console.log('📥 Raw user from API:', apiUser);
        console.log('📥 DiscordWebhookUrl:', apiUser?.DiscordWebhookUrl);
        console.log('📥 DiscordUsername:', apiUser?.DiscordUsername);
        console.log('📥 DiscordNotificationsEnabled:', apiUser?.DiscordNotificationsEnabled);
        console.log('📥 DiscordSettings:', apiUser?.DiscordSettings);
        console.log('Mapped user (raw):', apiUser);
        console.log('Final user role (raw):', apiUser?.role);

        if (!apiUser) {
          throw new Error('❌ API không trả về thông tin user');
        }

        const parsedDiscordSettings =
          typeof apiUser.DiscordSettings === 'string'
            ? safeParseJSON(apiUser.DiscordSettings, {
                notifyOnLogin: false,
                notifyOnAccountUpdate: false,
                notifyOnError: true,
                messageFormat: 'embed',
                timezone: 'Asia/Ho_Chi_Minh',
              })
            : (apiUser.DiscordSettings ?? {
                notifyOnLogin: false,
                notifyOnAccountUpdate: false,
                notifyOnError: true,
                messageFormat: 'embed',
                timezone: 'Asia/Ho_Chi_Minh',
              });

        const mappedUser: User = {
          id: apiUser.id,
          username: apiUser.Username || apiUser.username || '',
          email: apiUser.Email || apiUser.email || '',
          status: apiUser.Status ?? apiUser.status ?? 1,
          type: apiUser.Type ?? apiUser.type ?? 3,
          approved: apiUser.Approved ?? apiUser.approved ?? 1,
          avatar:
            apiUser.Avatar ||
            'https://images.pexels.com/photos/415829/pexels-photo-415829.jpeg?auto=compress&cs=tinysrgb&w=150',
          internalAccountId: apiUser.InternalAccountId ?? apiUser.internalAccountId ?? apiUser.id,
          role: mapRole(apiUser.Role ?? apiUser.role ?? apiRoleTop ?? apiUser.Type ?? apiUser.type ?? 0),

          DiscordWebhookUrl: apiUser.DiscordWebhookUrl || '',
          DiscordUsername: apiUser.DiscordUsername || '',
          DiscordNotificationsEnabled: !!apiUser.DiscordNotificationsEnabled,
          DiscordSettings: parsedDiscordSettings,
        };

        setUser(mappedUser);
      } catch (error) {
        console.error('❌ Không khôi phục được user từ token:', error);
        localStorage.removeItem('authToken');
      } finally {
        setIsAuthenticating(false);
      }
    };

    fetchUser();
  }, []);

  // ========== Actions ==========
  const login = async (username: string, password: string) => {
    try {
      const response = await authApi.login(username, password);
      const data = response.Data;

      console.log('Token nhận được:', data.token);
      console.log('User:', data.user);

      if (!data.user) throw new Error('API không trả về thông tin user');

      const apiUser = data.user;

      const mappedUser: User = {
        id: apiUser.id,
        username: apiUser.Username || apiUser.username || '',
        email: apiUser.Email || apiUser.email || '',
        status: apiUser.Status ?? apiUser.status ?? 1,
        type: apiUser.Type ?? apiUser.type ?? 3,
        approved: apiUser.Approved ?? apiUser.approved ?? 1,
        avatar:
          apiUser.Avatar ||
          'https://images.pexels.com/photos/415829/pexels-photo-415829.jpeg?auto=compress&cs=tinysrgb&w=150',
        internalAccountId: apiUser.InternalAccountId ?? apiUser.internalAccountId ?? apiUser.id,
        role: mapRole(apiUser.Role ?? apiUser.role ?? apiUser.Type ?? apiUser.type ?? 0),

        DiscordWebhookUrl: apiUser.DiscordWebhookUrl || '',
        DiscordUsername: apiUser.DiscordUsername || '',
        DiscordNotificationsEnabled: !!apiUser.DiscordNotificationsEnabled,
        DiscordSettings:
          typeof apiUser.DiscordSettings === 'string'
            ? safeParseJSON(apiUser.DiscordSettings, {
                notifyOnLogin: false,
                notifyOnAccountUpdate: false,
                notifyOnError: true,
                messageFormat: 'embed',
                timezone: 'Asia/Ho_Chi_Minh',
              })
            : apiUser.DiscordSettings || {
                notifyOnLogin: false,
                notifyOnAccountUpdate: false,
                notifyOnError: true,
                messageFormat: 'embed',
                timezone: 'Asia/Ho_Chi_Minh',
              },
      };

      console.log('✅ Mapped user:', mappedUser);
      setUser(mappedUser);
      setIsGuestMode(false);

      if (data.token) {
        localStorage.setItem('authToken', data.token);
      }
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const register = async (username: string, password: string, email: string) => {
    try {
      const data = await authApi.register(username, password, email);
      console.log('Register API response:', data);
      // Đăng ký xong thường pending approve → không set user ở đây
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
      await authApi.logout();
    } catch (error) {
      console.error('Logout API error:', error);
    } finally {
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

// ========== Hook ==========
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
