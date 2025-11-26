import React from 'react';
import '../../../style/popup/maintenance-modal.css';

interface MaintenanceModalProps {
  isOpen: boolean;
  onRefresh: () => void;
}

const MaintenanceModal: React.FC<MaintenanceModalProps> = ({ isOpen, onRefresh }) => {
   
  if (!isOpen) return null;

  return (
    <div className="maintenance-modal-overlay">
      <div className="maintenance-modal">
        <div className="maintenance-icon">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="#FFA500" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M2 17L12 22L22 17" stroke="#FFA500" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M2 12L12 17L22 12" stroke="#FFA500" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        
        <h2 className="maintenance-title">Server Maintenance</h2>
        
        <p className="maintenance-message">
          Our trading server is currently undergoing maintenance. 
          We apologize for any inconvenience and will be back shortly.
        </p>
        
        <div className="maintenance-details">
          <div className="detail-item">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="10" stroke="#6B7280" strokeWidth="2"/>
              <path d="M12 6V12L16 14" stroke="#6B7280" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <span>Expected downtime: ~15 minutes</span>
          </div>
          <div className="detail-item">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M9 11L12 14L22 4" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M21 12V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H16" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span>Your data is safe and secure</span>
          </div>
        </div>
        
        <button className="refresh-button" onClick={onRefresh}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M21.5 2V8M21.5 8H15.5M21.5 8L18.4 5C17.0429 3.66373 15.3304 2.73534 13.4548 2.32781C11.5792 1.92028 9.62597 2.05224 7.82129 2.70904C6.01661 3.36584 4.43669 4.52109 3.2771 6.03613C2.11751 7.55117 1.42514 9.35769 1.28502 11.2425C1.1449 13.1273 1.56281 15.0118 2.49268 16.6641C3.42255 18.3164 4.82604 19.6654 6.52905 20.5518C8.23207 21.4382 10.1613 21.8244 12.0877 21.6641C14.0141 21.5039 15.8529 20.8038 17.4 19.64" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span>Refresh Connection</span>
        </button>
        
        <p className="maintenance-footer">
          Thank you for your patience
        </p>
      </div>
    </div>
  );
};

export default MaintenanceModal;