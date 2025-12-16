import React, { useState } from 'react';
import { RefreshCcw, CheckCircle, XCircle,Database } from 'lucide-react';

interface SyncDataButtonProps {
  className?: string;
}

type Status = 'idle' | 'loading' | 'success' | 'error';

const SyncDataButton: React.FC<SyncDataButtonProps> = ({ className }) => {
  const [status, setStatus] = useState<Status>('idle');
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSync = async () => {
    if (status === 'loading') return;
    
    setStatus('loading');
    setProgress(0);
    setErrorMsg('');

    // Animation progress
    const startTime = Date.now();
    const duration = 2500;
    let animationDone = false;
    
    const animateProgress = () => {
      const elapsed = Date.now() - startTime;
      const newProgress = Math.min((elapsed / duration) * 100, 95);
      setProgress(newProgress);
      
      if (elapsed < duration && newProgress < 95) {
        requestAnimationFrame(animateProgress);
      } else {
        animationDone = true;
      }
    };
    
    requestAnimationFrame(animateProgress);

    let apiSuccess = false;
    let apiErrorMsg = '';

    try {
      const res = await fetch('http://45.77.33.141/exchange/getAll');
      apiSuccess = res.ok;
      if (!res.ok) {
        apiErrorMsg = 'Đồng bộ thất bại!';
      }
    } catch (error) {
      console.error('Sync failed:', error);
      apiErrorMsg = 'Lỗi kết nối server!';
    }

    // Đợi animation xong
    const waitForAnimation = () => {
      return new Promise<void>((resolve) => {
        const check = () => {
          if (animationDone || Date.now() - startTime >= duration) {
            resolve();
          } else {
            setTimeout(check, 100);
          }
        };
        check();
      });
    };

    await waitForAnimation();

    // Hoàn thành 100%
    setProgress(100);
    
    // Hiện kết quả
    setTimeout(() => {
      if (apiSuccess) {
        setStatus('success');
      } else {
        setErrorMsg(apiErrorMsg);
        setStatus('error');
      }
      
      // Tự động đóng sau 2s
      setTimeout(() => {
        setStatus('idle');
        setProgress(0);
      }, 2000);
    }, 300);
  };

  const isOpen = status !== 'idle';

  return (
    <>
      {/* Sync Button */}
      <button
        onClick={handleSync}
        disabled={status === 'loading'}
        className={`p-1.5 hover:bg-[#2b3139] border border-dark-600 rounded transition-colors ${status === 'loading' ? 'opacity-50' : ''} ${className || ''}`}
        title="Sync Exchange Data"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <Database 
          size={16} 
          className={status === 'loading' ? 'animate-spin' : ''} 
          style={{ color: '#848e9c' }}
        />
      </button>

      {/* Popup */}
      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm" 
            onClick={() => status !== 'loading' && setStatus('idle')}
          />
          
          {/* Modal */}
          <div className="relative bg-[#1e2329] border border-[#2b3139] rounded-2xl p-6 w-80 shadow-2xl">
            
            {/* Loading State */}
            {status === 'loading' && (
              <>
                <div className="text-center mb-4">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#fcd535]/20 mb-3">
                    <Database className="h-6 w-6 text-[#fcd535] animate-spin" />
                  </div>
                  <h3 className="text-lg font-semibold text-white">Đang đồng bộ dữ liệu</h3>
                  <p className="text-sm text-gray-400 mt-1">Vui lòng chờ trong giây lát...</p>
                </div>

                {/* Progress Bar */}
                <div className="relative h-3 bg-[#2b3139] rounded-full overflow-hidden">
                  <div 
                    className="h-full rounded-full transition-all duration-300 ease-out"
                    style={{ 
                      width: `${progress}%`,
                      background: 'linear-gradient(90deg, #f0b90b, #fcd535)',
                    }}
                  />
                </div>

                <div className="text-center mt-3">
                  <span className="text-2xl font-bold text-[#fcd535]">{Math.round(progress)}%</span>
                </div>

                <div className="flex justify-center gap-1.5 mt-3">
                  <div className="w-2 h-2 rounded-full bg-[#fcd535]" style={{ animation: 'bounce 1s infinite', animationDelay: '0ms' }} />
                  <div className="w-2 h-2 rounded-full bg-[#fcd535]" style={{ animation: 'bounce 1s infinite', animationDelay: '150ms' }} />
                  <div className="w-2 h-2 rounded-full bg-[#fcd535]" style={{ animation: 'bounce 1s infinite', animationDelay: '300ms' }} />
                </div>
              </>
            )}

            {/* Success State */}
            {status === 'success' && (
              <div className="text-center py-4">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#0ecb81]/20 mb-4">
                  <CheckCircle className="h-10 w-10 text-[#0ecb81]" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">Thành công!</h3>
                <p className="text-gray-400">Đồng bộ dữ liệu hoàn tất</p>
              </div>
            )}

            {/* Error State */}
            {status === 'error' && (
              <div className="text-center py-4">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#f6465d]/20 mb-4">
                  <XCircle className="h-10 w-10 text-[#f6465d]" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">Thất bại!</h3>
                <p className="text-gray-400">{errorMsg || 'Có lỗi xảy ra'}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CSS Animations */}
      <style>{`
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
      `}</style>
    </>
  );
};

export default SyncDataButton;