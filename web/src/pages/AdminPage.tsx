import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getAuditEvents, getNotifications, getOrganizations, getStores, getCampaigns, getWorkers } from '../services/api';
import type { Organization, Store, Campaign, WorkerProfile } from '../types';

export default function AdminPage() {
  const { user } = useAuth();
  const [events, setEvents] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [workers, setWorkers] = useState<WorkerProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('overview');

  useEffect(() => {
    if (!user || user.role !== 'admin') return;
    const load = async () => {
      try {
        const [eRes, nRes, orgRes, sRes, cRes, wRes] = await Promise.all([
          getAuditEvents(50),
          getNotifications(),
          getOrganizations(),
          getStores(),
          getCampaigns(),
          getWorkers(),
        ]);
        setEvents(eRes);
        setNotifications(nRes);
        setOrganizations(orgRes);
        setStores(sRes);
        setCampaigns(cRes);
        setWorkers(wRes);
      } catch (e) { /* ignore */ }
      finally { setLoading(false); }
    };
    load();
  }, [user]);

  if (user?.role !== 'admin') return <div className="page"><div className="alert alert-error">Admin access required.</div></div>;

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      active: 'var(--color-success)', inactive: 'var(--color-destructive)',
      draft: '#6B7280', completed: '#3B82F6', cancelled: '#EF4444',
    };
    return colors[status] || '#6B7280';
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>Admin Panel</h1>
        <p className="text-muted">Platform operations dashboard</p>
      </div>

      {loading ? (
        <div className="loading-center"><div className="spinner" /></div>
      ) : (
        <div className="admin-layout">
          <div className="admin-sidebar">
            <button className={`admin-tab ${tab === 'overview' ? 'active' : ''}`} onClick={() => setTab('overview')}>Overview</button>
            <button className={`admin-tab ${tab === 'audit' ? 'active' : ''}`} onClick={() => setTab('audit')}>Audit Log</button>
            <button className={`admin-tab ${tab === 'notifications' ? 'active' : ''}`} onClick={() => setTab('notifications')}>Notifications</button>
          </div>
          <div className="admin-content">
            {tab === 'overview' && (
              <div className="admin-grid">
                <div className="card">
                  <div className="card-header"><h3>Organizations</h3></div>
                  <div className="card-body">
                    <div className="admin-stats">
                      <div className="admin-stat"><span className="admin-stat-val">{organizations.length}</span><span className="admin-stat-lbl">Total</span></div>
                      <div className="admin-stat"><span className="admin-stat-val">{organizations.filter((o: any) => o.status === 'active').length}</span><span className="admin-stat-lbl">Active</span></div>
                    </div>
                    <div className="admin-list">
                      {organizations.map((org: any) => (
                        <div key={org.id} className="admin-item">
                          <div className="admin-item-info">
                            <span className="admin-item-name">{org.name}</span>
                            <span className="admin-item-meta">{org.slug} · {org.type}</span>
                          </div>
                          <span className="status-badge" style={{ background: statusBadge(org.status), color: 'white' }}>{org.status}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="card">
                  <div className="card-header"><h3>Stores</h3></div>
                  <div className="card-body">
                    <div className="admin-stats">
                      <div className="admin-stat"><span className="admin-stat-val">{stores.length}</span><span className="admin-stat-lbl">Total</span></div>
                      <div className="admin-stat"><span className="admin-stat-val">{stores.filter((s: any) => s.status === 'active').length}</span><span className="admin-stat-lbl">Active</span></div>
                    </div>
                    <div className="admin-list">
                      {stores.map((s: any) => (
                        <div key={s.id} className="admin-item">
                          <div className="admin-item-info">
                            <span className="admin-item-name">{s.name}</span>
                            <span className="admin-item-meta">{s.city}, {s.state}</span>
                          </div>
                          <span className="status-badge" style={{ background: statusBadge(s.status), color: 'white' }}>{s.status}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="card">
                  <div className="card-header"><h3>Campaigns</h3></div>
                  <div className="card-body">
                    <div className="admin-list">
                      {campaigns.map((c: any) => (
                        <div key={c.id} className="admin-item">
                          <div className="admin-item-info">
                            <span className="admin-item-name">{c.name}</span>
                            <span className="admin-item-meta">{c.description || 'No description'}</span>
                          </div>
                          <span className="status-badge" style={{ background: statusBadge(c.status), color: 'white' }}>{c.status}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="card">
                  <div className="card-header"><h3>Workers</h3></div>
                  <div className="card-body">
                    <div className="admin-stats">
                      <div className="admin-stat"><span className="admin-stat-val">{workers.length}</span><span className="admin-stat-lbl">Registered</span></div>
                      <div className="admin-stat"><span className="admin-stat-val">{workers.filter((w: any) => w.is_available).length}</span><span className="admin-stat-lbl">Available</span></div>
                    </div>
                    <div className="admin-list">
                      {workers.map((w: any) => (
                        <div key={w.id} className="admin-item">
                          <div className="admin-item-info">
                            <span className="admin-item-name">{w.first_name} {w.last_name}</span>
                            <span className="admin-item-meta">{w.email} · ★{w.avg_rating || 'N/A'} · {w.total_jobs_completed} jobs</span>
                          </div>
                          <span className={`status-badge ${w.is_available ? 'status-available' : 'status-unavailable'}`}>
                            {w.is_available ? 'Available' : 'Unavailable'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {tab === 'audit' && (
              <div className="card">
                <div className="card-header"><h3>Audit Events</h3></div>
                <div className="card-body">
                  <table className="admin-table">
                    <thead><tr><th>Time</th><th>Event</th><th>Actor</th><th>Resource</th></tr></thead>
                    <tbody>
                      {events.map((e: any) => (
                        <tr key={e.id}>
                          <td>{new Date(e.created_at).toLocaleString()}</td>
                          <td><span className="event-type">{e.event_type}</span></td>
                          <td>{e.actor_first_name} {e.actor_last_name}</td>
                          <td>{e.resource_type || '—'} / {e.resource_id || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {tab === 'notifications' && (
              <div className="card">
                <div className="card-header"><h3>Platform Notifications</h3></div>
                <div className="card-body">
                  {notifications.length === 0 ? (
                    <p className="text-muted">No notifications.</p>
                  ) : (
                    <div className="notification-list">
                      {notifications.map((n: any) => (
                        <div key={n.id} className={`notification-item ${n.read ? 'read' : 'unread'}`}>
                          <div className="notif-icon">🔔</div>
                          <div className="notif-content">
                            <div className="notif-title">{n.title || 'Notification'}</div>
                            <div className="notif-body">{n.body || ''}</div>
                            <small>{new Date(n.created_at).toLocaleString()}</small>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
