import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';

export interface User {
  id: number;
  fullName: string;
  email: string;
  phone: string;
  role: 'admin' | 'manager' | 'cashier' | 'waiter' | 'chef';
  roleName: string;
  branch?: { id: number; name: string };
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('rms_token'));
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    async function loadUser() {
      if (token) {
        try {
          const res = await api.get('/auth/me');
          setUser(res.data.user);
        } catch (error) {
          console.error('Session expired:', error);
          logout();
        }
      }
      setIsLoading(false);
    }
    loadUser();
  }, [token]);

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      const res = await api.post('/auth/staff-login', { email, password });
      const { token: receivedToken, user: receivedUser } = res.data;
      localStorage.setItem('rms_token', receivedToken);
      setToken(receivedToken);
      setUser(receivedUser);
      return true;
    } catch (error: any) {
      alert(error.response?.data?.message || 'Đăng nhập thất bại.');
      return false;
    }
  };

  const logout = () => {
    localStorage.removeItem('rms_token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
