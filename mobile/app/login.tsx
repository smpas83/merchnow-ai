import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView, Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../_layout';

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Please enter email and password');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await login(email.trim(), password);
      router.replace('/(auth)/loading');
    } catch (e: any) {
      setError(e.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.logoContainer}>
          <View style={styles.logo}>
            <Text style={styles.logoText}>M</Text>
          </View>
          <Text style={styles.appName}>MerchNow</Text>
          <Text style={styles.tagline}>Field Merchandising Platform</Text>
        </View>

        <View style={styles.formContainer}>
          <Text style={styles.title}>Sign in</Text>
          <Text style={styles.subtitle}>Enter your credentials to continue</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="you@company.com"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
              autoFocus
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your password"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Sign In</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.push('/(auth)/register')} style={styles.linkButton}>
            <Text style={styles.linkText}>Don't have an account? Register</Text>
          </TouchableOpacity>

          <View style={styles.demoSection}>
            <Text style={styles.demoLabel}>Demo Accounts</Text>
            <View style={styles.demoItem}>
              <Text style={styles.demoCode}>customer@demo.com</Text>
              <Text style={styles.demoCode}>orgpass</Text>
            </View>
            <View style={styles.demoItem}>
              <Text style={styles.demoCode}>worker@demo.com</Text>
              <Text style={styles.demoCode}>workerpass</Text>
            </View>
            <View style={styles.demoItem}>
              <Text style={styles.demoCode}>admin@demo.com</Text>
              <Text style={styles.demoCode}>adminpass</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  logoContainer: { alignItems: 'center', marginBottom: 40 },
  logo: { width: 72, height: 72, borderRadius: 16, backgroundColor: '#8B5CF6', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  logoText: { fontSize: 32, fontWeight: 'bold', color: '#fff' },
  appName: { fontSize: 28, fontWeight: 'bold', color: '#111827', marginBottom: 4 },
  tagline: { fontSize: 14, color: '#6B7280' },
  formContainer: { backgroundColor: '#fff', borderRadius: 16, padding: 24, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, elevation: 2 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#111827', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#6B7280', marginBottom: 24 },
  inputGroup: { marginBottom: 16 },
  label: { fontSize: 12, fontWeight: '600', color: '#374151', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { backgroundColor: '#F3F4F6', borderRadius: 10, padding: 14, fontSize: 16, color: '#111827', borderWidth: 1, borderColor: '#E5E7EB' },
  errorText: { color: '#EF4444', fontSize: 14, marginBottom: 12, textAlign: 'center' },
  button: { backgroundColor: '#8B5CF6', borderRadius: 10, padding: 16, alignItems: 'center', marginTop: 8 },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  linkButton: { marginTop: 16, alignItems: 'center' },
  linkText: { color: '#8B5CF6', fontSize: 14, fontWeight: '500' },
  demoSection: { marginTop: 32, paddingTop: 20, borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  demoLabel: { fontSize: 12, fontWeight: '600', color: '#6B7280', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  demoItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  demoCode: { fontSize: 13, color: '#374151', fontFamily: 'monospace' },
});
