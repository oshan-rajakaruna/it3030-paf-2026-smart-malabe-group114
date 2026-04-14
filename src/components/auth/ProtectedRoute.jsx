import { useEffect, useMemo, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { LockKeyhole } from 'lucide-react';

import EmptyState from '../ui/EmptyState';
import Button from '../ui/Button';
import { useAuth } from '../../hooks/useAuth';
import { resolveRoleAndPath } from '../../utils/authRouting';

export default function ProtectedRoute({ children, allowedRoles }) {
  const location = useLocation();
  const { isAuthenticated, currentUser, login } = useAuth();
  const [oauthAttempted, setOauthAttempted] = useState(false);

  const oauthInfo = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const oauthProvider = params.get('oauth');
    const oauthEmail = params.get('email');

    if (!oauthProvider || !oauthEmail) {
      return null;
    }

    const normalizedEmail = oauthEmail.trim().toLowerCase();
    return {
      normalizedEmail,
      ...resolveRoleAndPath(normalizedEmail),
    };
  }, [location.search]);

  useEffect(() => {
    if (!isAuthenticated && oauthInfo && !oauthAttempted) {
      const didLogin = login(oauthInfo.role);
      if (!didLogin) {
        setOauthAttempted(true);
        return;
      }
      setOauthAttempted(true);
    }
  }, [isAuthenticated, oauthInfo, oauthAttempted, login]);

  if (!isAuthenticated) {
    if (oauthInfo && !oauthAttempted) {
      return null;
    }
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (oauthInfo && location.pathname !== oauthInfo.path) {
    return <Navigate to={oauthInfo.path} replace />;
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
