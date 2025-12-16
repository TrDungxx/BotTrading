import React, { useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import '../../../style/trading/FullscreenPositionModal.css';

// Icons
const CloseIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="18" y1="6" x2="6" y2="18"/>
    <line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

const MinimizeIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/>
  </svg>
);

type TabKey = 'position' | 'openOrder' | 'orderHistory' | 'tradeHistory' | 'pnlHistory';

interface Tab {
  key: TabKey;
  label: string;
}

interface FullscreenPositionModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  tabs: readonly Tab[];
  positionCount: number;
  openOrderCount: number;
  children: React.ReactNode;
}

export const FullscreenPositionModal: React.FC<FullscreenPositionModalProps> = ({
  isOpen,
  onClose,
  activeTab,
  onTabChange,
  tabs,
  positionCount,
  openOrderCount,
  children
}) => {
  // Close on ESC key
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  const getTabTitle = () => {
    switch (activeTab) {
      case 'position': return 'Positions';
      case 'openOrder': return 'Open Orders';
      case 'orderHistory': return 'Order History';
      case 'tradeHistory': return 'Trade History';
      case 'pnlHistory': return 'PnL Analysis';
      default: return 'Positions';
    }
  };

  const modal = (
    <div className="fullscreen-position-overlay" onClick={onClose}>
      <div 
        className="fullscreen-position-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="fullscreen-position-header">
          <div className="fullscreen-position-header-left">
            <h2 className="fullscreen-position-title">{getTabTitle()}</h2>
            <span className="fullscreen-position-subtitle">Fullscreen Mode</span>
          </div>
          
          {/* Tabs in header */}
          <div className="fullscreen-position-tabs">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                className={`fullscreen-tab-btn ${activeTab === tab.key ? 'active' : ''}`}
                onClick={() => onTabChange(tab.key)}
              >
                {tab.label}
                {tab.key === 'position' && positionCount > 0 && (
                  <span className="fullscreen-tab-badge">{positionCount}</span>
                )}
                {tab.key === 'openOrder' && openOrderCount > 0 && (
                  <span className="fullscreen-tab-badge">{openOrderCount}</span>
                )}
              </button>
            ))}
          </div>

          <div className="fullscreen-position-header-right">
            <button 
              className="fullscreen-position-minimize-btn"
              onClick={onClose}
              title="Thu nhỏ (ESC)"
            >
              <MinimizeIcon />
            </button>
            <button 
              className="fullscreen-position-close-btn"
              onClick={onClose}
              title="Đóng (ESC)"
            >
              <CloseIcon />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="fullscreen-position-content">
          {children}
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
};

// Export icon để dùng ở PositionFunction
export const ExpandIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
  </svg>
);

export default FullscreenPositionModal;