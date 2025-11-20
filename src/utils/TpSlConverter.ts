/**
 * TP/SL Helper Functions
 * Sử dụng để convert giữa Price/PnL/ROI trong TradingForm
 */

export type TpSlMode = "price" | "pnl" | "roi";
export type Side = "buy" | "sell";

export class TpSlConverter {
  /**
   * Convert input value sang Price dựa trên mode
   * @returns Price dạng string, hoặc "" nếu invalid
   */
  static toPrice(
  mode: TpSlMode,
  inputValue: string,
  entryPrice: number,
  quantity: number,
  side: Side,
  type: "tp" | "sl" = "tp",
  leverage: number = 1  // ✅ THÊM leverage
): string {
  let value = parseFloat(inputValue);
  
  if (!Number.isFinite(value) || quantity <= 0 || entryPrice <= 0) {
    return "";
  }

  try {
    if (mode === "price") {
      return inputValue;
    } else if (mode === "pnl") {
      const adjustedPnL = type === "sl" && value > 0 ? -value : value;
      const price = this.getPriceFromPnL(adjustedPnL, entryPrice, quantity, side);
      return price.toFixed(8);
    } else if (mode === "roi") {
      const adjustedROI = type === "sl" && value > 0 ? -value : value;
      // ✅ Truyền leverage vào
      const price = this.getPriceFromROI(adjustedROI, entryPrice, quantity, side, leverage);
      return price.toFixed(8);
    }
  } catch (error) {
    console.error("TpSlConverter error:", error);
  }

  return "";
}

// ✅ Thêm leverage vào getPriceFromROI
private static getPriceFromROI(
  roi: number,
  entryPrice: number,
  quantity: number,
  side: Side,
  leverage: number = 1  // ✅ Mặc định = 1 nếu không truyền
): number {
  const cost = entryPrice * quantity;
  const margin = cost / leverage;  // ✅ Tính margin thực tế
  const pnl = (roi / 100) * margin;  // ✅ ROI tính trên margin
  return this.getPriceFromPnL(pnl, entryPrice, quantity, side);
}

  /**
   * Tính PnL từ price
   */
  static calculatePnL(
    exitPrice: number,
    entryPrice: number,
    quantity: number,
    side: Side
  ): number {
    if (side === "buy") {
      // Long: lãi khi giá tăng
      return (exitPrice - entryPrice) * quantity;
    } else {
      // Short: lãi khi giá giảm
      return (entryPrice - exitPrice) * quantity;
    }
  }

  /**
   * Tính ROI từ PnL
   */
  static calculateROI(
    pnl: number,
    entryPrice: number,
    quantity: number
  ): number {
    const cost = entryPrice * quantity;
    if (cost <= 0) return 0;
    return (pnl / cost) * 100;
  }

  /**
   * Tính Price từ PnL
   */
  private static getPriceFromPnL(
    pnl: number,
    entryPrice: number,
    quantity: number,
    side: Side
  ): number {
    if (quantity <= 0) throw new Error("Quantity must be > 0");

    if (side === "buy") {
      // Long: exitPrice = entryPrice + (pnl / quantity)
      return entryPrice + pnl / quantity;
    } else {
      // Short: exitPrice = entryPrice - (pnl / quantity)
      return entryPrice - pnl / quantity;
    }
  }

  /**
   * Get placeholder text cho input
   */
  static getPlaceholder(mode: TpSlMode, type: "tp" | "sl"): string {
    const label = type === "tp" ? "TP" : "SL";
    
    if (type === "sl") {
      // Stop Loss placeholders với chỉ dẫn giá trị âm
      switch (mode) {
        case "price":
          return `Giá`;
        case "pnl":
          return `PnL`;
        case "roi":
          return `ROI`;
        default:
          return `Nhập giá ${label}`;
      }
    } else {
      // Take Profit placeholders
      switch (mode) {
        case "price":
          return `Giá`;
        case "pnl":
          return `PnL`;
        case "roi":
          return `ROI`;
        default:
          return `Nhập giá ${label}`;
      }
    }
  }

  /**
   * Validate giá trị dựa trên mode và type (TP/SL)
   */
  static validate(
    mode: TpSlMode,
    inputValue: string,
    type: "tp" | "sl",
    entryPrice: number,
    quantity: number,
    side: Side
  ): { valid: boolean; error?: string } {
    const value = parseFloat(inputValue);
    
    if (!Number.isFinite(value)) {
      return { valid: true }; // Empty input is OK
    }

    if (quantity <= 0 || entryPrice <= 0) {
      return { valid: false, error: "Quantity và Entry Price phải > 0" };
    }

    try {
      if (mode === "price") {
        return this.validatePrice(value, type, entryPrice, side);
      } else if (mode === "pnl") {
        return this.validatePnL(value, type);
      } else if (mode === "roi") {
        return this.validateROI(value, type);
      }
    } catch (error) {
      return { valid: false, error: "Lỗi validation" };
    }

    return { valid: true };
  }

  /**
   * Validate Price
   */
  private static validatePrice(
    price: number,
    type: "tp" | "sl",
    entryPrice: number,
    side: Side
  ): { valid: boolean; error?: string } {
    if (price <= 0) {
      return { valid: false, error: "Giá phải > 0" };
    }

    if (type === "tp") {
      // Take Profit validation
      if (side === "buy" && price <= entryPrice) {
        return { valid: false, error: "TP phải cao hơn giá entry (Long)" };
      }
      if (side === "sell" && price >= entryPrice) {
        return { valid: false, error: "TP phải thấp hơn giá entry (Short)" };
      }
    } else {
      // Stop Loss validation
      if (side === "buy" && price >= entryPrice) {
        return { valid: false, error: "SL phải thấp hơn giá entry (Long)" };
      }
      if (side === "sell" && price <= entryPrice) {
        return { valid: false, error: "SL phải cao hơn giá entry (Short)" };
      }
    }

    return { valid: true };
  }

  /**
   * Validate PnL
   */
  private static validatePnL(
    pnl: number,
    type: "tp" | "sl"
  ): { valid: boolean; error?: string } {
    if (type === "tp" && pnl <= 0) {
      return { valid: false, error: "TP phải có lãi (PnL > 0)" };
    }
    if (type === "sl" && pnl >= 0) {
      return { valid: false, error: "SL phải có lỗ (PnL < 0)" };
    }
    return { valid: true };
  }

  /**
   * Validate ROI
   */
  private static validateROI(
    roi: number,
    type: "tp" | "sl"
  ): { valid: boolean; error?: string } {
    if (type === "tp" && roi <= 0) {
      return { valid: false, error: "TP phải có lãi (ROI > 0%)" };
    }
    if (type === "sl" && roi >= 0) {
      return { valid: false, error: "SL phải có lỗ (ROI < 0%)" };
    }
    return { valid: true };
  }

  /**
   * Format số để hiển thị
   */
  static formatPrice(price: number, decimals: number = 4): string {
    return price.toFixed(decimals);
  }

  static formatPnL(pnl: number): string {
    const sign = pnl >= 0 ? "+" : "";
    return `${sign}${pnl.toFixed(2)} USDT`;
  }

  static formatROI(roi: number): string {
    const sign = roi >= 0 ? "+" : "";
    return `${sign}${roi.toFixed(2)}%`;
  }
}

/**
 * Example usage trong TradingForm:
 * 
 * // Khi user submit order
 * const tpPrice = TpSlConverter.toPrice(
 *   tpMode,
 *   tpSlValues.takeProfitPrice,
 *   price,
 *   parseFloat(amount),
 *   tradeSide
 * );
 * 
 * // Validate trước khi submit
 * const validation = TpSlConverter.validate(
 *   tpMode,
 *   tpSlValues.takeProfitPrice,
 *   "tp",
 *   price,
 *   parseFloat(amount),
 *   tradeSide
 * );
 * 
 * if (!validation.valid) {
 *   alert(validation.error);
 *   return;
 * }
 */