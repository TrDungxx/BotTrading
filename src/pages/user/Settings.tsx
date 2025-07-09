import React, { useState, useEffect } from 'react';
import { Bell, CreditCard, Key, Lock, Save, Shield, User, Camera, Globe, Clock, AlertCircle, CheckCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { FormattedMessage, FormattedNumber } from 'react-intl';
import { authApi, ApiError } from '../../utils/api';
import { accountApi } from '../../utils/api';

interface UserProfile {
  id: number;
  username: string;
  email: string;
  fullName?: string;
  avatar?: string;
  timezone: string;
  language: string;
  type: number;
  status: number;
  approved: number;
  createdAt: string;
  lastLogin?: string;
  DiscordWebhookUrl?: string | null;
  DiscordUsername?: string | null;
  DiscordNotificationsEnabled?: boolean;
  DiscordSettings?: {
    notifyOnLogin: boolean;
    notifyOnAccountUpdate: boolean;
    notifyOnError: boolean;
    messageFormat: string;
    timezone: string;
  } | null;
}

interface NotificationSettings {
  emailNotifications: {
    botActivity: boolean;
    marketAlerts: boolean;
    securityAlerts: boolean;
    newsletter: boolean;
  };
  pushNotifications: {
    tradingSignals: boolean;
    priceAlerts: boolean;
  };
}

interface ApiKey {
  id: number;
  name: string;
  exchange: string;
  status: 'active' | 'inactive';
  createdAt: string;
  lastUsed?: string;
}

export default function Settings() {
  const { user, logout } = useAuth();
  const { language, setLanguage } = useLanguage();
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'api' | 'notifications' | 'payment'>('profile');
  
  // Loading states
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  // Profile form states
  const [profileData, setProfileData] = useState<UserProfile>({
    id: user?.id || 0,
    username: user?.username || '',
    email: user?.email || '',
    fullName: '',
    avatar: user?.avatar,
    timezone: 'UTC',
    language: language,
    type: user?.type || 3,
    status: user?.status || 1,
    approved: user?.approved || 1,
    createdAt: '',
    DiscordWebhookUrl: '',
  DiscordUsername: '',
  DiscordNotificationsEnabled: false,
  DiscordSettings: JSON.stringify({
    notifyOnLogin: false,
    notifyOnAccountUpdate: false,
    notifyOnError: true,
    messageFormat: "embed",
    timezone: "Asia/Ho_Chi_Minh"
  }),
    lastLogin: ''
  });
  
  // Security form states
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  
  // Notification settings
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    emailNotifications: {
      botActivity: true,
      marketAlerts: true,
      securityAlerts: true,
      newsletter: false
    },
    pushNotifications: {
      tradingSignals: true,
      priceAlerts: true
    }
  });
  
  // API Keys
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [showAddApiKey, setShowAddApiKey] = useState(false);
  
  // Load user profile data
  useEffect(() => {
    loadUserProfile();
    loadNotificationSettings();
    loadApiKeys();
  }, []);

  const loadUserProfile = async () => {
  if (!user) return;

  try {
    setIsLoading(true);

    // 🔍 Log để kiểm tra toàn bộ dữ liệu user từ context
    console.log('🧠 Full user object:', user);

    let parsedDiscordSettings = {
      notifyOnLogin: false,
      notifyOnAccountUpdate: false,
      notifyOnError: true,
      messageFormat: 'embed',
      timezone: 'Asia/Ho_Chi_Minh',
    };

    if (typeof user.DiscordSettings === 'string') {
      try {
        parsedDiscordSettings = JSON.parse(user.DiscordSettings);
        console.log('✅ Parsed DiscordSettings (from string):', parsedDiscordSettings);
      } catch (err) {
        console.warn('⚠️ Lỗi parse DiscordSettings:', err);
      }
    } else if (typeof user.DiscordSettings === 'object') {
      parsedDiscordSettings = user.DiscordSettings;
      console.log('✅ Parsed DiscordSettings (from object):', parsedDiscordSettings);
    }

    // 🔍 Log thử các trường riêng biệt
    console.log('📌 DiscordWebhookUrl:', user.DiscordWebhookUrl);
    console.log('📌 DiscordUsername:', user.DiscordUsername);
    console.log('📌 DiscordNotificationsEnabled:', user.DiscordNotificationsEnabled);

    setProfileData({
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: user.fullName || user.username,
      avatar: user.avatar,
      timezone: user.timezone || 'UTC',
      language: user.language || language,
      type: user.type,
      status: user.status,
      approved: user.approved,
      createdAt: user.createdAt || '2024-01-15T08:00:00Z',
      lastLogin: user.lastLogin || new Date().toISOString(),

      DiscordWebhookUrl: user.DiscordWebhookUrl || '',
      DiscordUsername: user.DiscordUsername || '',
      DiscordNotificationsEnabled: user.DiscordNotificationsEnabled || false,
      DiscordSettings: parsedDiscordSettings,
    });

  } catch (error) {
    console.error('❌ Failed to load profile:', error);
    setMessage({ type: 'error', text: '❌ Failed to load profile data' });
  } finally {
    setIsLoading(false);
  }
};



  const loadNotificationSettings = async () => {
    try {
      // Mock API call - in real implementation:
      // const response = await apiRequest('/user/notification-settings');
      // setNotificationSettings(response.data);
    } catch (error) {
      console.error('Failed to load notification settings:', error);
    }
  };

  const loadApiKeys = async () => {
    try {
      // Mock API call - in real implementation:
      // const response = await apiRequest('/user/api-keys');
      
      // Mock data
      setApiKeys([
        {
          id: 1,
          name: 'Binance Main',
          exchange: 'Binance',
          status: 'active',
          createdAt: '2024-02-01T10:00:00Z',
          lastUsed: '2024-03-15T14:30:00Z'
        },
        {
          id: 2,
          name: 'Coinbase Pro',
          exchange: 'Coinbase',
          status: 'inactive',
          createdAt: '2024-01-20T15:30:00Z',
          lastUsed: '2024-03-10T09:15:00Z'
        }
      ]);
    } catch (error) {
      console.error('Failed to load API keys:', error);
    }
  };

  const handleProfileSave = async () => {
  try {
    setIsSaving(true);
    setMessage(null);

    // ✅ Kiểm tra user trước
    if (!user) {
      setMessage({ type: 'error', text: 'Không có thông tin người dùng' });
      return;
    }

    await accountApi.updateAccount(user.id, {
      username: profileData.username,
      email: profileData.email,
      fullName: profileData.fullName,
      language: profileData.language,
      timezone: profileData.timezone,

      // Các trường Discord
      DiscordWebhookUrl: profileData.DiscordWebhookUrl,
      DiscordUsername: profileData.DiscordUsername,
      DiscordNotificationsEnabled: profileData.DiscordNotificationsEnabled,

      // Trường mặc định (ẩn)
      DiscordSettings: {
        notifyOnLogin: false,
        notifyOnAccountUpdate: false,
        notifyOnError: true,
        messageFormat: 'embed',
        timezone: 'Asia/Ho_Chi_Minh',
      },
    });

    setMessage({ type: 'success', text: '✅ Profile updated successfully' });
    setTimeout(() => setMessage(null), 3000);

  } catch (error) {
    console.error('❌ Failed to save profile:', error);
    setMessage({ type: 'error', text: '❌ Cập nhật thất bại' });
  } finally {
    setIsSaving(false);
  }
};



  const handlePasswordChange = async () => {
  try {
    setIsSaving(true);
    setMessage(null);

    const { currentPassword, newPassword, confirmPassword } = passwordData;

    // Kiểm tra input cơ bản
    if (!currentPassword || !newPassword || !confirmPassword) {
      setMessage({ type: 'error', text: 'All password fields are required' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'New passwords do not match' });
      return;
    }

    if (newPassword.length < 8) {
      setMessage({ type: 'error', text: 'New password must be at least 8 characters long' });
      return;
    }

    // ✅ Gửi đúng API mới
    await authApi.changePassword(currentPassword, newPassword, confirmPassword);

    setPasswordData({
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    });

    setMessage({ type: 'success', text: 'Password updated successfully' });
    setTimeout(() => setMessage(null), 3000);
  } catch (error) {
    console.error('Failed to change password:', error);
    if (error instanceof ApiError && error.status === 401) {
      setMessage({ type: 'error', text: 'Current password is incorrect' });
    } else {
      setMessage({ type: 'error', text: 'Failed to update password' });
    }
  } finally {
    setIsSaving(false);
  }
};



  const handleNotificationSave = async () => {
    try {
      setIsSaving(true);
      setMessage(null);
      
      // In real implementation:
      // await apiRequest('/user/notification-settings', {
      //   method: 'PUT',
      //   body: JSON.stringify(notificationSettings)
      // });
      
      setMessage({ type: 'success', text: 'Notification settings updated successfully' });
      
      // Auto-hide success message after 3 seconds
      setTimeout(() => setMessage(null), 3000);
      
    } catch (error) {
      console.error('Failed to save notification settings:', error);
      setMessage({ type: 'error', text: 'Failed to update notification settings' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteApiKey = async (keyId: number) => {
    try {
      // In real implementation:
      // await apiRequest(`/user/api-keys/${keyId}`, { method: 'DELETE' });
      
      setApiKeys(prev => prev.filter(key => key.id !== keyId));
      setMessage({ type: 'success', text: 'API key deleted successfully' });
      
      // Auto-hide success message after 3 seconds
      setTimeout(() => setMessage(null), 3000);
      
    } catch (error) {
      console.error('Failed to delete API key:', error);
      setMessage({ type: 'error', text: 'Failed to delete API key' });
    }
  };

  const getUserTypeLabel = (type: number) => {
  switch (type) {
    case 0: return 'User';
    case 1: return 'Admin';
    case 2:
    case 99: return 'Superadmin';
    default: return 'Unknown';
  }
};


  const getUserStatusLabel = (status: number) => {
    return status === 1 ? 'Active' : 'Suspended';
  };

  const getApprovalStatusLabel = (approved: number) => {
    switch (approved) {
      case 0: return 'Pending Approval';
      case 1: return 'Approved';
      case 2: return 'Rejected';
      default: return 'Unknown';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          <FormattedMessage id="settings.title" />
        </h1>
        <p className="text-dark-400">
          <FormattedMessage id="settings.subtitle" />
        </p>
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
            <AlertCircle className="h-5 w-5 text-danger-500 flex-shrink-0" />
          )}
          <p className={`text-sm ${message.type === 'success' ? 'text-success-500' : 'text-danger-500'}`}>
            {message.text}
          </p>
        </div>
      )}
      
      <div className="flex flex-col md:flex-row gap-6">
        {/* Sidebar */}
        <div className="w-full md:w-64">
          <div className="card">
            <nav className="space-y-1">
              <button
                onClick={() => setActiveTab('profile')}
                className={`flex items-center w-full px-4 py-3 text-sm font-medium rounded-none ${
                  activeTab === 'profile'
                    ? 'bg-primary-500/10 text-primary-500 border-l-4 border-primary-500'
                    : 'text-dark-300 hover:bg-dark-700 hover:text-dark-200'
                }`}
              >
                <User className="mr-3 h-5 w-5" />
                <FormattedMessage id="settings.profile" />
              </button>
              <button
                onClick={() => setActiveTab('security')}
                className={`flex items-center w-full px-4 py-3 text-sm font-medium rounded-none ${
                  activeTab === 'security'
                    ? 'bg-primary-500/10 text-primary-500 border-l-4 border-primary-500'
                    : 'text-dark-300 hover:bg-dark-700 hover:text-dark-200'
                }`}
              >
                <Shield className="mr-3 h-5 w-5" />
                <FormattedMessage id="settings.security" />
              </button>
              <button
                onClick={() => setActiveTab('api')}
                className={`flex items-center w-full px-4 py-3 text-sm font-medium rounded-none ${
                  activeTab === 'api'
                    ? 'bg-primary-500/10 text-primary-500 border-l-4 border-primary-500'
                    : 'text-dark-300 hover:bg-dark-700 hover:text-dark-200'
                }`}
              >
                <Key className="mr-3 h-5 w-5" />
                <FormattedMessage id="settings.api" />
              </button>
              <button
                onClick={() => setActiveTab('notifications')}
                className={`flex items-center w-full px-4 py-3 text-sm font-medium rounded-none ${
                  activeTab === 'notifications'
                    ? 'bg-primary-500/10 text-primary-500 border-l-4 border-primary-500'
                    : 'text-dark-300 hover:bg-dark-700 hover:text-dark-200'
                }`}
              >
                <Bell className="mr-3 h-5 w-5" />
                <FormattedMessage id="settings.notifications" />
              </button>
              <button
                onClick={() => setActiveTab('payment')}
                className={`flex items-center w-full px-4 py-3 text-sm font-medium rounded-none ${
                  activeTab === 'payment'
                    ? 'bg-primary-500/10 text-primary-500 border-l-4 border-primary-500'
                    : 'text-dark-300 hover:bg-dark-700 hover:text-dark-200'
                }`}
              >
                <CreditCard className="mr-3 h-5 w-5" />
                <FormattedMessage id="settings.payment" />
              </button>
            </nav>
          </div>
        </div>
        
        {/* Content */}
        <div className="flex-1">
          <div className="card">
            {activeTab === 'profile' && (
              <div className="p-6">
                <h2 className="text-lg font-medium mb-6">
                  <FormattedMessage id="settings.profile" />
                </h2>
                
                <div className="space-y-6">
                  {/* Account Status Info */}
                  <div className="bg-dark-700/30 rounded-lg p-4">
                    <h3 className="text-sm font-medium mb-3">Account Information</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-dark-400">Account Type:</span>
                        <div className={`mt-1 px-2 py-1 rounded text-xs inline-block ${
                          profileData.type === 1 ? 'bg-danger-500/10 text-danger-500' :
                          profileData.type === 2 ? 'bg-warning-300/10 text-warning-300' :
                          'bg-primary-500/10 text-primary-500'
                        }`}>
                          {getUserTypeLabel(profileData.type)}
                        </div>
                      </div>
                      <div>
                        <span className="text-dark-400">Status:</span>
                        <div className={`mt-1 px-2 py-1 rounded text-xs inline-block ${
                          profileData.status === 1 ? 'bg-success-500/10 text-success-500' : 'bg-danger-500/10 text-danger-500'
                        }`}>
                          {getUserStatusLabel(profileData.status)}
                        </div>
                      </div>
                      <div>
                        <span className="text-dark-400">Approval:</span>
                        <div className={`mt-1 px-2 py-1 rounded text-xs inline-block ${
                          profileData.approved === 1 ? 'bg-success-500/10 text-success-500' :
                          profileData.approved === 0 ? 'bg-warning-300/10 text-warning-300' :
                          'bg-danger-500/10 text-danger-500'
                        }`}>
                          {getApprovalStatusLabel(profileData.approved)}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-6">
                    <div className="sm:w-32">
                      <div className="aspect-square rounded-full bg-dark-700 overflow-hidden">
                        <img
                          src={profileData.avatar || "https://images.pexels.com/photos/415829/pexels-photo-415829.jpeg?auto=compress&cs=tinysrgb&w=150"}
                          alt="Profile"
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <button className="mt-2 text-xs text-primary-500 hover:text-primary-400 w-full text-center flex items-center justify-center">
                        <Camera className="mr-1 h-3 w-3" />
                        <FormattedMessage id="settings.changePhoto" />
                      </button>
                    </div>
                    
                    <div className="flex-1 space-y-4">
                      <div>
                        <label htmlFor="username" className="form-label">
                          Username
                        </label>
                        <input
                          type="text"
                          id="username"
                          className="form-input"
                          value={profileData.username}
                          onChange={(e) => setProfileData(prev => ({ ...prev, username: e.target.value }))}
                        />
                      </div>

                      <div>
                        <label htmlFor="fullName" className="form-label">
                          <FormattedMessage id="settings.name" />
                        </label>
                        <input
                          type="text"
                          id="fullName"
                          className="form-input"
                          value={profileData.fullName || ''}
                          onChange={(e) => setProfileData(prev => ({ ...prev, fullName: e.target.value }))}
                        />
                      </div>
                      
                      <div>
                        <label htmlFor="email" className="form-label">
                          <FormattedMessage id="settings.email" />
                        </label>
                        <input
                          type="email"
                          id="email"
                          className="form-input"
                          value={profileData.email}
                          onChange={(e) => setProfileData(prev => ({ ...prev, email: e.target.value }))}
                        />
                      </div>
                      <div>
  <label className="form-label">Discord Webhook URL</label>
  <input
    type="url"
    className="form-input"
    value={profileData.DiscordWebhookUrl || ''}
    onChange={(e) =>
      setProfileData(prev => ({ ...prev, DiscordWebhookUrl: e.target.value }))
    }
  />
</div>

<div>
  <label className="form-label">Discord Username</label>
  <input
    type="text"
    className="form-input"
    value={profileData.DiscordUsername || ''}
    onChange={(e) =>
      setProfileData(prev => ({ ...prev, DiscordUsername: e.target.value }))
    }
  />
</div>

<div className="flex items-center">
  <input
    type="checkbox"
    className="form-checkbox"
    checked={profileData.DiscordNotificationsEnabled || false}
    onChange={(e) =>
      setProfileData(prev => ({ ...prev, DiscordNotificationsEnabled: e.target.checked }))
    }
  />
  <label className="ml-2 text-sm">Bật thông báo Discord</label>
</div>

{profileData.type !== 0 && (
  <div>
    <label className="form-label">Discord Settings (JSON)</label>
    <textarea
      className="form-input"
      rows={5}
      value={JSON.stringify(profileData.DiscordSettings, null, 2)}
      onChange={(e) => {
        try {
          const parsed = JSON.parse(e.target.value || '{}');
          setProfileData((prev) => ({
            ...prev,
            DiscordSettings: parsed,
          }));
        } catch (err) {
          console.warn('⚠️ Invalid JSON input');
        }
      }}
    />
  </div>
)}


                      
                     {/* <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                         <div>
                          <label htmlFor="timezone" className="form-label">
                            <FormattedMessage id="settings.timezone" />
                          </label>
                        <div className="relative">
                            <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-dark-400" />
                             <select
                              id="timezone"
                              className="form-select pl-10"
                              value={profileData.timezone}
                              onChange={(e) => setProfileData(prev => ({ ...prev, timezone: e.target.value }))}
                            >
                              <option value="UTC">UTC</option>
                              <option value="EST">Eastern Time (ET)</option>
                              <option value="CST">Central Time (CT)</option>
                              <option value="MST">Mountain Time (MT)</option>
                              <option value="PST">Pacific Time (PT)</option>
                              <option value="GMT+7">GMT+7 (Vietnam)</option>
                            </select>
                          </div>
                        </div>
                        
                        <div>
                         <label htmlFor="language" className="form-label">
                            <FormattedMessage id="settings.language" />
                          </label>
                          <div className="relative">
                            <Globe className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-dark-400" />
                            <select
                              id="language"
                              className="form-select pl-10"
                              value={profileData.language}
                              onChange={(e) => setProfileData(prev => ({ ...prev, language: e.target.value }))}
                            >
                              <option value="en">English</option>
                              <option value="vi">Tiếng Việt</option>
                            </select>
                          </div>
                        </div>
                      </div>*/}
                    </div>
                  </div>
                  
                  <div className="border-t border-dark-700 pt-6">
                    <button 
                      onClick={handleProfileSave}
                      disabled={isSaving}
                      className="btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSaving ? (
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                      ) : (
                        <Save className="mr-2 h-4 w-4" />
                      )}
                      <FormattedMessage id="settings.saveChanges" />
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            {activeTab === 'security' && (
              <div className="p-6">
                <h2 className="text-lg font-medium mb-6">
                  <FormattedMessage id="settings.security" />
                </h2>
                
                <div className="space-y-6">
                  <div>
                    <h3 className="text-base font-medium mb-4">
                      <FormattedMessage id="settings.updatePassword" />
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <label htmlFor="current-password" className="form-label">
                          <FormattedMessage id="settings.currentPassword" />
                        </label>
                        <input
                          type="password"
                          id="current-password"
                          className="form-input"
                          placeholder="••••••••"
                          value={passwordData.currentPassword}
                          onChange={(e) => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
                        />
                      </div>
                      
                      <div>
                        <label htmlFor="new-password" className="form-label">
                          <FormattedMessage id="settings.newPassword" />
                        </label>
                        <input
                          type="password"
                          id="new-password"
                          className="form-input"
                          placeholder="••••••••"
                          value={passwordData.newPassword}
                          onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                        />
                      </div>
                      
                      <div>
                        <label htmlFor="confirm-password" className="form-label">
                          <FormattedMessage id="settings.confirmPassword" />
                        </label>
                        <input
                          type="password"
                          id="confirm-password"
                          className="form-input"
                          placeholder="••••••••"
                          value={passwordData.confirmPassword}
                          onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                        />
                      </div>
                    </div>
                    
                    <button 
                      onClick={handlePasswordChange}
                      disabled={isSaving}
                      className="btn btn-primary mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSaving ? (
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                      ) : (
                        <Lock className="mr-2 h-4 w-4" />
                      )}
                      <FormattedMessage id="settings.updatePassword" />
                    </button>
                  </div>
                  
                  <div className="border-t border-dark-700 pt-6">
                    <h3 className="text-base font-medium mb-4">
                      <FormattedMessage id="settings.enable2FA" />
                    </h3>
                    <p className="text-dark-400 text-sm mb-4">
                      Two-factor authentication adds an extra layer of security to your account by requiring more than just a password to sign in.
                    </p>
                    
                    <button className="btn btn-outline">
                      <FormattedMessage id="settings.enable2FA" />
                    </button>
                  </div>
                  
                  <div className="border-t border-dark-700 pt-6">
                    <h3 className="text-base font-medium mb-4">
                      <FormattedMessage id="settings.sessions" />
                    </h3>
                    <p className="text-dark-400 text-sm mb-4">
                      These are the devices that are currently logged into your account.
                    </p>
                    
                    <div className="card bg-dark-700 p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">Chrome on Windows</p>
                          <p className="text-xs text-dark-400">Last active 2 minutes ago • New York, USA</p>
                        </div>
                        <span className="badge badge-success">Current</span>
                      </div>
                    </div>
                    
                    <button className="btn btn-outline mt-4 text-danger-500 border-danger-500 hover:bg-danger-500/10">
                      <FormattedMessage id="settings.signOutOthers" />
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            {activeTab === 'api' && (
              <div className="p-6">
                <h2 className="text-lg font-medium mb-6">
                  <FormattedMessage id="settings.api" />
                </h2>
                
                <div className="space-y-6">
                  <p className="text-dark-400">
                    API keys allow you to connect your exchange accounts and automate your trading strategies.
                  </p>
                  
                  <div className="space-y-4">
                    {apiKeys.map((apiKey) => (
                      <div key={apiKey.id} className="card bg-dark-700 p-4">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                          <div>
                            <p className="text-sm font-medium">{apiKey.name}</p>
                            <p className="text-xs text-dark-400">
                              {apiKey.exchange} • Created {new Date(apiKey.createdAt).toLocaleDateString()}
                              {apiKey.lastUsed && ` • Last used ${new Date(apiKey.lastUsed).toLocaleDateString()}`}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-1 rounded text-xs ${
                              apiKey.status === 'active' 
                                ? 'bg-success-500/10 text-success-500' 
                                : 'bg-dark-600 text-dark-300'
                            }`}>
                              {apiKey.status}
                            </span>
                            <button className="btn btn-outline py-1 px-3 text-xs">Edit</button>
                            <button 
                              onClick={() => handleDeleteApiKey(apiKey.id)}
                              className="btn btn-outline py-1 px-3 text-xs text-danger-500 border-danger-500 hover:bg-danger-500/10"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <button 
                    onClick={() => setShowAddApiKey(true)}
                    className="btn btn-primary"
                  >
                    <Key className="mr-2 h-4 w-4" />
                    Connect New API Key
                  </button>
                </div>
              </div>
            )}
            
            {activeTab === 'notifications' && (
              <div className="p-6">
                <h2 className="text-lg font-medium mb-6">
                  <FormattedMessage id="settings.notifications" />
                </h2>
                
                <div className="space-y-6">
                  <div>
                    <h3 className="text-base font-medium mb-4">Email Notifications</h3>
                    
                    <div className="space-y-4">
                      {Object.entries(notificationSettings.emailNotifications).map(([key, value]) => (
                        <div key={key} className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium">
                              {key === 'botActivity' && 'Bot Activity'}
                              {key === 'marketAlerts' && 'Market Alerts'}
                              {key === 'securityAlerts' && 'Security Alerts'}
                              {key === 'newsletter' && 'Newsletter'}
                            </p>
                            <p className="text-xs text-dark-400">
                              {key === 'botActivity' && 'Get notified when your bots complete trades'}
                              {key === 'marketAlerts' && 'Get notified about significant market movements'}
                              {key === 'securityAlerts' && 'Get notified about security events on your account'}
                              {key === 'newsletter' && 'Receive our weekly newsletter with updates and tips'}
                            </p>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input 
                              type="checkbox" 
                              className="sr-only peer" 
                              checked={value}
                              onChange={(e) => setNotificationSettings(prev => ({
                                ...prev,
                                emailNotifications: {
                                  ...prev.emailNotifications,
                                  [key]: e.target.checked
                                }
                              }))}
                            />
                            <div className="w-11 h-6 bg-dark-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="border-t border-dark-700 pt-6">
                    <h3 className="text-base font-medium mb-4">Push Notifications</h3>
                    
                    <div className="space-y-4">
                      {Object.entries(notificationSettings.pushNotifications).map(([key, value]) => (
                        <div key={key} className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium">
                              {key === 'tradingSignals' && 'Trading Signals'}
                              {key === 'priceAlerts' && 'Price Alerts'}
                            </p>
                            <p className="text-xs text-dark-400">
                              {key === 'tradingSignals' && 'Get notified about new trading signals'}
                              {key === 'priceAlerts' && 'Get notified when prices hit your target levels'}
                            </p>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input 
                              type="checkbox" 
                              className="sr-only peer" 
                              checked={value}
                              onChange={(e) => setNotificationSettings(prev => ({
                                ...prev,
                                pushNotifications: {
                                  ...prev.pushNotifications,
                                  [key]: e.target.checked
                                }
                              }))}
                            />
                            <div className="w-11 h-6 bg-dark-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="border-t border-dark-700 pt-6">
                    <button 
                      onClick={handleNotificationSave}
                      disabled={isSaving}
                      className="btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSaving ? (
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                      ) : (
                        <Save className="mr-2 h-4 w-4" />
                      )}
                      <FormattedMessage id="settings.saveChanges" />
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            {activeTab === 'payment' && (
              <div className="p-6">
                <h2 className="text-lg font-medium mb-6">
                  <FormattedMessage id="settings.payment" />
                </h2>
                
                <div className="space-y-6">
                  <p className="text-dark-400">
                    Manage your payment methods for premium subscriptions and marketplace purchases.
                  </p>
                  
                  <div className="card bg-dark-700 p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div className="flex items-center">
                        <div className="h-10 w-16 bg-dark-600 rounded flex items-center justify-center">
                          <CreditCard className="h-6 w-6 text-dark-300" />
                        </div>
                        <div className="ml-4">
                          <p className="text-sm font-medium">•••• •••• •••• 4242</p>
                          <p className="text-xs text-dark-400">Visa • Expires 12/2025</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <span className="badge badge-success">Default</span>
                        <button className="btn btn-outline py-1 px-3 text-xs">Edit</button>
                        <button className="btn btn-outline py-1 px-3 text-xs text-danger-500 border-danger-500 hover:bg-danger-500/10">
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  <button className="btn btn-primary">
                    <CreditCard className="mr-2 h-4 w-4" />
                    Add Payment Method
                  </button>
                  
                  <div className="border-t border-dark-700 pt-6">
                    <h3 className="text-base font-medium mb-4">Billing History</h3>
                    
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-dark-700">
                        <thead>
                          <tr>
                            <th className="py-3.5 pl-4 pr-3 text-left text-xs font-medium text-dark-400 sm:pl-0">Date</th>
                            <th className="px-3 py-3.5 text-left text-xs font-medium text-dark-400">Description</th>
                            <th className="px-3 py-3.5 text-right text-xs font-medium text-dark-400">Amount</th>
                            <th className="px-3 py-3.5 text-right text-xs font-medium text-dark-400">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-dark-700">
                          <tr>
                            <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium sm:pl-0">
                              Mar 12, 2023
                            </td>
                            <td className="whitespace-nowrap px-3 py-4 text-sm">
                              Pro Plan Subscription
                            </td>
                            <td className="whitespace-nowrap px-3 py-4 text-sm text-right">
                              <FormattedNumber
                                value={49.99}
                                style="currency"
                                currency="USD"
                              />
                            </td>
                            <td className="whitespace-nowrap px-3 py-4 text-sm text-right">
                              <span className="badge badge-success">Paid</span>
                            </td>
                          </tr>
                          <tr>
                            <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium sm:pl-0">
                              Feb 12, 2023
                            </td>
                            <td className="whitespace-nowrap px-3 py-4 text-sm">
                              Pro Plan Subscription
                            </td>
                            <td className="whitespace-nowrap px-3 py-4 text-sm text-right">
                              <FormattedNumber
                                value={49.99}
                                style="currency"
                                currency="USD"
                              />
                            </td>
                            <td className="whitespace-nowrap px-3 py-4 text-sm text-right">
                              <span className="badge badge-success">Paid</span>
                            </td>
                          </tr>
                          <tr>
                            <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium sm:pl-0">
                              Jan 25, 2023
                            </td>
                            <td className="whitespace-nowrap px-3 py-4 text-sm">
                              ETH Breakout Hunter Bot
                            </td>
                            <td className="whitespace-nowrap px-3 py-4 text-sm text-right">
                              <FormattedNumber
                                value={59.99}
                                style="currency"
                                currency="USD"
                              />
                            </td>
                            <td className="whitespace-nowrap px-3 py-4 text-sm text-right">
                              <span className="badge badge-success">Paid</span>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}