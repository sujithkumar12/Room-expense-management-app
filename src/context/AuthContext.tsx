import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from 'react';
import { api, getStoredUser, setAuth, clearAuth, getToken } from '../api/client';
import type { User } from '../types';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readStoredUser(): User | null {
  const stored = getStoredUser();
  return stored && getToken() ? stored : null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(readStoredUser);

  const login = async (email: string, password: string) => {
    const { token, user: loggedInUser } = await api.login({ email, password });
    setAuth(token, loggedInUser);
    setUser(loggedInUser);
  };

  const signup = async (name: string, email: string, password: string) => {
    const { token, user: newUser } = await api.signup({ name, email, password });
    setAuth(token, newUser);
    setUser(newUser);
  };

  const logout = () => {
    clearAuth();
    setUser(null);
  };

  const updateUser = (updated: User) => {
    const token = getToken();
    if (token) {
      setAuth(token, {
        id: updated.id,
        name: updated.name,
        email: updated.email,
      });
    }
    setUser(updated);
  };

  return (
    <AuthContext.Provider value={{ user, loading: false, login, signup, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
