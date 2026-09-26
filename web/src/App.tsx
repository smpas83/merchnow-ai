import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import JobsPage from './pages/JobsPage';
import StoresPage from './pages/StoresPage';
import CampaignsPage from './pages/CampaignsPage';
import WorkersPage from './pages/WorkersPage';
import JobDetailPage from './pages/JobDetailPage';
import ProfilePage from './pages/ProfilePage';
import AdminPage from './pages/AdminPage';

function ProtectedRoute({ children, roles }: { children: React.ReactNode; roles?: string[] }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-screen"><div className="spinner" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-brand">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
          </svg>
          <span className="brand-name">MerchNow</span>
        </div>
        <nav className="header-nav">
          <a href="/" className="nav-link">Dashboard</a>
          <a href="/jobs" className="nav-link">Jobs</a>
          <a href="/stores" className="nav-link">Stores</a>
          <a href="/campaigns" className="nav-link">Campaigns</a>
          {user?.role === 'customer' && <a href="/workers" className="nav-link">Workers</a>}
          {(user?.role === 'customer' || user?.role === 'admin') && <a href="/admin" className="nav-link">Admin</a>}
        </nav>
        <div className="header-actions">
          {user ? (
            <>
              <span className="user-name">{user.first_name} {user.last_name}</span>
              <button onClick={() => { localStorage.removeItem('merchnow_token'); window.location.href = '/login'; }} className="btn-logout">Logout</button>
            </>
          ) : (
            <>
              <a href="/login" className="btn-login">Login</a>
              <a href="/register" className="btn-register">Register</a>
            </>
          )}
        </div>
      </header>
      <main className="app-main">
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="/jobs" element={<ProtectedRoute><JobsPage /></ProtectedRoute>} />
          <Route path="/jobs/:id" element={<ProtectedRoute><JobDetailPage /></ProtectedRoute>} />
          <Route path="/stores" element={<ProtectedRoute><StoresPage /></ProtectedRoute>} />
          <Route path="/campaigns" element={<ProtectedRoute><CampaignsPage /></ProtectedRoute>} />
          <Route path="/workers" element={<ProtectedRoute roles={['customer', 'admin']}><WorkersPage /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute roles={['admin']}><AdminPage /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
