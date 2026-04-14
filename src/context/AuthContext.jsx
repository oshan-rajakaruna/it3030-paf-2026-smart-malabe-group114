import { createContext } from 'react';

import { mockUsers } from '../data/users';
import { useLocalStorage } from '../hooks/useLocalStorage';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useLocalStorage('smart-campus-session', null);

  const baseUser = mockUsers.find((user) => user.id === session?.userId) ?? null;
  const currentUser = baseUser
    ? {
        ...baseUser,
        name: session?.oauthName || baseUser.name,
        email: session?.oauthEmail || baseUser.email,
      }
    : null;

  const login = (role, userId, oauthProfile = null) => {
    const targetUser =
      mockUsers.find((user) => user.id === userId) ??
      mockUsers.find((user) => user.role === role);

    if (!targetUser) {
      return false;
    }

    setSession({
      userId: targetUser.id,
      role: targetUser.role,
      oauthName: oauthProfile?.name || null,
      oauthEmail: oauthProfile?.email || null,
      loggedInAt: new Date().toISOString(),
    });

    return true;
  };

  const logout = () => {
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
        users: mockUsers,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
