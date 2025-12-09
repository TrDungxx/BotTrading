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

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return (
    <div className="flex h-dvh bg-dark-800">
      <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} />
      
      <div className="flex flex-1 flex-col min-h-0">
        <Header 
          setSidebarOpen={setSidebarOpen} 
          sidebarExpanded={sidebarExpanded}
        />
        
        {/* Main content với dynamic margin */}
        <main 
          className={cn(
            "flex-1 min-h-0 overflow-hidden pt-14 md:pt-16 transition-all duration-300",
            // Mobile/Tablet: không có margin
            // Desktop: margin theo sidebar state
            sidebarExpanded ? "lg:ml-64" : "lg:ml-16"
          )}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}