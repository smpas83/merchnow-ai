import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getJobs, createJob, getStores, getCampaigns, getTasks, createTask, completeTask } from '../services/api';
import { z } from 'zod';
import { createJobSchema, createTaskSchema } from '../services/validations';
import type { Job, Store, Campaign, Task, JobStatus } from '../types';

export default function JobsPage() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    store_id: '', title: '', description: '', scope_of_work: '', instructions: '',
    requirements: '', scheduled_at: '', priority: 'normal', pricing_type: 'fixed',
    base_price: '', estimated_duration_minutes: '60', campaign_id: '',
  });
  const [taskForm, setTaskForm] = useState({ order_index: '1', title: '', description: '', category: 'execution', proof_type: 'photo', is_required: '1' });
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        const [jobRes, storeRes, campRes] = await Promise.all([
          getJobs({ orgId: user.role === 'customer' ? undefined : undefined }),
          getStores(),
          getCampaigns(),
        ]);
        setJobs(jobRes);
        setStores(storeRes);
        setCampaigns(campRes);
      } catch (e: any) { setError(e.message || 'Failed to load jobs'); }
      finally { setLoading(false); }
    };
    load();
  }, [user]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const parsed = createJobSchema.safeParse({ ...createForm, base_price: parseFloat(createForm.base_price) || undefined, estimated_duration_minutes: parseInt(createForm.estimated_duration_minutes) || undefined });
      if (!parsed.success) { setError(parsed.error.errors[0].message); return; }
      const job = await createJob(parsed.data);
      await createDefaultTasks(job.id);
      setJobs(prev => [job, ...prev]);
      setShowCreate(false);
      setCreateForm({
        store_id: '', title: '', description: '', scope_of_work: '', instructions: '',
        requirements: '', scheduled_at: '', priority: 'normal', pricing_type: 'fixed',
        base_price: '', estimated_duration_minutes: '60', campaign_id: '',
      });
    } catch (e: any) { setError(e.message || 'Failed to create job'); }
  };

  const createDefaultTasks = async (jobId: string) => {
    const defaults = [
      { order_index: 1, title: 'Check In', description: 'Arrive at store and check in with manager', category: 'check_in', proof_type: 'location' },
      { order_index: 2, title: 'Execute Work', description: 'Perform the required merchandising tasks', category: 'execution', proof_type: 'photo' },
      { order_index: 3, title: 'Photograph Results', description: 'Take photos of completed work', category: 'photo', proof_type: 'photo' },
      { order_index: 4, title: 'Check Out', description: 'Confirm completion with store manager', category: 'check_out', proof_type: 'notes' },
    ];
    for (const t of defaults) {
      await createTask(jobId, { ...t, is_required: '1' });
    }
  };

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
        <h1>Jobs</h1>
        <button onClick={() => setShowCreate(!showCreate)} className="btn-primary">
          {showCreate ? 'Cancel' : '+ Create Job'}
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <div className="loading-center"><div className="spinner" /></div>
      ) : (
        <>
          {showCreate && (
            <div className="card create-job-card">
              <div className="card-header"><h2>New Job</h2></div>
              <form onSubmit={handleCreate} className="form-card">
                <div className="form-group">
                  <label>Store *</label>
                  <select value={createForm.store_id} onChange={e => setCreateForm(f => ({ ...f, store_id: e.target.value }))} required>
                    <option value="">Select a store</option>
                    {stores.map((s: any) => <option key={s.id} value={s.id}>{s.name} — {s.city}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Campaign (optional)</label>
                  <select value={createForm.campaign_id} onChange={e => setCreateForm(f => ({ ...f, campaign_id: e.target.value }))}>
                    <option value="">None</option>
                    {campaigns.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Title *</label>
                  <input type="text" value={createForm.title} onChange={e => setCreateForm(f => ({ ...f, title: e.target.value }))} placeholder="Summer display setup" required />
                </div>
                <div className="form-group">
                  <label>Description</label>
                  <textarea value={createForm.description} onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))} placeholder="Describe the job..." rows={3} />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Priority</label>
                    <select value={createForm.priority} onChange={e => setCreateForm(f => ({ ...f, priority: e.target.value }))}>
                      <option value="low">Low</option>
                      <option value="normal">Normal</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Pricing</label>
                    <select value={createForm.pricing_type} onChange={e => setCreateForm(f => ({ ...f, pricing_type: e.target.value }))}>
                      <option value="fixed">Fixed Price</option>
                      <option value="hourly">Hourly Rate</option>
                    </select>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Base Price ($)</label>
                    <input type="number" min="0" step="0.01" value={createForm.base_price} onChange={e => setCreateForm(f => ({ ...f, base_price: e.target.value }))} placeholder="75.00" />
                  </div>
                  <div className="form-group">
                    <label>Est. Duration (min)</label>
                    <input type="number" min="1" max="480" value={createForm.estimated_duration_minutes} onChange={e => setCreateForm(f => ({ ...f, estimated_duration_minutes: e.target.value }))} placeholder="60" />
                  </div>
                </div>
                <div className="form-group">
                  <label>Instructions for Worker</label>
                  <textarea value={createForm.instructions} onChange={e => setCreateForm(f => ({ ...f, instructions: e.target.value }))} placeholder="Check in at front desk. Wear provided vest..." rows={2} />
                </div>
                {error && <div className="form-error">{error}</div>}
                <button type="submit" className="btn-primary">Create Job</button>
              </form>
            </div>
          )}

          {jobs.length === 0 ? (
            <div className="empty-state-large">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
              <h3>No jobs yet</h3>
              <p>Create your first job to start managing field execution.</p>
              <button onClick={() => setShowCreate(true)} className="btn-primary">Create Job</button>
            </div>
          ) : (
            <div className="jobs-grid">
              {jobs.map((job: any) => (
                <a key={job.id} href={`/jobs/${job.id}`} className="job-card">
                  <div className="job-card-header">
                    <span className="status-badge" style={{ background: statusColor(job.status), color: 'white' }}>{job.status.replace('_', ' ')}</span>
                    <span className="job-priority">{job.priority}</span>
                  </div>
                  <h3 className="job-card-title">{job.title}</h3>
                  <p className="job-card-desc">{job.description || 'No description'}</p>
                  <div className="job-card-meta">
                    <span className="meta-item">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                      Store: {job.store_name || 'Unknown'}
                    </span>
                    <span className="meta-item">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                      {job.scheduled_at ? new Date(job.scheduled_at).toLocaleDateString() : 'Not scheduled'}
                    </span>
                    <span className="meta-item">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                      ${job.base_price?.toFixed(2) || (job.hourly_rate ? `$${job.hourly_rate}/hr` : '?')}
                    </span>
                  </div>
                  {job.assigned_worker_id && (
                    <div className="job-assigned">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                      Assigned
                    </div>
                  )}
                </a>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
