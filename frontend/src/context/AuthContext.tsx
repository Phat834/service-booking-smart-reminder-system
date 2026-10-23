import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type { User, AuthState } from '@/types/auth';

const AuthContext = createContext<AuthState | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: true,
    login: () => {},
    logout: () => {},
    setLoading: () => {},
  });

  useEffect(() => {
    let cancelled = false;

    const restoreAuth = async () => {
      const token = localStorage.getItem('token');
      const userStr = localStorage.getItem('user');

      try {
        if (token && userStr) {
          const user: User = JSON.parse(userStr);
          if (!cancelled) {
            setState((prev) => ({
              ...prev,
              token,
              user,
              isAuthenticated: true,
              isLoading: false,
            }));
          }
        } else {
          if (!cancelled) {
            setState((prev) => ({ ...prev, isLoading: false }));
          }
        }
      } catch {
        if (!cancelled) {
          setState((prev) => ({ ...prev, isLoading: false }));
        }
      }
    };

    restoreAuth();

    return () => {
      cancelled = true;
    };
  }, []);

  const login = (token: string, user: User) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    setState((prev) => ({
      ...prev,
      token,
      user,
      isAuthenticated: true,
    }));
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setState({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      login,
      logout,
      setLoading: () => {},
    });
  };

  const setLoading = (loading: boolean) => {
    setState((prev) => ({ ...prev, isLoading: loading }));
  };

  const value: AuthState = {
    ...state,
    login,
    logout,
    setLoading,
  };

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
};
