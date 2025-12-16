import { useState, useEffect } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import { useAuth } from '../../context/AuthContext';

export default function GuestLayout() {
  const { isAuthenticated, isGuestMode } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // Close sidebar on window resize (mobile)
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024 && sidebarOpen) {
        setSidebarOpen(false);
      }
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [sidebarOpen]);
  
  // Redirect authenticated users to main app
  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }
  
  // Allow guest mode access
  if (!isGuestMode) {
    return <Navigate to="/login\" replace />;
  }
  
  return (
    <div className="flex min-h-screen bg-dark-900">
      <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} />
      
      <div className="flex flex-1 flex-col min-h-screen">
        <Header setSidebarOpen={setSidebarOpen} />
        <main className="flex-1 p-fluid-4 lg:p-6 mt-16 lg:ml-64 w-full">
            {/* Guest mode banner */}
            <div className="mb-6 p-fluid-4 bg-warning-300/10 border border-warning-300/20 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-fluid-sm font-medium text-warning-300">Guest Mode</h3>
                  <p className="text-xs text-warning-300/80 mt-1">
                    You're viewing in guest mode with limited access. Sign in for full features.
                  </p>
                </div>
                <a
                  href="/login"
                  className="btn btn-primary py-2 px-fluid-4 text-fluid-sm"
                >
                  Sign In
                </a>
              </div>
            </div>
            <Outlet />
        </main>
      </div>
    </div>
  );
}