// MASettings.tsx
import React from 'react';
import { X } from 'lucide-react';

interface Props {
  visibleSettings: {
    ma7: boolean;
    ma25: boolean;
    ma99: boolean;
  };
  onChange: (next: { ma7: boolean; ma25: boolean; ma99: boolean }) => void;
  onClose: () => void;
}

const MASettings: React.FC<Props> = ({ visibleSettings, onChange, onClose }) => {
  return (
    <div className="absolute top-12 left-2 z-30 bg-dark-800 border border-dark-600 rounded-md p-4 w-48 text-xs shadow-lg">
      <div className="flex justify-between items-center mb-2">
        <span className="text-white font-semibold">Cài đặt MA</span>
        <button onClick={onClose}>
          <X className="w-4 h-4 text-gray-400 hover:text-white" />
        </button>
      </div>
      <div className="space-y-2">
        <label className="flex items-center justify-between">
          <span>MA(7)</span>
          <input
            type="checkbox"
            checked={visibleSettings.ma7}
            onChange={(e) => onChange({ ...visibleSettings, ma7: e.target.checked })}
          />
        </label>
        <label className="flex items-center justify-between">
          <span>MA(25)</span>
          <input
            type="checkbox"
            checked={visibleSettings.ma25}
            onChange={(e) => onChange({ ...visibleSettings, ma25: e.target.checked })}
          />
        </label>
        <label className="flex items-center justify-between">
          <span>MA(99)</span>
          <input
            type="checkbox"
            checked={visibleSettings.ma99}
            onChange={(e) => onChange({ ...visibleSettings, ma99: e.target.checked })}
          />
        </label>
      </div>
    </div>
  );
};

export default MASettings;
