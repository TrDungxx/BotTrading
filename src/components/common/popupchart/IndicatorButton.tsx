import React from 'react';

interface IndicatorButtonProps {
  onClick: () => void;
}

const IndicatorButton: React.FC<IndicatorButtonProps> = ({ onClick }) => {
  return (
    <button
      onClick={onClick}
      className="absolute top-2 right-2 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#2b3139] hover:bg-[#363c4e] transition-colors text-xs text-[#848e9c] hover:text-white"
      title="Cài đặt chỉ báo"
    >
      <span className="i-lucide-settings text-sm" />
      <span className="font-medium">Cài đặt</span>
    </button>
  );
};

export default IndicatorButton;