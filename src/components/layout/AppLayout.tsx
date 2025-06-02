import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import { useAuth } from '../../context/AuthContext';

export default function AppLayout() {
  const { isAuthenticated } = useAuth();
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
  
  if (!isAuthenticated) {
    // In a real app, redirect to login
    // For demo purposes, we're auto-authenticated
  }
  
  return (
    <div className="flex min-h-screen bg-dark-900">
      <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} />
      
      <div className="flex flex-1 flex-col min-h-screen">
        <Header setSidebarOpen={setSidebarOpen} />
        <main className="flex-1 p-4 lg:p-6 mt-16 lg:ml-64">
          <div className="container mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}