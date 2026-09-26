import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getWorkers, toggleWorkerAvailability, getOrganizations } from '../services/api';
import type { WorkerProfile } from '../types';

export default function WorkersPage() {
  const { user } = useAuth();
  const [workers, setWorkers] = useState<(WorkerProfile & { first_name: string; last_name: string; email: string })[]>([]);
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ available: false, search: '' });
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        const [wRes, orgRes] = await Promise.all([getWorkers(), getOrganizations()]);
        setWorkers(wRes as (WorkerProfile & { first_name: string; last_name: string; email: string })[]);
        setOrganizations(orgRes);
      } catch (e: any) { setError(e.message || 'Failed to load workers'); }
      finally { setLoading(false); }
    };
    load();
  }, [user]);

  const filtered = workers.filter(w => {
    const available = filter.available ? w.is_available === 1 : true;
    const search = filter.search.toLowerCase();
    const matches = !search || `${w.first_name} ${w.last_name} ${w.email}`.toLowerCase().includes(search);
    return available && matches;
  });

  const toggleAvail = async (userId: string) => {
    try {
      const result = await toggleWorkerAvailability(userId);
      setWorkers(prev => prev.map(w => w.user_id === userId ? { ...w, is_available: result.is_available ? 1 : 0 } : w));
    } catch (e: any) { setError(e.message); }
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>Field Workers</h1>
        {user?.role === 'worker' && (
          <button onClick={() => {
            const current = workers.find(w => w.user_id === user?.id);
            if (current) toggleAvail(user!.id);
          }} className="btn-toggle-availability">
            {workers.find(w => w.user_id === user?.id)?.is_available ? 'Mark Unavailable' : 'Mark Available'}
          </button>
        )}
      </div>

      <div className="filters-bar">
        <input type="text" placeholder="Search workers..." value={filter.search} onChange={e => setFilter(f => ({ ...f, search: e.target.value }))} className="search-input" />
        <label className="filter-checkbox">
          <input type="checkbox" checked={filter.available} onChange={e => setFilter(f => ({ ...f, available: e.target.checked }))} />
          <span>Only available</span>
        </label>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <div className="loading-center"><div className="spinner" /></div>
      ) : (
        <>
          {filtered.length === 0 ? (
            <div className="empty-state-large">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              <h3>No workers found</h3>
              <p>{ filter.available ? 'No available workers match your filter.' : 'Register workers or adjust your filters.' }</p>
            </div>
          ) : (
            <div className="workers-grid">
              {filtered.map((w: any) => (
                <div key={w.id} className="worker-card">
                  <div className="worker-card-header">
                    <div className="worker-avatar-lg">
                      {w.first_name?.charAt(0) || '?'}
                      {w.last_name?.charAt(0) || ''}
                    </div>
                    <div className="worker-header-info">
                      <h3>{w.first_name} {w.last_name}</h3>
                      <p className="worker-email">{w.email}</p>
                    </div>
                    <span className={`availability-badge ${w.is_available ? 'available' : 'unavailable'}`}>
                      {w.is_available ? 'Available' : 'Unavailable'}
                    </span>
                  </div>
                  <div className="worker-stats">
                    <div className="worker-stat">
                      <span className="stat-val">{w.total_jobs_completed}</span>
                      <span className="stat-lbl">Jobs Completed</span>
                    </div>
                    <div className="worker-stat">
                      <span className="stat-val">{w.avg_rating ? `★ ${w.avg_rating.toFixed(1)}` : '—'}</span>
                      <span className="stat-lbl">Rating</span>
                    </div>
                    <div className="worker-stat">
                      <span className="stat-val">${w.hourly_rate?.toFixed(2)}</span>
                      <span className="stat-lbl">Hourly Rate</span>
                    </div>
                    <div className="worker-stat">
                      <span className="stat-val">{w.travel_radius_miles} mi</span>
                      <span className="stat-lbl">Radius</span>
                    </div>
                  </div>
                  {w.bio && <p className="worker-bio">{w.bio}</p>}
                  {w.skills && <div className="worker-skills">
                    {w.skills.split(',').map((s: string) => (
                      <span key={s} className="skill-tag">{s.trim()}</span>
                    ))}
                  </div>}
                  {user?.role === 'customer' && (
                    <button className="btn-secondary" onClick={() => toggleAvail(w.user_id)}>
                      {w.is_available ? 'Mark Unavailable' : 'Mark Available'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
