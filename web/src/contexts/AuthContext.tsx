import React, { useState, useEffect, useCallback } from 'react';
import type { User } from '../types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

function normalizeUser(u: any): User {
  return { ...u, first_name: u.first_name ?? u.firstName, last_name: u.last_name ?? u.lastName, avatar_url: u.avatar_url ?? u.profilePhotoUrl };
}

function useToken() {
  const [token, setToken] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('merchnow_token');
    }
    return null;
  });

  const set = useCallback((newToken: string | null) => {
    if (newToken) {
      localStorage.setItem('merchnow_token', newToken);
    } else {
      localStorage.removeItem('merchnow_token');
    }
    setToken(newToken);
  }, []);

  return { token, setToken: set };
}

function useUser() {
  const { token, setToken } = useToken();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (token) {
      fetch(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(r => r.json())
        .then(data => {
          const u = data.user ?? (data.id ? data : null);
          if (u) setUser(normalizeUser(u));
          else if (data.error === 'Unauthorized') { setToken(null); setUser(null); }
        })
        .catch(() => setError('Failed to load user'))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [token, setToken]);

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');
      setToken(data.token);
      setUser(normalizeUser(data.user));
      return data;
    } catch (e: any) {
      setError(e.message);
      throw e;
    } finally {
      setLoading(false);
    }
  }, [setToken]);

  const register = useCallback(async (data: any) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Registration failed');
      setToken(json.token);
      setUser(normalizeUser(json.user));
      return json;
    } catch (e: any) {
      setError(e.message);
      throw e;
    } finally {
      setLoading(false);
    }
  }, [setToken]);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, [setToken]);

  return { user, loading, error, login, register, logout };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const auth = useUser();
  return (
    <AuthContext.Provider value={auth}>
      {children}
    </AuthContext.Provider>
  );
}

const AuthContext = React.createContext<ReturnType<typeof useUser>>(null as any);
export function useAuth() { return React.useContext(AuthContext); }
