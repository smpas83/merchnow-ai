import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView, Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/auth';

export default function RegisterScreen() {
  const router = useRouter();
  const { register } = useAuth();
  const [form, setForm] = useState({
    email: '', password: '', first_name: '', last_name: '', role: 'customer', phone: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const update = (field: string, value: string) => setForm(f => ({ ...f, [field]: value }));

  const handleRegister = async () => {
    if (!form.email.trim() || !form.password.trim() || !form.first_name.trim() || !form.last_name.trim()) {
      setError('Please fill in all required fields');
      return;
    }
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await register(form);
      router.replace('/(auth)/loading');
    } catch (e: any) {
      setError(e.message || 'Registration failed');
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
          <Text style={styles.tagline}>Create your account</Text>
        </View>

        <View style={styles.formContainer}>
          <View style={styles.row}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>First Name</Text>
              <TextInput style={styles.input} placeholder="Jane" value={form.first_name} onChangeText={v => update('first_name', v)} autoCapitalize="words" />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Last Name</Text>
              <TextInput style={styles.input} placeholder="Doe" value={form.last_name} onChangeText={v => update('last_name', v)} autoCapitalize="words" />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput style={styles.input} placeholder="you@company.com" keyboardType="email-address" autoCapitalize="none" value={form.email} onChangeText={v => update('email', v)} />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <TextInput style={styles.input} placeholder="At least 6 characters" secureTextEntry value={form.password} onChangeText={v => update('password', v)} />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>I am a...</Text>
            <View style={styles.segmentedControl}>
              <TouchableOpacity style={[styles.segment, form.role === 'customer' && styles.segmentActive]} onPress={() => update('role', 'customer')}>
                <Text style={[styles.segmentText, form.role === 'customer' && styles.segmentTextActive]}>Customer</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.segment, form.role === 'worker' && styles.segmentActive]} onPress={() => update('role', 'worker')}>
                <Text style={[styles.segmentText, form.role === 'worker' && styles.segmentTextActive]}>Worker</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Phone (optional)</Text>
            <TextInput style={styles.input} placeholder="+1-555-0123" keyboardType="phone-pad" value={form.phone} onChangeText={v => update('phone', v)} />
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity style={[styles.button, loading && styles.buttonDisabled]} onPress={handleRegister} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Create Account</Text>}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.push('/(auth)/login')} style={styles.linkButton}>
            <Text style={styles.linkText}>Already have an account? Sign in</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  logoContainer: { alignItems: 'center', marginBottom: 32 },
  logo: { width: 64, height: 64, borderRadius: 14, backgroundColor: '#8B5CF6', justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
  logoText: { fontSize: 28, fontWeight: 'bold', color: '#fff' },
  appName: { fontSize: 24, fontWeight: 'bold', color: '#111827', marginBottom: 4 },
  tagline: { fontSize: 14, color: '#6B7280' },
  formContainer: { backgroundColor: '#fff', borderRadius: 14, padding: 20, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, elevation: 2 },
  row: { flexDirection: 'row', gap: 12 },
  inputGroup: { marginBottom: 14 },
  label: { fontSize: 11, fontWeight: '600', color: '#374151', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { backgroundColor: '#F3F4F6', borderRadius: 10, padding: 13, fontSize: 16, color: '#111827', borderWidth: 1, borderColor: '#E5E7EB' },
  segmentedControl: { flexDirection: 'row', backgroundColor: '#F3F4F6', borderRadius: 8, padding: 3 },
  segment: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 6 },
  segmentActive: { backgroundColor: '#fff' },
  segmentText: { fontSize: 14, color: '#6B7280', fontWeight: '500' },
  segmentTextActive: { color: '#8B5CF6', fontWeight: '600' },
  errorText: { color: '#EF4444', fontSize: 13, marginBottom: 10, textAlign: 'center' },
  button: { backgroundColor: '#8B5CF6', borderRadius: 10, padding: 15, alignItems: 'center', marginTop: 6 },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  linkButton: { marginTop: 14, alignItems: 'center' },
  linkText: { color: '#8B5CF6', fontSize: 14, fontWeight: '500' },
});
