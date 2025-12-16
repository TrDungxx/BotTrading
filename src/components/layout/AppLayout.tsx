import { useState, useEffect } from "react";
import { Outlet, Navigate } from "react-router-dom";
import Sidebar, { SIDEBAR_WIDTH } from "./Sidebar";
import Header from "./Header";
import { useAuth } from "../../context/AuthContext";
import { cn } from "../../utils/cn";

export default function AppLayout() {
  const { isAuthenticated } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // Track sidebar expanded state for desktop
  const [sidebarExpanded, setSidebarExpanded] = useState(() => {
    const saved = localStorage.getItem('sidebar-expanded');
    return saved ? JSON.parse(saved) : true;
  });

  // Track actual sidebar margin based on viewport
  const [sidebarMargin, setSidebarMargin] = useState(0);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 1024 && sidebarOpen) setSidebarOpen(false);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [sidebarOpen]);

  // Listen for sidebar toggle events
  useEffect(() => {
    const handleSidebarToggle = (e: CustomEvent<{ isExpanded: boolean }>) => {
      setSidebarExpanded(e.detail.isExpanded);
    };
    
    window.addEventListener('sidebar-toggle', handleSidebarToggle as EventListener);
    return () => window.removeEventListener('sidebar-toggle', handleSidebarToggle as EventListener);
  }, []);

  // Calculate actual sidebar margin based on viewport and state
  useEffect(() => {
    const calculateMargin = () => {
      const width = window.innerWidth;
      
      // Mobile (< 1024px): no margin, sidebar is overlay
      if (width < 1024) {
        setSidebarMargin(0);
        return;
      }
      
      // Tablet/Small Desktop (1024px - 1279px): always collapsed (60px)
      if (width < 1280) {
        setSidebarMargin(60);
        return;
      }
      
      // Desktop (1280px - 2399px): respect user preference
      if (width < 2400) {
        setSidebarMargin(sidebarExpanded ? 270 : 60);
        return;
      }
      
      // 2K (2400px - 3199px)
      if (width < 3200) {
        setSidebarMargin(sidebarExpanded ? 320 : 72);
        return;
      }
      
      // 4K (3200px+)
      setSidebarMargin(sidebarExpanded ? 400 : 88);
    };

    calculateMargin();
    window.addEventListener('resize', calculateMargin);
    return () => window.removeEventListener('resize', calculateMargin);
  }, [sidebarExpanded]);

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return (
    <div className="flex h-dvh bg-dark-800">
      <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} />
      
      <div className="flex flex-1 flex-col min-h-0">
        <Header 
          setSidebarOpen={setSidebarOpen} 
          sidebarExpanded={sidebarExpanded}
        />
        
        {/* Main content với dynamic margin sync với sidebar CSS */}
        <main 
          className="flex-1 min-h-0 overflow-hidden pt-14 md:pt-16 transition-all duration-300"
          style={{ marginLeft: sidebarMargin }}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}