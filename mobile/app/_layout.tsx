import React, { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { useAuth } from '../src/auth';

export default function RootLayout() {
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

  if (user.role === 'worker') router.replace('/(worker)/dashboard');
  else if (user.role === 'customer') router.replace('/(customer)/dashboard');
  else if (user.role === 'admin') router.replace('/(admin)/dashboard');

  return null;
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9FAFB' },
  loadingText: { marginTop: 16, color: '#6B7280', fontSize: 16 },
});
