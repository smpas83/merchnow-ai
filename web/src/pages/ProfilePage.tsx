import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { toggleWorkerAvailability } from '../services/api';

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!user) window.location.href = '/login';
  }, [user]);

  const handleToggleAvailability = async () => {
    if (!user || user.role !== 'worker') return;
    setLoading(true);
    try {
      await toggleWorkerAvailability(user.id);
      window.location.reload();
    } catch (e: any) { setMessage(e.message); }
    finally { setLoading(false); }
  };

  if (!user) return null;

  return (
    <div className="page">
      <div className="page-header">
        <h1>Profile</h1>
      </div>
      <div className="card profile-card">
        <div className="profile-header">
          <div className="profile-avatar-lg">
            {user.first_name?.charAt(0)}{user.last_name?.charAt(0)}
          </div>
          <h2>{user.first_name} {user.last_name}</h2>
          <p className="profile-email">{user.email}</p>
          <span className="profile-role-badge">{user.role}</span>
        </div>
        <div className="profile-section">
          <h3>Account Details</h3>
          <div className="profile-info-grid">
            <div className="profile-info-item">
              <label>Role</label>
              <p>{user.role}</p>
            </div>
            <div className="profile-info-item">
              <label>Status</label>
              <p>{user.status || 'active'}</p>
            </div>
            <div className="profile-info-item">
              <label>Phone</label>
              <p>{user.phone || 'Not provided'}</p>
            </div>
            <div className="profile-info-item">
              <label>Member Since</label>
              <p>{new Date(user.created_at).toLocaleDateString()}</p>
            </div>
          </div>
        </div>
        {user.role === 'worker' && (
          <div className="profile-section">
            <h3>Availability</h3>
            <button onClick={handleToggleAvailability} disabled={loading} className="btn-toggle-large">
              {loading ? 'Updating...' : user?.is_available ? 'Mark Unavailable' : 'Mark Available'}
            </button>
            {message && <p className="text-muted">{message}</p>}
          </div>
        )}
        <div className="profile-section">
          <h3>Account Actions</h3>
          <button onClick={logout} className="btn-secondary">Sign Out</button>
        </div>
      </div>
    </div>
  );
}
