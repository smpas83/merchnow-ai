import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { z } from 'zod';
import { registerSchema } from '../services/validations';
import type { z as zType } from 'zod';

export default function RegisterPage() {
  const { register } = useAuth();
  const [form, setForm] = useState({ email: '', password: '', first_name: '', last_name: '', role: 'customer' as const, phone: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (field: string, value: string) => setForm(f => ({ ...f, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const parsed = registerSchema.safeParse(form);
      if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
      await register(parsed.data);
      window.location.href = '/';
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
          </svg>
        </div>
        <h1 className="auth-title">Create your account</h1>
        <p className="auth-subtitle">Join MerchNow to get started</p>
        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="first_name">First name</label>
              <input id="first_name" type="text" value={form.first_name} onChange={e => handleChange('first_name', e.target.value)} placeholder="Jane" autoComplete="given-name" />
            </div>
            <div className="form-group">
              <label htmlFor="last_name">Last name</label>
              <input id="last_name" type="text" value={form.last_name} onChange={e => handleChange('last_name', e.target.value)} placeholder="Doe" autoComplete="family-name" />
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" value={form.email} onChange={e => handleChange('email', e.target.value)} placeholder="you@company.com" autoComplete="email" />
          </div>
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input id="password" type="password" value={form.password} onChange={e => handleChange('password', e.target.value)} placeholder="At least 6 characters" autoComplete="new-password" />
          </div>
          <div className="form-group">
            <label htmlFor="role">I am a...</label>
            <select id="role" value={form.role} onChange={e => handleChange('role', e.target.value)}>
              <option value="customer">Customer / Brand / Retailer</option>
              <option value="worker">Field Merchandiser / Worker</option>
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="phone">Phone (optional)</label>
            <input id="phone" type="tel" value={form.phone} onChange={e => handleChange('phone', e.target.value)} placeholder="+1-555-0123" />
          </div>
          {error && <div className="form-error">{error}</div>}
          <button type="submit" disabled={loading} className="btn-primary btn-full">
            {loading ? 'Creating account...' : 'Create account'}
          </button>
        </form>
        <p className="auth-switch">
          Already have an account? <a href="/login">Sign in</a>
        </p>
      </div>
    </div>
  );
}
