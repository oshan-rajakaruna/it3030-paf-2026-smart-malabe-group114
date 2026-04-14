import { Navigate, useLocation } from 'react-router-dom';
import { LockKeyhole } from 'lucide-react';

import EmptyState from '../ui/EmptyState';
import Button from '../ui/Button';
import { useAuth } from '../../hooks/useAuth';

export default function ProtectedRoute({ children, allowedRoles }) {
  const location = useLocation();
  const { isAuthenticated, currentUser } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (allowedRoles?.length && !allowedRoles.includes(currentUser.role)) {
    return (
      <EmptyState
        icon={LockKeyhole}
        title="Restricted area"
        description="This route is protected for future role-based access. Switch to an admin role in the demo settings to preview this page."
        action={<Button variant="secondary" onClick={() => window.history.back()}>Go Back</Button>}
      />
    );
  }

  return children;
}
