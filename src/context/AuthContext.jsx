import { createContext } from 'react';

import { mockUsers } from '../data/users';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { appendLoginActivity, getApprovedSignups } from '../utils/adminStorage';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useLocalStorage('smart-campus-session', null);
  const approvedSignups = getApprovedSignups();
  const approvedUsers = approvedSignups.map((request, index) => ({
    id: request.userId || `approved-${request.id || index}`,
    name: request.name || 'Approved User',
    role: request.role || 'USER',
    email: request.email || 'unknown@example.com',
    department: request.department || 'Self-registered',
    phone: request.phone || 'N/A',
    title: request.title || 'Pending activation',
  }));
  const allUsers = [...mockUsers, ...approvedUsers];

  const baseUser = allUsers.find((user) => user.id === session?.userId) ?? null;
  const currentUser = baseUser
    ? {
        ...baseUser,
        name: session?.name || session?.oauthName || baseUser.name,
        email: session?.email || session?.oauthEmail || baseUser.email,
        role: session?.role || baseUser.role,
      }
    : session
      ? {
          id: session.userId || `session-${session.email || Date.now()}`,
          name: session.name || session.oauthName || 'Campus User',
          role: session.role || 'USER',
          email: session.email || session.oauthEmail || 'unknown@example.com',
          department: 'Self-registered',
          phone: 'N/A',
          title: 'Campus member',
        }
      : null;

  const login = (role, userId, profile = null) => {
    const roleFromArgs = profile?.role || role;
    const targetUser =
      allUsers.find((user) => String(user.id) === String(userId || profile?.id || '')) ??
      allUsers.find((user) => user.role === roleFromArgs);

    if (!targetUser && !profile?.name && !profile?.email) {
      return false;
    }

    const finalRole = roleFromArgs || targetUser?.role || 'USER';
    const finalName = profile?.name || targetUser?.name || 'Campus User';
    const finalEmail = profile?.email || targetUser?.email || 'unknown@example.com';
    const finalUserId = userId || profile?.id || targetUser?.id || `session-${Date.now()}`;

    setSession({
      userId: finalUserId,
      role: finalRole,
      name: finalName,
      email: finalEmail,
      oauthName: profile?.name || null,
      oauthEmail: profile?.email || null,
      loggedInAt: new Date().toISOString(),
    });

    try {
      window.localStorage.setItem('role', String(finalRole));
      window.localStorage.setItem('userId', String(finalUserId));
    } catch (error) {
      // Ignore localStorage sync errors; session storage hook still handles auth state.
    }

    appendLoginActivity({
      userId: finalUserId,
      name: finalName,
      email: finalEmail,
      role: finalRole,
      provider: profile?.provider || 'manual',
    });

    return true;
  };

  const logout = () => {
    try {
      window.localStorage.removeItem('role');
      window.localStorage.removeItem('userId');
    } catch (error) {
      // Ignore localStorage cleanup errors.
    }
    setSession(null);
  };

  const switchRole = (role) => login(role);

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isAuthenticated: Boolean(currentUser),
        login,
        logout,
        switchRole,
        users: allUsers,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
