// Shared auth hook for mobile app screens
import { useState, useEffect, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';
import type { User } from '../src/types';

const API = 'http://10.0.2.2:3000/api';

async function apiCall(path: string, options?: any) {
  const token = await SecureStore.getItemAsync('merchnow_token');
  const headers: any = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, { ...options, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'API error');
  return data;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const token = await SecureStore.getItemAsync('merchnow_token');
        if (token) {
          const data = await apiCall('/auth/me');
          setUser(data.user);
        }
      } catch (e) {
        await SecureStore.deleteItemAsync('merchnow_token');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await apiCall('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    await SecureStore.setItemAsync('merchnow_token', data.token);
    setUser(data.user);
    return data;
  }, []);

  const register = useCallback(async (data: any) => {
    const result = await apiCall('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    await SecureStore.setItemAsync('merchnow_token', result.token);
    setUser(result.user);
    return result;
  }, []);

  const logout = useCallback(async () => {
    await SecureStore.deleteItemAsync('merchnow_token');
    setUser(null);
  }, []);

  return { user, loading, login, register, logout };
}

export { apiCall };
