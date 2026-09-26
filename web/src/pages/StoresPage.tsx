import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getStores, createStore, getOrganizations } from '../services/api';
import { z } from 'zod';
import { createStoreSchema } from '../services/validations';
import type { Store, Organization } from '../types';

export default function StoresPage() {
  const { user } = useAuth();
  const [stores, setStores] = useState<Store[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    organization_id: '', name: '', address: '', city: '', state: '', zip: '',
    latitude: '', longitude: '', manager_name: '', manager_phone: '', instructions: '', description: '',
  });
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        const [storeRes, orgRes] = await Promise.all([getStores(), getOrganizations()]);
        setStores(storeRes);
        setOrganizations(orgRes);
      } catch (e: any) { setError(e.message || 'Failed to load stores'); }
      finally { setLoading(false); }
    };
    load();
  }, [user]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const parsed = createStoreSchema.safeParse({ ...createForm, latitude: createForm.latitude ? parseFloat(createForm.latitude) : undefined, longitude: createForm.longitude ? parseFloat(createForm.longitude) : undefined });
      if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
      const store = await createStore(parsed.data);
      setStores(prev => [...prev, store]);
      setShowCreate(false);
      setCreateForm({
        organization_id: '', name: '', address: '', city: '', state: '', zip: '',
        latitude: '', longitude: '', manager_name: '', manager_phone: '', instructions: '', description: '',
      });
    } catch (e: any) { setError(e.message || 'Failed to create store'); }
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>Stores</h1>
        <button onClick={() => setShowCreate(!showCreate)} className="btn-primary">
          {showCreate ? 'Cancel' : '+ Add Store'}
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <div className="loading-center"><div className="spinner" /></div>
      ) : (
        <>
          {showCreate && (
            <div className="card create-store-card">
              <div className="card-header"><h2>New Store</h2></div>
              <form onSubmit={handleCreate} className="form-card">
                <div className="form-group">
                  <label>Organization</label>
                  <select value={createForm.organization_id} onChange={e => setCreateForm(f => ({ ...f, organization_id: e.target.value }))}>
                    <option value="">Select organization</option>
                    {organizations.map((o: any) => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Store Name *</label>
                  <input type="text" value={createForm.name} onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))} placeholder="Downtown Branch" required />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Address</label>
                    <input type="text" value={createForm.address} onChange={e => setCreateForm(f => ({ ...f, address: e.target.value }))} placeholder="123 Main St" />
                  </div>
                  <div className="form-group">
                    <label>City</label>
                    <input type="text" value={createForm.city} onChange={e => setCreateForm(f => ({ ...f, city: e.target.value }))} placeholder="San Francisco" />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>State</label>
                    <input type="text" value={createForm.state} onChange={e => setCreateForm(f => ({ ...f, state: e.target.value }))} placeholder="CA" />
                  </div>
                  <div className="form-group">
                    <label>ZIP</label>
                    <input type="text" value={createForm.zip} onChange={e => setCreateForm(f => ({ ...f, zip: e.target.value }))} placeholder="94102" />
                  </div>
                </div>
                <div className="form-group">
                  <label>Store Instructions</label>
                  <textarea value={createForm.instructions} onChange={e => setCreateForm(f => ({ ...f, instructions: e.target.value }))} placeholder="Check in at main desk. Stockroom is in the back..." rows={2} />
                </div>
                {error && <div className="form-error">{error}</div>}
                <button type="submit" className="btn-primary">Add Store</button>
              </form>
            </div>
          )}

          {stores.length === 0 ? (
            <div className="empty-state-large">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/></svg>
              <h3>No stores yet</h3>
              <p>Add your first store location to begin operations.</p>
              <button onClick={() => setShowCreate(true)} className="btn-primary">Add Store</button>
            </div>
          ) : (
            <div className="stores-grid">
              {stores.map((store: any) => (
                <div key={store.id} className="store-card">
                  <div className="store-card-header">
                    <h3>{store.name}</h3>
                    <span className="status-badge" style={{ background: store.status === 'active' ? 'var(--color-success)' : 'var(--color-destructive)' }}>{store.status}</span>
                  </div>
                  <p className="store-address">
                    {store.address}
                    {store.city && store.state && `, ${store.city}, ${store.state} ${store.zip}`}
                  </p>
                  {store.instructions && <p className="store-instructions">{store.instructions}</p>}
                  <div className="store-meta">
                    {store.manager_name && <span className="meta-item">👤 {store.manager_name}</span>}
                    {store.organization_name && <span className="meta-item">🏢 {store.organization_name}</span>}
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
