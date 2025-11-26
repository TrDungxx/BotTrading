interface SymbolData {
  symbol: string;
  tickSize: number;
  stepSize: number;
  minQty: number;
  maxQty: number;
  minNotional: number; // ✅ THÊM FIELD NÀY
}

class BinanceSymbolInfoService {
  private cache: Map<string, SymbolData> = new Map();
  private loading: Promise<void> | null = null;
  private initialized = false;

  async initialize() {
    if (this.initialized) return;
    if (this.loading) return this.loading;

    this.loading = (async () => {
      try {
        console.log('🔄 Fetching Binance exchange info...');
        const response = await fetch('https://fapi.binance.com/fapi/v1/exchangeInfo');
        const data = await response.json();

        if (data.symbols) {
          data.symbols.forEach((symbol: any) => {
            const priceFilter = symbol.filters.find(
              (f: SymbolFilter) => f.filterType === 'PRICE_FILTER'
            );
            const lotFilter = symbol.filters.find(
              (f: SymbolFilter) => f.filterType === 'LOT_SIZE'
            );
            const minNotionalFilter = symbol.filters.find(
              (f: any) => f.filterType === 'MIN_NOTIONAL'
            );

            if (priceFilter && lotFilter) {
              this.cache.set(symbol.symbol, {
                symbol: symbol.symbol,
                tickSize: parseFloat(priceFilter.tickSize || '0.01'),
                stepSize: parseFloat(lotFilter.stepSize || '0.01'),
                minQty: parseFloat(lotFilter.minQty || '0'),
                maxQty: parseFloat(lotFilter.maxQty || '999999999'),
                minNotional: parseFloat(minNotionalFilter?.notional || '5'), // ✅ Default 5 USDT
              });
            }
          });

          this.initialized = true;
          console.log(`✅ Loaded ${this.cache.size} symbol specs from Binance`);
        }
      } catch (error) {
        console.error('❌ Failed to load Binance exchange info:', error);
      } finally {
        this.loading = null;
      }
    })();

    return this.loading;
  }

  getSymbolInfo(symbol: string): SymbolData | null {
    return this.cache.get(symbol) || null;
  }

  getTickSize(symbol: string, fallback = 0.01): number {
    const info = this.cache.get(symbol);
    if (info) {
      return info.tickSize;
    }
    return fallback;
  }

  getStepSize(symbol: string, fallback = 0.01): number {
    const info = this.cache.get(symbol);
    if (info) {
      return info.stepSize;
    }
    return fallback;
  }

  getMinNotional(symbol: string, fallback = 5): number {
    const info = this.cache.get(symbol);
    if (info) {
      return info.minNotional;
    }
    return fallback;
  }

  isInitialized(): boolean {
    return this.initialized;
  }
}

export const binanceSymbolInfo = new BinanceSymbolInfoService();