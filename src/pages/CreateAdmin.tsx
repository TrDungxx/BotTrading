import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, User, ArrowRight, AlertCircle, Shield, Key } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { authApi, ApiError } from '../utils/api';

export default function CreateAdmin() {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    adminKey: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showAdminKey, setShowAdminKey] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  
  const navigate = useNavigate();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await authApi.createAdmin(formData.username, formData.email, formData.password, formData.adminKey);
      setSuccess(true);
      
      // Auto redirect after 3 seconds
      setTimeout(() => {
        navigate('/login');
      }, 3000);
      
    } catch (err) {
      if (err instanceof ApiError) {
        switch (err.status) {
          case 403:
            setError('Invalid admin creation key. Please contact system administrator.');
            break;
          case 409:
            setError('Email already exists. Please use a different email.');
            break;
          default:
            setError(err.message || 'Failed to create admin account');
        }
      } else {
        setError('Failed to create admin account. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 flex items-center justify-center p-4">
        <div className="relative w-full max-w-md text-center">
          <div className="card p-8 backdrop-blur-sm bg-dark-800/80 border border-dark-700/50">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-success-500/10 rounded-full mb-6">
              <Shield className="h-8 w-8 text-success-500" />
            </div>
            
            <h1 className="text-2xl font-bold mb-4 text-success-500">
              Admin Account Created!
            </h1>
            
            <p className="text-dark-400 mb-6">
              Admin account has been created successfully. You will be redirected to login page in a few seconds.
            </p>
            
            <Link
              to="/login"
              className="w-full btn btn-primary py-3 text-base font-medium inline-flex items-center justify-center"
            >
              Go to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 flex items-center justify-center p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-danger-500/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-primary-500/10 rounded-full blur-3xl"></div>
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-tr from-danger-600 to-danger-500 rounded-2xl mb-4">
            <Shield className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-dark-300 bg-clip-text text-transparent">
            Create Admin Account
          </h1>
          <p className="text-dark-400 mt-2">
            Create a new administrator account with full system access
          </p>
        </div>

        {/* Create Admin Form */}
        <div className="card p-8 backdrop-blur-sm bg-dark-800/80 border border-dark-700/50">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="flex items-center gap-3 p-4 bg-danger-500/10 border border-danger-500/20 rounded-lg">
                <AlertCircle className="h-5 w-5 text-danger-500 flex-shrink-0" />
                <p className="text-sm text-danger-500">{error}</p>
              </div>
            )}

            <div>
              <label htmlFor="adminKey" className="form-label">
                Admin Creation Key
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Key className="h-5 w-5 text-danger-500" />
                </div>
                <input
                  id="adminKey"
                  name="adminKey"
                  type={showAdminKey ? 'text' : 'password'}
                  required
                  className="form-input pl-10 pr-10 border-danger-500/30 focus:border-danger-500"
                  placeholder="Enter admin creation key"
                  value={formData.adminKey}
                  onChange={handleChange}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowAdminKey(!showAdminKey)}
                >
                  {showAdminKey ? (
                    <EyeOff className="h-5 w-5 text-dark-400 hover:text-dark-300" />
                  ) : (
                    <Eye className="h-5 w-5 text-dark-400 hover:text-dark-300" />
                  )}
                </button>
              </div>
              <p className="mt-1 text-xs text-danger-400">
                This key is required to create admin accounts. Contact system administrator if you don't have it.
              </p>
            </div>

            <div>
              <label htmlFor="username" className="form-label">
                Username
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
                  placeholder="Enter admin username"
                  value={formData.username}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div>
              <label htmlFor="email" className="form-label">
                Email Address
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
                  placeholder="Enter admin email"
                  value={formData.email}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="form-label">
                Password
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
                  placeholder="Enter admin password"
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

            <button
              type="submit"
              disabled={isLoading}
              className="w-full btn bg-danger-500 hover:bg-danger-600 text-white py-3 text-base font-medium relative overflow-hidden group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="relative z-10 flex items-center justify-center">
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Shield className="mr-2 h-5 w-5" />
                    Create Admin Account
                    <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </span>
            </button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-dark-400">
              Already have an account?{' '}
              <Link
                to="/login"
                className="text-primary-500 hover:text-primary-400 font-medium transition-colors"
              >
                Sign In
              </Link>
            </p>
          </div>
        </div>

        {/* Development Info */}
        <div className="mt-6 p-4 bg-warning-300/10 border border-warning-300/20 rounded-lg">
          <h3 className="text-sm font-medium text-warning-300 mb-2">Development Mode</h3>
          <p className="text-xs text-warning-300/80 mb-2">
            For testing purposes, use admin key: <code className="bg-dark-700 px-1 rounded">ADMIN_CREATE_KEY_2024</code>
          </p>
          <p className="text-xs text-warning-300/60">
            In production, this key should be securely managed and not exposed.
          </p>
        </div>
      </div>
    </div>
  );
}