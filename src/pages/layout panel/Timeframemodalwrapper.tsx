import React, { memo } from 'react';
import TimeframeSelector from './Timeframeselector';

interface TimeframeModalWrapperProps {
  isOpen: boolean;
  pinnedTimeframes: string[];
  onClose: () => void;
  onSave: (timeframes: string[]) => void;
}

// ✅ React.memo ngăn component re-render khi props không thay đổi
const TimeframeModalWrapper = memo(({ 
  isOpen, 
  pinnedTimeframes, 
  onClose, 
  onSave 
}: TimeframeModalWrapperProps) => {
  if (!isOpen) return null;
  
  return (
    <TimeframeSelector
      currentTimeframes={pinnedTimeframes}
      onSave={onSave}
      onClose={onClose}
    />
  );
}, (prevProps, nextProps) => {
  // ✅ Custom comparison: Chỉ re-render khi isOpen thay đổi
  return prevProps.isOpen === nextProps.isOpen &&
         prevProps.pinnedTimeframes === nextProps.pinnedTimeframes;
});

TimeframeModalWrapper.displayName = 'TimeframeModalWrapper';

export default TimeframeModalWrapper;