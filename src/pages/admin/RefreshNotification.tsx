import { useForceRefresh } from "../../utils/useForceRefresh";

export const RefreshNotification = () => {
  const { showModal, message, handleRefresh, handleDismiss } = useForceRefresh();

  if (!showModal) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[9999] backdrop-blur-sm">
      <div className="bg-[#1a1a1a] border border-blue-500/30 p-10 rounded-2xl max-w-xl mx-4 shadow-2xl shadow-blue-500/10">
        <div className="flex items-center gap-5 mb-6">
          <div className="w-16 h-16 rounded-full bg-blue-500/20 flex items-center justify-center">
            <svg 
              className="w-8 h-8 text-blue-400 animate-spin-slow" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" 
              />
            </svg>
          </div>
          <h3 className="text-blue-400 font-bold text-2xl">
            Cập nhật quan trọng
          </h3>
        </div>
        <p className="text-gray-300 mb-10 leading-relaxed text-lg">{message}</p>
        <div className="flex gap-4 justify-end">
          <button 
            onClick={handleDismiss}
            className="px-8 py-3.5 rounded-xl bg-gray-700/50 hover:bg-gray-600/50 text-gray-300 text-base font-medium transition-colors"
          >
            Để sau
          </button>
          <button 
            onClick={handleRefresh}
            className="px-8 py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-semibold text-base shadow-lg shadow-blue-500/25 transition-all"
          >
            Refresh ngay
          </button>
        </div>
      </div>
    </div>
  );
};