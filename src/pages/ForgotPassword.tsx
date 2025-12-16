import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowRight, ArrowLeft, CheckCircle, AlertCircle } from 'lucide-react';
import { FormattedMessage, useIntl } from 'react-intl';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isEmailSent, setIsEmailSent] = useState(false);
  const [error, setError] = useState('');
  
  const intl = useIntl();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      setIsEmailSent(true);
    } catch (err) {
      setError(intl.formatMessage({ id: 'auth.error.resetFailed' }));
    } finally {
      setIsLoading(false);
    }
  };

  if (isEmailSent) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 flex items-center justify-center p-fluid-4">
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-fluid-40 -right-40 w-80 h-fluid-input-sm0 bg-success-500/10 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-fluid-input-sm0 bg-primary-500/10 rounded-full blur-3xl"></div>
        </div>

        <div className="relative w-full max-w-md text-center">
          <div className="card p-8 backdrop-blur-sm bg-dark-800/80 border border-dark-700/50">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-success-500/10 rounded-full mb-6">
              <CheckCircle className="h-fluid-input-sm w-8 text-success-500" />
            </div>
            
            <h1 className="text-2xl font-bold mb-4">
              <FormattedMessage id="auth.emailSent" />
            </h1>
            
            <p className="text-dark-400 mb-6">
              <FormattedMessage 
                id="auth.emailSentDescription" 
                values={{ email: <span className="text-white font-medium">{email}</span> }}
              />
            </p>
            
            <div className="space-y-4">
              <Link
                to="/login"
                className="w-full btn btn-primary py-fluid-3 text-fluid-base font-medium inline-flex items-center justify-center"
              >
                <ArrowLeft className="mr-2 h-5 w-5" />
                <FormattedMessage id="auth.backToLogin" />
              </Link>
              
              <button
                onClick={() => setIsEmailSent(false)}
                className="w-full btn btn-outline py-fluid-3 text-fluid-base font-medium"
              >
                <FormattedMessage id="auth.resendEmail" />
              </button>
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
        <div className="absolute -top-fluid-40 -right-40 w-80 h-fluid-input-sm0 bg-warning-300/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-fluid-input-sm0 bg-primary-500/10 rounded-full blur-3xl"></div>
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-tr from-warning-400 to-warning-300 rounded-2xl mb-4">
            <span className="text-2xl font-bold text-dark-900">3C</span>
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-dark-300 bg-clip-text text-transparent">
            <FormattedMessage id="auth.forgotPassword" />
          </h1>
          <p className="text-dark-400 mt-2">
            <FormattedMessage id="auth.forgotPasswordSubtitle" />
          </p>
        </div>

        {/* Forgot Password Form */}
        <div className="card p-8 backdrop-blur-sm bg-dark-800/80 border border-dark-700/50">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="flex items-center gap-fluid-3 p-fluid-4 bg-danger-500/10 border border-danger-500/20 rounded-lg">
                <AlertCircle className="h-5 w-5 text-danger-500 flex-shrink-0" />
                <p className="text-fluid-sm text-danger-500">{error}</p>
              </div>
            )}

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
                  type="email"
                  required
                  className="form-input pl-10"
                  placeholder={intl.formatMessage({ id: 'auth.emailPlaceholder' })}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <p className="mt-2 text-fluid-sm text-dark-400">
                <FormattedMessage id="auth.resetPasswordDescription" />
              </p>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full btn btn-primary py-fluid-3 text-fluid-base font-medium relative overflow-hidden group"
            >
              <span className="relative z-10 flex items-center justify-center">
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <FormattedMessage id="auth.sendResetLink" />
                    <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </span>
              <div className="absolute inset-0 bg-gradient-to-r from-warning-400 to-warning-300 opacity-0 group-hover:opacity-100 transition-opacity"></div>
            </button>
          </form>

          <div className="mt-8 text-center">
            <Link
              to="/login"
              className="inline-flex items-center text-primary-500 hover:text-primary-400 font-medium transition-colors"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              <FormattedMessage id="auth.backToLogin" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}