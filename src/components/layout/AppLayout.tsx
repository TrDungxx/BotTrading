import { useState, useEffect } from "react";
import { Outlet, Navigate } from "react-router-dom";
import Sidebar from "./Sidebar";
import Header from "./Header";
import { useAuth } from "../../context/AuthContext";

export default function AppLayout() {
  const { isAuthenticated } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 1024 && sidebarOpen) setSidebarOpen(false);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [sidebarOpen]);

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return (
    <div className="flex h-dvh bg-dark-900">
      {" "}
      {/* ⬅️ khóa chiều cao theo viewport */}
      <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} />
      <div className="flex flex-1 flex-col min-h-0">
        {" "}
        {/* ⬅️ rất quan trọng */}
        <Header setSidebarOpen={setSidebarOpen} />
        <main className="flex-1 min-h-0 overflow-hidden pt-14 md:pt-16 lg:ml-64">
          {" "}
          {/* ⬅️ offset cho header, giữ offset sidebar */}
          <Outlet />
        </main>
      </div>
    </div>
  );
}
