import React, { useState } from 'react';
import { Eye, EyeOff, Settings, X } from 'lucide-react';

interface MAValue {
  period: number;
  value: number;
  color: string;
}

interface Props {
  maValues: MAValue[];
  visible: boolean;
  onToggleVisible: () => void;
  onOpenSetting: () => void;
  onClose: () => void;
}

const MAHeader: React.FC<Props> = ({ maValues, visible, onToggleVisible, onOpenSetting, onClose }) => {
  const [isFolded, setIsFolded] = useState(false);

  return (
    <div className="absolute top-2 left-2 bg-dark-800/90 rounded-md px-2 py-1 text-xs z-20">
      <div className="flex items-center space-x-2">
        {/* Toggle button */}
        <div
          onClick={() => setIsFolded(!isFolded)}
          className="cursor-pointer select-none text-gray-300"
        >
          {isFolded ? '▶' : '▼'}
        </div>

        {/* Content */}
        {!isFolded && (
          <>
            {maValues.map((ma, i) => (
              <div key={i} className="flex items-center space-x-1">
                <span>MA({ma.period}):</span>
                <span className="font-mono" style={{ color: ma.color }}>
                  {ma.value?.toFixed(5)}
                </span>
              </div>
            ))}

            {/* Buttons */}
            <div className="flex items-center space-x-2 ml-4">
              <button onClick={onToggleVisible}>
                {visible ? <Eye className="w-4 h-4 text-gray-400" /> : <EyeOff className="w-4 h-4 text-gray-400" />}
              </button>
              <button onClick={onOpenSetting}><Settings className="w-4 h-4 text-gray-400" /></button>
              <button onClick={onClose}><X className="w-4 h-4 text-gray-400" /></button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default MAHeader;
