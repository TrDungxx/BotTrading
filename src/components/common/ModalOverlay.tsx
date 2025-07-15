
import React from 'react';
import { Loader } from 'lucide-react';

const ModalOverlay = ({
  progress,
  onCancel,
}: {
  progress: number;
  onCancel: () => void;
}) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center">
      <div className="bg-dark-700 rounded-xl p-6 shadow-lg text-center w-[300px]">
        <div className="flex items-center justify-center mb-4">
          <Loader className="animate-spin w-6 h-6 text-primary-500" />
        </div>
        <p className="text-white mb-2">Đang đồng bộ dữ liệu...</p>

        <div className="w-full bg-dark-600 rounded h-2 overflow-hidden">
          <div
            className="bg-primary-500 h-full transition-all duration-200 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>

        <p className="text-xs text-dark-300 mt-2">{Math.round(progress)}%</p>

        <button
          onClick={onCancel}
          className="btn bg-danger-500 hover:bg-danger-600 text-white"
        >
          Huỷ đồng bộ
        </button>
      </div>
    </div>
  );
};


export default ModalOverlay;
