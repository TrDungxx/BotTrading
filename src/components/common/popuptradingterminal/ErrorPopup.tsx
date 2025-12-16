import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

interface ErrorPopupProps {
  message: string;
  onClose: () => void;
}

export const ErrorPopup: React.FC<ErrorPopupProps> = ({ message, onClose }) => {
  
  
  useEffect(() => {
    
    // Auto close sau 5 giây
    const timer = setTimeout(() => {
      
      onClose();
    }, 5000);

    // Prevent body scroll when popup is open
    document.body.style.overflow = 'hidden';

    return () => {
      
      clearTimeout(timer);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  
  
  // ✅ RENDER VÀO DOCUMENT.BODY BẰNG PORTAL
  return createPortal(
    <div 
      className="fixed inset-0 z-[99999] flex items-center justify-center"
      style={{ 
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 99999
      }}
    >
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black bg-opacity-50"
        onClick={onClose}
        style={{ 
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)'
        }}
      />
      
      {/* Popup */}
      <div 
        className="relative bg-[#1e2329] border border-red-500 rounded-lg shadow-xl max-w-md w-full mx-4 p-6"
        style={{
          position: 'relative',
          zIndex: 100000
        }}
      >
        {/* Icon & Title */}
        <div className="flex items-start gap-fluid-3 mb-4">
          <div className="flex-shrink-0 w-8 h-fluid-input-sm bg-red-500 bg-opacity-20 rounded-full flex items-center justify-center">
            <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-white mb-2">Order Failed</h3>
            <p className="text-gray-300 text-fluid-sm leading-relaxed">{message}</p>
          </div>
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="w-full bg-red-500 hover:bg-red-600 text-white font-medium py-2 px-fluid-4 rounded transition-colors"
        >
          Close
        </button>
      </div>
    </div>,
    document.body // ✅ RENDER TRỰC TIẾP VÀO BODY
  );
};