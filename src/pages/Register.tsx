import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, User, ArrowRight, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { FormattedMessage, useIntl } from 'react-intl';

export default function Register() {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    acceptTerms: false
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  
  const { register } = useAuth();
  const navigate = useNavigate();
  const intl = useIntl();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const validateForm = () => {
    if (!formData.username || !formData.email || !formData.password || !formData.confirmPassword) {
      setError('Vui lòng điền đầy đủ thông tin');
      return false;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Mật khẩu xác nhận không khớp');
      return false;
    }

    if (formData.password.length < 8) {
      setError('Mật khẩu phải có ít nhất 8 ký tự');
      return false;
    }

    if (!formData.acceptTerms) {
      setError('Bạn phải đồng ý với điều khoản sử dụng');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      await register(formData.username, formData.password, formData.email);

      setSuccess(true);
    } catch (err: any) {
      console.error('Registration error:', err);
      setError(err.message || 'Đăng ký thất bại. Vui lòng thử lại.');
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 flex items-center justify-center p-fluid-4">
        <div className="relative w-full max-w-md text-center">
          <div className="card p-8 backdrop-blur-sm bg-dark-800/80 border border-dark-700/50">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-warning-300/10 rounded-full mb-6">
              <Clock className="h-fluid-input-sm w-8 text-warning-300" />
            </div>
            
            <h1 className="text-2xl font-bold mb-4 text-warning-300">
              Đăng Ký Thành Công!
            </h1>
            
            <div className="text-left space-y-4 mb-6">
              <div className="p-fluid-4 bg-warning-300/10 border border-warning-300/20 rounded-lg">
                <div className="flex items-start gap-fluid-3">
                  <Clock className="h-5 w-5 text-warning-300 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-fluid-sm font-medium text-warning-300 mb-2">Tài khoản đang chờ xét duyệt</h3>
                    <ul className="text-xs text-warning-300/80 space-y-1">
                      <li>• Tài khoản của bạn đã được tạo thành công</li>
                      <li>• Hiện tại đang ở trạng thái chờ phê duyệt</li>
                      <li>• Administrator sẽ xem xét và phê duyệt tài khoản</li>
                      <li>• Bạn sẽ có thể đăng nhập sau khi được phê duyệt</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="p-fluid-4 bg-info-500/10 border border-info-500/20 rounded-lg">
                <div className="flex items-start gap-fluid-3">
                  <AlertCircle className="h-5 w-5 text-info-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-fluid-sm font-medium text-info-500 mb-2">Thông tin tài khoản</h3>
                    <div className="text-xs text-info-400 space-y-1">
                      <p><strong>Username:</strong> {formData.username}</p>
                      <p><strong>Email:</strong> {formData.email}</p>
                      <p><strong>Trạng thái:</strong> Chờ phê duyệt</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="space-y-3">
              <Link
                to="/login"
                className="w-full btn btn-primary py-fluid-3 text-fluid-base font-medium inline-flex items-center justify-center"
              >
                Về trang đăng nhập
              </Link>
              
              <Link
                to="/guest"
                className="w-full btn btn-outline py-fluid-3 text-fluid-base font-medium"
              >
                Tiếp tục ở chế độ khách
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 flex items-center justify-center p-fluid-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-fluid-40 -right-40 w-80 h-fluid-input-sm0 bg-success-500/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-fluid-input-sm0 bg-primary-500/10 rounded-full blur-3xl"></div>
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-tr from-success-600 to-success-500 rounded-2xl mb-4">
            <span className="text-2xl font-bold text-white">3C</span>
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-dark-300 bg-clip-text text-transparent">
            <FormattedMessage id="auth.createAccount" />
          </h1>
          <p className="text-dark-400 mt-2">
            <FormattedMessage id="auth.registerSubtitle" />
          </p>
        </div>

        {/* Register Form */}
        <div className="card p-8 backdrop-blur-sm bg-dark-800/80 border border-dark-700/50">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="flex items-center gap-fluid-3 p-fluid-4 bg-danger-500/10 border border-danger-500/20 rounded-lg">
                <AlertCircle className="h-5 w-5 text-danger-500 flex-shrink-0" />
                <p className="text-fluid-sm text-danger-500">{error}</p>
              </div>
            )}

            <div>
              <label htmlFor="username" className="form-label">
                Tên đăng nhập
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-dark-400" />
                </div>
                <input
                  id="username"
                  name="username"
                  type="text"
                  required
                  className="form-input pl-10"
                  placeholder="Nhập tên đăng nhập"
                  value={formData.username}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div>
              <label htmlFor="email" className="form-label">
                <FormattedMessage id="auth.email" />
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-dark-400" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  className="form-input pl-10"
                  placeholder={intl.formatMessage({ id: 'auth.emailPlaceholder' })}
                  value={formData.email}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="form-label">
                <FormattedMessage id="auth.password" />
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-dark-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  className="form-input pl-10 pr-10"
                  placeholder={intl.formatMessage({ id: 'auth.passwordPlaceholder' })}
                  value={formData.password}
                  onChange={handleChange}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5 text-dark-400 hover:text-dark-300" />
                  ) : (
                    <Eye className="h-5 w-5 text-dark-400 hover:text-dark-300" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="form-label">
                <FormattedMessage id="auth.confirmPassword" />
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-dark-400" />
                </div>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  className="form-input pl-10 pr-10"
                  placeholder={intl.formatMessage({ id: 'auth.confirmPasswordPlaceholder' })}
                  value={formData.confirmPassword}
                  onChange={handleChange}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-5 w-5 text-dark-400 hover:text-dark-300" />
                  ) : (
                    <Eye className="h-5 w-5 text-dark-400 hover:text-dark-300" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center">
              <input
                id="acceptTerms"
                name="acceptTerms"
                type="checkbox"
                className="form-checkbox"
                checked={formData.acceptTerms}
                onChange={handleChange}
              />
              <label htmlFor="acceptTerms" className="ml-2 text-fluid-sm text-dark-300">
                <FormattedMessage id="auth.acceptTerms" />
              </label>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full btn btn-primary py-fluid-3 text-fluid-base font-medium relative overflow-hidden group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="relative z-10 flex items-center justify-center">
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <FormattedMessage id="auth.signUp" />
                    <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </span>
            </button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-dark-400">
              <FormattedMessage id="auth.haveAccount" />{' '}
              <Link
                to="/login"
                className="text-primary-500 hover:text-primary-400 font-medium transition-colors"
              >
                <FormattedMessage id="auth.signIn" />
              </Link>
            </p>
          </div>
        </div>

        {/* Information about approval process */}
        <div className="mt-6 p-fluid-4 bg-info-500/10 border border-info-500/20 rounded-lg">
          <div className="flex items-start gap-fluid-3">
            <AlertCircle className="h-5 w-5 text-info-500 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-fluid-sm font-medium text-info-500 mb-2">Quy trình đăng ký</h3>
              <ul className="text-xs text-info-400 space-y-1">
                <li>• Sau khi đăng ký, tài khoản sẽ ở trạng thái chờ phê duyệt</li>
                <li>• Administrator sẽ xem xét và phê duyệt tài khoản của bạn</li>
                <li>• Bạn sẽ có thể đăng nhập sau khi được phê duyệt</li>
                <li>• Quá trình này thường mất 1-2 ngày làm việc</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}