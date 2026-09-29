import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext.tsx';
import { UserRole } from '../../types/index.ts';

export function getRoleDashboardPath(role: UserRole): string {
  if (role === 'student') return '/student';
  if (role === 'guardian') return '/guardian';
  if (role === 'officer') return '/officer';
  return '/';
}

interface RoleGuardProps {
  allowedRole: UserRole;
  children: React.ReactNode;
}

export const RoleGuard: React.FC<RoleGuardProps> = ({ allowedRole, children }) => {
  const { session, setAccessDeniedNotice } = useAuth();
  const location = useLocation();

  useEffect(() => {
    if (session && session.role !== allowedRole) {
      setAccessDeniedNotice(
        `Role Access Restricted (403): Active ${session.role.toUpperCase()} session cannot open ${location.pathname} (${allowedRole.toUpperCase()} route). Redirected to your authorized portal.`
      );
    }
  }, [session, allowedRole, location.pathname, setAccessDeniedNotice]);

  if (!session) {
    return <Navigate to="/" replace state={{ from: location.pathname }} />;
  }

  if (session.role !== allowedRole) {
    return <Navigate to={getRoleDashboardPath(session.role)} replace />;
  }

  return <>{children}</>;
};
