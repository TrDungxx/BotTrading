import React from 'react';

const OrderOpenHistory: React.FC = () => {
  return (
    <div className="flex-1 border-r border-dark-700">
      <div className="flex items-center justify-between p-3 border-b border-dark-700">
        <h3 className="text-sm font-medium">Order History</h3>
        <button className="text-xs text-dark-400 hover:text-dark-200">View All</button>
      </div>

      <div className="p-4 text-center text-dark-400">
        <div className="text-sm">No order history</div>
        <div className="text-xs mt-1">Your completed orders will appear here</div>
      </div>
    </div>
  );
};

export default OrderOpenHistory;
