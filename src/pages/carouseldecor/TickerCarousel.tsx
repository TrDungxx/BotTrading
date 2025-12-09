import React, { useState, useEffect, useRef } from "react";
import TickerFilterToolbar, { FilterType } from "./TickerFilterToolbar";
import "../../style/carousel/ticker-carousel.css";
import "../../style/carousel/ticker-filter-toolbar.css";

interface TickerItem {
  symbol: string;
  lastPrice: string;
  priceChangePercent: string;
  priceChange: string;
  volume: string;
}

interface TickerCarouselProps {
  onSymbolClick?: (symbol: string) => void;
}

const TickerCarousel: React.FC<TickerCarouselProps> = ({ onSymbolClick }) => {
  const [tickers, setTickers] = useState<TickerItem[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number>();
  const positionRef = useRef<number>(0);
  const [isPaused, setIsPaused] = useState(false);
  const itemWidthRef = useRef<number>(0);
  const [isWidthReady, setIsWidthReady] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterType>("default");
  const activeFilterRef = useRef<FilterType>("default");
  const hasInitializedWidthRef = useRef<boolean>(false);
  const allTickersRef = useRef<TickerItem[]>([]); // ✅ Lưu raw data

  useEffect(() => {
    activeFilterRef.current = activeFilter;
  }, [activeFilter]);

  // ✅ Function để apply filter
  const applyFilter = (allTickers: TickerItem[], filter: FilterType): TickerItem[] => {
    let filtered: TickerItem[];

    switch (filter) {
      case "top-gainers":
        filtered = allTickers
          .filter((ticker) => parseFloat(ticker.priceChangePercent) > 0)
          .sort((a, b) => parseFloat(b.priceChangePercent) - parseFloat(a.priceChangePercent))
          .slice(0, 50);
        break;

      case "top-losers":
        filtered = allTickers
          .filter((ticker) => parseFloat(ticker.priceChangePercent) < 0)
          .sort((a, b) => parseFloat(a.priceChangePercent) - parseFloat(b.priceChangePercent))
          .slice(0, 50);
        break;

      case "default":
      default:
        filtered = allTickers
          .sort((a, b) => parseFloat(b.volume) - parseFloat(a.volume))
          .slice(0, 50);
        break;
    }

    return filtered;
  };

  useEffect(() => {
    const ws = new WebSocket("wss://fstream.binance.com/ws/!ticker@arr");

    ws.onopen = () => {
      console.log("✅ Ticker Carousel WebSocket connected");
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        const allTickers: TickerItem[] = data
          .filter((ticker: any) => ticker.s.endsWith("USDT"))
          .map((ticker: any) => ({
            symbol: ticker.s,
            lastPrice: ticker.c,
            priceChangePercent: ticker.P,
            priceChange: ticker.p,
            volume: ticker.v,
          }));

        // ✅ Lưu raw data
        allTickersRef.current = allTickers;

        // ✅ Apply filter với current filter
        const formattedTickers = applyFilter(allTickers, activeFilterRef.current);

        setTickers((prev) => {
          if (prev.length === 0) {
            return formattedTickers;
          }
          
          return prev.map(ticker => {
            const newData = formattedTickers.find((t: TickerItem) => t.symbol === ticker.symbol);
            return newData || ticker;
          });
        });
      } catch (error) {
        console.error("Error parsing ticker data:", error);
      }
    };

    ws.onerror = (error) => {
      console.error("Ticker Carousel WebSocket error:", error);
      setIsConnected(false);
    };

    ws.onclose = () => {
      console.log("❌ Ticker Carousel WebSocket closed");
      setIsConnected(false);
    };

    return () => {
      ws.close();
    };
  }, []);

  useEffect(() => {
    if (hasInitializedWidthRef.current) return;
    if (!trackRef.current) return;
    if (tickers.length === 0) return;

    setTimeout(() => {
      if (trackRef.current && !hasInitializedWidthRef.current) {
        const items = trackRef.current.children;
        let totalWidth = 0;
        
        for (let i = 0; i < 50 && i < items.length; i++) {
          if (items[i]) {
            totalWidth += (items[i] as HTMLElement).offsetWidth;
          }
        }
        
        itemWidthRef.current = totalWidth;
        hasInitializedWidthRef.current = true;
        setIsWidthReady(true);
        console.log("📏 Width locked forever:", totalWidth);
      }
    }, 100);
  }, [tickers]);

  useEffect(() => {
    if (!trackRef.current || tickers.length === 0 || isPaused || !isWidthReady) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      return;
    }

    const track = trackRef.current;
    const scrollSpeed = 0.1;

    const animate = () => {
      positionRef.current -= scrollSpeed;

      if (Math.abs(positionRef.current) >= itemWidthRef.current) {
        positionRef.current = positionRef.current + itemWidthRef.current;
      }

      track.style.transform = `translate3d(${positionRef.current}px, 0, 0)`;
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [tickers.length, isPaused, isWidthReady]);

  const handleSymbolClick = (symbol: string) => {
    if (onSymbolClick) {
      onSymbolClick(symbol);
      console.log("🎯 Switched to:", symbol);
    }
  };

  // ✅ Update handleFilterChange để re-filter ngay
  const handleFilterChange = (filter: FilterType) => {
    setActiveFilter(filter);
    positionRef.current = 0;
    console.log("🔄 Filter changed to:", filter);
    
    // ✅ Re-filter ngay với data hiện có
    if (allTickersRef.current.length > 0) {
      const formattedTickers = applyFilter(allTickersRef.current, filter);
      setTickers(formattedTickers);
    }
  };

  const tickerList = [...tickers, ...tickers];

  if (!isConnected || tickers.length === 0) {
    return (
      <>
        <TickerFilterToolbar
          activeFilter={activeFilter}
          onFilterChange={handleFilterChange}
        />
        <div className="ticker-carousel loading">
          <div className="ticker-loading-text">Connecting to market data...</div>
        </div>
      </>
    );
  }

  return (
    <>
      <TickerFilterToolbar
        activeFilter={activeFilter}
        onFilterChange={handleFilterChange}
      />

      <div
        className="ticker-carousel with-toolbar"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        <div ref={trackRef} className="ticker-track">
          {tickerList.map((ticker, index) => {
            const changePercent = parseFloat(ticker.priceChangePercent);
            const isPositive = changePercent >= 0;

            return (
              <div
                key={`${ticker.symbol}-${index}`}
                className={`ticker-item ${isPositive ? "up" : "down"}`}
                onClick={() => handleSymbolClick(ticker.symbol)}
              >
                <span className="ticker-symbol">{ticker.symbol}</span>
                <span className="ticker-price">
                  ${parseFloat(ticker.lastPrice).toFixed(
                    parseFloat(ticker.lastPrice) < 1 ? 4 : 2
                  )}
                </span>
                <span className="ticker-change">
                  {isPositive ? "+" : ""}
                  {changePercent.toFixed(2)}%
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
};

export default TickerCarousel;