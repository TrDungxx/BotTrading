import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';
import React, { ReactNode } from 'react';

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: ('admin' | 'superadmin')[];
}

const ProtectedRoute = ({ children, allowedRoles }: ProtectedRouteProps) => {
  const { user, isAuthenticating } = useAuth();

  if (isAuthenticating) return <div>🔐 Đang xác minh đăng nhập...</div>;

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Nếu có yêu cầu role cụ thể → kiểm tra quyền
  if (allowedRoles) {
    const userRole = user.type === 1
      ? 'admin'
      : [2, 99].includes(user.type)
        ? 'superadmin'
        : 'user';

    if (!allowedRoles.includes(userRole)) {
      return <Navigate to="/unauthorized" replace />;
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;
