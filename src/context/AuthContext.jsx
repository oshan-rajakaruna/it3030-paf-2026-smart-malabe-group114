import { createContext } from 'react';

import { mockUsers } from '../data/users';
import { useLocalStorage } from '../hooks/useLocalStorage';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useLocalStorage('smart-campus-session', null);

  const currentUser = mockUsers.find((user) => user.id === session?.userId) ?? null;

  const login = (role, userId) => {
    const targetUser =
      mockUsers.find((user) => user.id === userId) ??
      mockUsers.find((user) => user.role === role);

    if (!targetUser) {
      return false;
    }

    setSession({
      userId: targetUser.id,
      role: targetUser.role,
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
