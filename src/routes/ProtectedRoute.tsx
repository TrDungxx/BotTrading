import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import FancyLoading from '../components/common/FancyLoading';


const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, isAuthenticating } = useAuth();
  const [delayPassed, setDelayPassed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDelayPassed(true), 1000); // ⏱️ 2s delay
    return () => clearTimeout(timer);
  }, []);

  if (isAuthenticating || !delayPassed) {
    return <FancyLoading />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles) {
    const userRole =
      user.type === 1
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
