import React, { useState, useEffect, useRef } from "react";
import { 
  Wifi, 
  WifiOff, 
  Clock, 
  Activity, 
  Server, 
  Globe,
  Zap,
  AlertCircle
} from "lucide-react";

type ConnectionStatus = "connecting" | "connected" | "disconnected" | "error" | "maintenance";

interface TradingFooterProps {
  connectionStatus: ConnectionStatus;
  serverUrl?: string;
  version?: string;
}

export default function TradingFooter({ 
  connectionStatus, 
  serverUrl = "139.180.128.183",
  version = "1.0.0"
}: TradingFooterProps) {
  const [serverTime, setServerTime] = useState<string>("");
  const [localTime, setLocalTime] = useState<string>("");
  const [latency, setLatency] = useState<number | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Update time every second
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      
      // Local time
      setLocalTime(now.toLocaleTimeString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false
      }));
      
      // Server time (UTC)
      setServerTime(now.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
        timeZone: "UTC"
      }));
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Measure latency (ping to Binance API)
  useEffect(() => {
    const measureLatency = async () => {
      try {
        const start = performance.now();
        await fetch("https://fapi.binance.com/fapi/v1/ping", { 
          method: "GET",
          cache: "no-store"
        });
        const end = performance.now();
        setLatency(Math.round(end - start));
      } catch {
        setLatency(null);
      }
    };

    measureLatency();
    pingIntervalRef.current = setInterval(measureLatency, 30000); // Every 30s
    
    return () => {
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
      }
    };
  }, []);

  // Online/Offline detection
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Connection status config
  const getStatusConfig = () => {
    if (!isOnline) {
      return {
        icon: <WifiOff className="h-3.5 w-3.5" />,
        color: "text-red-500",
        bgColor: "bg-red-500/10",
        label: "Offline"
      };
    }

    switch (connectionStatus) {
      case "connected":
        return {
          icon: <Wifi className="h-3.5 w-3.5" />,
          color: "text-green-500",
          bgColor: "bg-green-500/10",
          label: "Connected"
        };
      case "connecting":
        return {
          icon: <Activity className="h-3.5 w-3.5 animate-pulse" />,
          color: "text-yellow-500",
          bgColor: "bg-yellow-500/10",
          label: "Connecting..."
        };
      case "maintenance":
        return {
          icon: <AlertCircle className="h-3.5 w-3.5" />,
          color: "text-orange-500",
          bgColor: "bg-orange-500/10",
          label: "Maintenance"
        };
      case "error":
        return {
          icon: <WifiOff className="h-3.5 w-3.5" />,
          color: "text-red-500",
          bgColor: "bg-red-500/10",
          label: "Error"
        };
      default:
        return {
          icon: <WifiOff className="h-3.5 w-3.5" />,
          color: "text-gray-500",
          bgColor: "bg-gray-500/10",
          label: "Disconnected"
        };
    }
  };

  // Latency status color
  const getLatencyColor = () => {
    if (latency === null) return "text-gray-500";
    if (latency < 100) return "text-green-500";
    if (latency < 300) return "text-yellow-500";
    return "text-red-500";
  };

  const statusConfig = getStatusConfig();

  return (
    <footer className="trading-footer">
      <div className="trading-footer-content">
        {/* Left Section */}
        <div className="footer-section footer-left">
          {/* Connection Status */}
          <div className={`footer-item footer-status ${statusConfig.bgColor}`}>
            <span className={statusConfig.color}>{statusConfig.icon}</span>
            <span className={`footer-label ${statusConfig.color}`}>
              {statusConfig.label}
            </span>
          </div>

          {/* Server IP */}
          <div className="footer-item">
            <Server className="h-3.5 w-3.5 text-slate-500" />
            <span className="footer-value">{serverUrl}</span>
          </div>

          {/* Latency */}
          <div className="footer-item">
            <Zap className={`h-3.5 w-3.5 ${getLatencyColor()}`} />
            <span className={`footer-value ${getLatencyColor()}`}>
              {latency !== null ? `${latency}ms` : "--"}
            </span>
          </div>
        </div>

        {/* Center Section - Times */}
        <div className="footer-section footer-center">
          <div className="footer-item">
            <Clock className="h-3.5 w-3.5 text-slate-500" />
            <span className="footer-label">Local:</span>
            <span className="footer-value font-mono">{localTime}</span>
          </div>
          
          <div className="footer-divider" />
          
          <div className="footer-item">
            <Globe className="h-3.5 w-3.5 text-slate-500" />
            <span className="footer-label">UTC:</span>
            <span className="footer-value font-mono">{serverTime}</span>
          </div>
        </div>

        {/* Right Section */}
        <div className="footer-section footer-right">
          <div className="footer-item">
            <span className="footer-label text-slate-600">v{version}</span>
          </div>
          
          <div className="footer-item footer-binance">
            <span className="text-[#f0b90b]">●</span>
            <span className="footer-label text-slate-500">Binance Futures</span>
          </div>
        </div>
      </div>
    </footer>
  );
}