import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Image, Alert, ActivityIndicator, ScrollView, TextInput,
  SafeAreaView, StatusBar, Linking, Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import { useRouter } from 'expo-router';
import type { User, Job, Task, Store, WorkerProfile } from '../../shared/types';

const API = 'http://10.0.2.2:3000/api'; // Android emulator localhost

// Shared types (imported from web or defined inline)
export interface UserType {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: 'customer' | 'worker' | 'admin';
  phone?: string;
  status?: string;
  created_at: string;
}

export interface JobType {
  id: string;
  organization_id: string;
  store_id: string;
  store_name?: string;
  store_address?: string;
  title: string;
  description?: string;
  scope_of_work?: string;
  instructions?: string;
  status: string;
  priority: string;
  pricing_type: string;
  base_price?: number;
  hourly_rate?: number;
  scheduled_at?: string;
  assigned_worker_id?: string;
  created_at: string;
}

export interface TaskType {
  id: string;
  job_id: string;
  order_index: number;
  title: string;
  description?: string;
  category?: string;
  is_required: number;
  proof_type?: string;
}

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
  const [user, setUser] = useState<UserType | null>(null);
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
export default function Index() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) router.replace('/(auth)/login');
  }, [user, loading, router]);

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color="#8B5CF6" />
        <Text style={styles.loadingText}>Loading...</Text>
      </SafeAreaView>
    );
  }

  if (!user) return null;

  // Redirect based on role
  if (user.role === 'worker') {
    router.replace('/(worker)/dashboard');
  } else if (user.role === 'customer') {
    router.replace('/(customer)/dashboard');
  } else if (user.role === 'admin') {
    router.replace('/(admin)/dashboard');
  }

  return null;
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9FAFB' },
  loadingText: { marginTop: 16, color: '#6B7280', fontSize: 16 },
});
