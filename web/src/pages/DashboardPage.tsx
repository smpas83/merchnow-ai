import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getJobs, getStores, getOrganizations, getCampaigns, getWorkers } from '../services/api';
import type { Job, Store, Organization, Campaign, WorkerProfile } from '../types';

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ jobs: 0, stores: 0, campaigns: 0, workers: 0, completed: 0, inProgress: 0, pending: 0 });
  const [jobs, setJobs] = useState<Job[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [workers, setWorkers] = useState<WorkerProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        setLoading(true);
        const [jobRes, orgRes, storeRes, campRes, workerRes] = await Promise.all([
          getJobs({ status: 'all' }),
          getOrganizations(),
          getStores(),
          getCampaigns(),
          getWorkers(),
        ]);
        setJobs(jobRes);
        setOrganizations(orgRes);
        setStores(storeRes);
        setCampaigns(campRes);
        setWorkers(workerRes);

        const allJobs = jobRes as Job[];
        setStats({
          jobs: allJobs.length,
          stores: storeRes.length,
          campaigns: campRes.length,
          workers: workerRes.length,
          completed: allJobs.filter((j: any) => j.status === 'completed').length,
          inProgress: allJobs.filter((j: any) => ['in_progress', 'checked_in', 'en_route', 'submitted', 'under_review'].includes(j.status)).length,
          pending: allJobs.filter((j: any) => ['created', 'scheduled', 'assigned', 'accepted'].includes(j.status)).length,
        });
      } catch (e: any) {
        setError(e.message || 'Failed to load dashboard');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  const statusColor = (s: string) => {
    const colors: Record<string, string> = {
      created: '#6B7280', scheduled: '#3B82F6', assigned: '#8B5CF6', accepted: '#8B5CF6',
      en_route: '#F59E0B', checked_in: '#F59E0B', in_progress: '#F59E0B',
      submitted: '#10B981', under_review: '#10B981', completed: '#10B981',
      cancelled: '#EF4444', no_show: '#EF4444', rework_required: '#F59E0B', disputed: '#EF4444',
    };
    return colors[s] || '#6B7280';
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>Dashboard</h1>
        <p className="text-muted">{user?.first_name} {user?.last_name} — {user?.role}</p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <div className="loading-center"><div className="spinner" /></div>
      ) : (
        <>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon" style={{ background: 'var(--color-primary)', color: 'white' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
              </div>
              <div className="stat-content">
                <div className="stat-value">{stats.jobs}</div>
                <div className="stat-label">Total Jobs</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon" style={{ background: 'var(--color-success)', color: 'white' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="M22 4 12 14.01l-3-3"/></svg>
              </div>
              <div className="stat-content">
                <div className="stat-value">{stats.completed}</div>
                <div className="stat-label">Completed</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon" style={{ background: 'var(--color-warning)', color: 'white' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
              </div>
              <div className="stat-content">
                <div className="stat-value">{stats.inProgress}</div>
                <div className="stat-label">In Progress</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon" style={{ background: 'var(--color-info)', color: 'white' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
              </div>
              <div className="stat-content">
                <div className="stat-value">{stats.pending}</div>
                <div className="stat-label">Pending</div>
              </div>
            </div>
          </div>

          <div className="dashboard-grid">
            <section className="card">
              <div className="card-header">
                <h2>Recent Jobs</h2>
                <a href="/jobs" className="card-link">View all</a>
              </div>
              <div className="card-body">
                {jobs.length === 0 ? (
                  <div className="empty-state"><p>No jobs yet. Create your first job to get started.</p></div>
                ) : (
                  <div className="job-list">
                    {jobs.slice(0, 5).map((job: any) => (
                      <a key={job.id} href={`/jobs/${job.id}`} className="job-item">
                        <div className="job-info">
                          <div className="job-title">{job.title}</div>
                          <div className="job-meta">
                            <span className="status-badge" style={{ background: statusColor(job.status), color: 'white' }}>{job.status}</span>
                            <span className="job-price">${job.base_price || '?'}</span>
                          </div>
                        </div>
                        <div className="job-meta-text">
                          {job.scheduled_at ? new Date(job.scheduled_at).toLocaleDateString() : 'Not scheduled'}
                        </div>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </section>

            <section className="card">
              <div className="card-header">
                <h2>Organizations</h2>
                <a href="/admin" className="card-link">Manage</a>
              </div>
              <div className="card-body">
                {organizations.length === 0 ? (
                  <div className="empty-state"><p>No organizations registered.</p></div>
                ) : (
                  <div className="org-list">
                    {organizations.map((org: any) => (
                      <div key={org.id} className="org-item">
                        <div className="org-avatar">{org.name.charAt(0)}</div>
                        <div className="org-info">
                          <div className="org-name">{org.name}</div>
                          <div className="org-type">{org.type}</div>
                        </div>
                        <span className="status-badge" style={{ background: org.status === 'active' ? 'var(--color-success)' : 'var(--color-destructive)' }}>{org.status}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            <section className="card">
              <div className="card-header">
                <h2>Available Workers</h2>
                <a href="/workers" className="card-link">View all</a>
              </div>
              <div className="card-body">
                {workers.length === 0 ? (
                  <div className="empty-state"><p>No workers registered yet.</p></div>
                ) : (
                  <div className="worker-list">
                    {workers.slice(0, 4).map((w: any) => (
                      <div key={w.id} className="worker-item">
                        <div className="worker-avatar">
                          {w.first_name?.charAt(0) || '?'}
                          {w.last_name?.charAt(0) || ''}
                        </div>
                        <div className="worker-info">
                          <div className="worker-name">{w.first_name} {w.last_name}</div>
                          <div className="worker-meta">
                            {w.avg_rating ? `★ ${w.avg_rating.toFixed(1)}` : 'No reviews'} · {w.total_jobs_completed} jobs
                          </div>
                        </div>
                        <span className={`status-badge ${w.is_available ? 'status-available' : 'status-unavailable'}`}>
                          {w.is_available ? 'Available' : 'Unavailable'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
