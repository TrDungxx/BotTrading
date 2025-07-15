import React from 'react';

export default function TradingViewWidget() {
  return (
    <div className="w-full h-full">
      <iframe
        src="https://s.tradingview.com/widgetembed/?frameElementId=tradingview_12345&symbol=BINANCE%3ABTCUSDT&interval=1&theme=dark&style=1&locale=en&toolbar_bg=f1f3f6&enable_publishing=false&hide_top_toolbar=false&hide_legend=false&save_image=false&studies=[]&show_popup_button=true&popup_width=1000&popup_height=650"
        style={{ width: '100%', height: '100%', border: 'none' }}
        allowFullScreen
        loading="lazy"
      ></iframe>
    </div>
  );
}
