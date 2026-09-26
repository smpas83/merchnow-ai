import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { z } from 'zod';
import { loginSchema } from '../services/validations';

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const parsed = loginSchema.safeParse({ email, password });
      if (!parsed.success) { setError(parsed.error.errors[0].message); return; }
      await login(email, password);
      window.location.href = '/';
    } catch (err: any) {
      setError(err.message || 'Login failed');
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
        <h1 className="auth-title">Welcome back</h1>
        <p className="auth-subtitle">Sign in to your MerchNow account</p>
        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" autoComplete="email" />
          </div>
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter your password" autoComplete="current-password" />
          </div>
          {error && <div className="form-error">{error}</div>}
          <button type="submit" disabled={loading} className="btn-primary btn-full">
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
        <p className="auth-switch">
          Don't have an account? <a href="/register">Register</a>
        </p>
        <div className="auth-demo">
          <p className="demo-label">Demo accounts:</p>
          <div className="demo-accounts">
            <code>customer@demo.com</code> / <code>orgpass</code><br/>
            <code>worker@demo.com</code> / <code>workerpass</code><br/>
            <code>admin@demo.com</code> / <code>adminpass</code>
          </div>
        </div>
      </div>
    </div>
  );
}
