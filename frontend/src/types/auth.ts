export interface User {
  id: string;
  email: string;
  fullName?: string;
  role: 'ADMIN' | 'STAFF' | 'CUSTOMER';
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  setLoading: (loading: boolean) => void;
}
