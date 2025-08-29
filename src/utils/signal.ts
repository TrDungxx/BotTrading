export type SignalType = "long" | "short" | "exit_long" | "exit_short";

export function buildSignalPayload({
  type,
  symbol,          // ví dụ: "ETHUSDT" hay "1000PEPEUSDT"
  exchange,        // ví dụ: "BINANCE Futures USDT-M"
  interval,        // ví dụ: "1h"
  ohlc,            // { open, high, close, volume }
  strategy,        // truyền từ indicator đang chọn
  indicator,       // truyền từ indicator đang chọn
}: {
  type: SignalType;
  symbol: string;
  exchange: string;
  interval: string;
  ohlc?: { open?: number; high?: number; close?: number; volume?: number };
  strategy: string;
  indicator: string;
}) {
  const now = new Date().toISOString();
  const base = symbol.replace(/USDT$/i, "");
  const map = {
    long:       { action: "BUY entry",  position: "BUY",  type: "long"  },
    short:      { action: "SELL entry", position: "SELL", type: "short" },
    exit_long:  { action: "BUY entry",  position: "BUY",  type: "exit"  },
    exit_short: { action: "SELL entry", position: "SELL", type: "exit"  },
  }[type];

  return {
    indicatorMessage: {
      strategy,
      indicator,
      type: map.type,
      action: map.action,
      position: map.position,
      general: {
        ticker: symbol,
        exchange,
        interval,
        time: now,
        timenow: now,
      },
      symbolData: {
        volume: String(ohlc?.volume ?? "0"),
        high:   String(ohlc?.high   ?? "0"),
        open:   String(ohlc?.open   ?? "0"),
        close:  String(ohlc?.close  ?? "0"),
      },
      currency: {
        quote: "USDT",
        base,
      },
    },
  };
}

/**
 * Gửi payload tới webhook và log chi tiết.
 */
export async function postSignal(
  webhookUrl: string,
  payload: any,
  extraHeaders?: Record<string, string>
) {
  // Log trước khi gửi
  console.groupCollapsed(
    `%c[Signal] Sending → ${payload?.indicatorMessage?.type?.toUpperCase() || ""} ${payload?.indicatorMessage?.general?.ticker || ""}`,
    "color:#7bd88f;font-weight:bold"
  );
  console.log("Webhook URL:", webhookUrl);
  console.log("Payload:", payload);
  console.groupEnd();

  const t0 = performance.now();
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(extraHeaders ?? {}),
    },
    body: JSON.stringify(payload),
  });
  const ms = Math.round(performance.now() - t0);

  const text = await res.text().catch(() => "");
  let data: any;
  try { data = JSON.parse(text); } catch { data = text; }

  if (!res.ok) {
    console.error(
      "%c[Signal] ❌ Failed",
      "color:#ff6b6b;font-weight:bold",
      { status: res.status, ms, body: data }
    );
    throw new Error(`Webhook ${res.status}: ${text}`);
  }

  console.info(
    "%c[Signal] ✅ Success",
    "color:#7bd88f;font-weight:bold",
    { status: res.status, ms, body: data }
  );

  return data;
}