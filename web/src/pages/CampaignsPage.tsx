import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getCampaigns, createCampaign, getOrganizations } from '../services/api';
import { z } from 'zod';
import { createCampaignSchema } from '../services/validations';
import type { Campaign, Organization } from '../types';

export default function CampaignsPage() {
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ organization_id: '', name: '', description: '', start_date: '', end_date: '' });
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        const [campRes, orgRes] = await Promise.all([getCampaigns(), getOrganizations()]);
        setCampaigns(campRes);
        setOrganizations(orgRes);
      } catch (e: any) { setError(e.message || 'Failed to load campaigns'); }
      finally { setLoading(false); }
    };
    load();
  }, [user]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const parsed = createCampaignSchema.safeParse({ ...createForm, start_date: createForm.start_date || undefined, end_date: createForm.end_date || undefined });
      if (!parsed.success) { setError(parsed.error.errors[0].message); return; }
      const campaign = await createCampaign(parsed.data);
      setCampaigns(prev => [campaign, ...prev]);
      setShowCreate(false);
      setCreateForm({ organization_id: '', name: '', description: '', start_date: '', end_date: '' });
    } catch (e: any) { setError(e.message || 'Failed to create campaign'); }
  };

  const statusColor = (s: string) => {
    const colors: Record<string, string> = { draft: '#6B7280', active: '#10B981', completed: '#3B82F6', cancelled: '#EF4444' };
    return colors[s] || '#6B7280';
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>Campaigns</h1>
        <button onClick={() => setShowCreate(!showCreate)} className="btn-primary">
          {showCreate ? 'Cancel' : '+ New Campaign'}
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <div className="loading-center"><div className="spinner" /></div>
      ) : (
        <>
          {showCreate && (
            <div className="card create-campaign-card">
              <div className="card-header"><h2>New Campaign</h2></div>
              <form onSubmit={handleCreate} className="form-card">
                <div className="form-group">
                  <label>Name *</label>
                  <input type="text" value={createForm.name} onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))} placeholder="Summer Merchandising Push" required />
                </div>
                <div className="form-group">
                  <label>Description</label>
                  <textarea value={createForm.description} onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))} placeholder="Describe the campaign goals..." rows={3} />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Start Date</label>
                    <input type="date" value={createForm.start_date} onChange={e => setCreateForm(f => ({ ...f, start_date: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label>End Date</label>
                    <input type="date" value={createForm.end_date} onChange={e => setCreateForm(f => ({ ...f, end_date: e.target.value }))} />
                  </div>
                </div>
                {error && <div className="form-error">{error}</div>}
                <button type="submit" className="btn-primary">Create Campaign</button>
              </form>
            </div>
          )}

          {campaigns.length === 0 ? (
            <div className="empty-state-large">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
              <h3>No campaigns yet</h3>
              <p>Create a campaign to organize jobs across multiple stores.</p>
              <button onClick={() => setShowCreate(true)} className="btn-primary">New Campaign</button>
            </div>
          ) : (
            <div className="campaigns-list">
              {campaigns.map((camp: any) => (
                <div key={camp.id} className="campaign-card">
                  <div className="campaign-card-header">
                    <h3>{camp.name}</h3>
                    <span className="status-badge" style={{ background: statusColor(camp.status), color: 'white' }}>{camp.status}</span>
                  </div>
                  <p className="campaign-desc">{camp.description || 'No description'}</p>
                  <div className="campaign-meta">
                    {camp.start_date && <span>📅 {new Date(camp.start_date).toLocaleDateString()}</span>}
                    {camp.end_date && <span>📅 End: {new Date(camp.end_date).toLocaleDateString()}</span>}
                    <span className="meta-item">📊 {camp.jobs_count || 0} jobs</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
