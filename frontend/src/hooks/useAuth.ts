import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import type { User } from '../lib/types';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const u = await api.get<User>('/auth/me');
      setUser(u);
    } catch {
      localStorage.removeItem('token');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUser(); }, [fetchUser]);

  const login = async (email: string, password: string) => {
    const res = await api.post<{ access_token: string }>('/auth/login', { email, password });
    localStorage.setItem('token', res.access_token);
    await fetchUser();
  };

  const register = async (email: string, password: string, display_name: string) => {
    await api.post('/auth/register', { email, password, display_name });
    await login(email, password);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  return { user, loading, login, register, logout };
}
