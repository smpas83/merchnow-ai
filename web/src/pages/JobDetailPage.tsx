import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getJob, updateJobStatus, getTasks, completeTask, getProof, getCheckIns, getReviews, createReview, getAssignments, acceptAssignment, declineAssignment, cancelAssignment, checkIn, uploadProof, sendMessage } from '../services/api';
import { z } from 'zod';
import { updateJobStatusSchema, checkinSchema, reviewSchema, proofSchema } from '../services/validations';
import type { Job, Task, ProofAsset, CheckIn, Review, JobStatus } from '../types';

export default function JobDetailPage() {
  const { user } = useAuth();
  const [job, setJob] = useState<Job | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [proof, setProof] = useState<ProofAsset[]>([]);
  const [checkins, setCheckins] = useState<CheckIn[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'details' | 'tasks' | 'proof' | 'checkins' | 'messages'>('details');
  const [showCheckin, setShowCheckin] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [showProof, setShowProof] = useState(false);
  const [checkinForm, setCheckinForm] = useState({ latitude: 37.78, longitude: -122.41, accuracy: 50, location_note: '' });
  const [reviewForm, setReviewForm] = useState({ reviewee_id: '', rating: 5, comment: '', category: 'worker' });
  const [proofForm, setProofForm] = useState({ task_id: '', caption: '', type: 'photo' as const });

  const jobId = typeof window !== 'undefined' ? window.location.pathname.split('/').pop() || '' : '';

  useEffect(() => {
    if (!user || !jobId) return;
    const load = async () => {
      try {
        const [jobRes, taskRes, proofRes, checkinRes, reviewRes, assignRes] = await Promise.all([
          getJob(jobId),
          getTasks(jobId),
          getProof(jobId),
          getCheckIns(jobId),
          getReviews(jobId),
          getAssignments({ jobId }),
        ]);
        setJob(jobRes);
        setTasks(taskRes);
        setProof(proofRes);
        setCheckins(checkinRes);
        setReviews(reviewRes);
        setAssignments(assignRes);
      } catch (e: any) { setError(e.message || 'Failed to load job'); }
      finally { setLoading(false); }
    };
    load();
  }, [user, jobId]);

  const updateStatus = async (status: JobStatus, rejectReason?: string) => {
    try {
      const updated = await updateJobStatus(jobId, status, rejectReason);
      setJob(updated);
    } catch (e: any) { setError(e.message || 'Failed to update status'); }
  };

  const handleCheckin = async () => {
    try {
      const parsed = checkinSchema.safeParse(checkinForm);
      if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
      const result = await checkIn(jobId, parsed.data);
      setCheckins(prev => [result, ...prev]);
      setShowCheckin(false);
      setJob(prev => prev ? { ...prev, status: result.status } : null);
    } catch (e: any) { setError(e.message || 'Check-in failed'); }
  };

  const handleReview = async () => {
    try {
      const parsed = reviewSchema.safeParse({ ...reviewForm, reviewee_id: reviewForm.reviewee_id || job?.assigned_worker_id || '' });
      if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
      const result = await createReview(parsed.data);
      setReviews(prev => [result, ...prev]);
      setShowReview(false);
    } catch (e: any) { setError(e.message || 'Review submission failed'); }
  };

  const handleProof = async () => {
    try {
      const parsed = proofSchema.safeParse({ ...proofForm, job_id: jobId });
      if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
      const result = await uploadProof(parsed.data);
      setProof(prev => [result, ...prev]);
      setShowProof(false);
    } catch (e: any) { setError(e.message || 'Proof upload failed'); }
  };

  const handleAccept = async (assignmentId: string) => {
    try {
      await acceptAssignment(assignmentId);
      const updated = await getAssignments({ jobId });
      setAssignments(updated);
      const jobUpdated = await getJob(jobId);
      setJob(jobUpdated);
    } catch (e: any) { setError(e.message || 'Accept failed'); }
  };

  const handleDecline = async (assignmentId: string, reason: string) => {
    try {
      await declineAssignment(assignmentId, reason);
      const updated = await getAssignments({ jobId });
      setAssignments(updated);
    } catch (e: any) { setError(e.message || 'Decline failed'); }
  };

  if (loading) return <div className="loading-center"><div className="spinner" /></div>;
  if (!job) return <div className="page"><div className="empty-state-large"><h3>Job not found</h3></div></div>;

  const worker = assignments.find((a: any) => a.status === 'accepted')?.worker;

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title-row">
          <h1>{job.title}</h1>
          <span className="status-badge" style={{ background: job.status.includes('_') ? 'var(--color-warning)' : 'var(--color-success)', color: 'white', padding: '4px 12px', borderRadius: '20px' }}>
            {job.status.replace('_', ' ')}
          </span>
        </div>
        <div className="job-actions">
          {job.status === 'created' && user?.role === 'customer' && (
            <button onClick={() => updateStatus('scheduled')} className="btn-secondary">Schedule</button>
          )}
          {job.status === 'scheduled' && user?.role === 'customer' && (
            <button onClick={() => updateStatus('assigned')} className="btn-secondary">Assign Worker</button>
          )}
          {job.status === 'assigned' && user?.role === 'worker' && !assignments.find((a: any) => a.worker_id === user?.id) && (
            <button onClick={() => {
              const newAssign = assignments.find((a: any) => a.status === 'pending' && a.job_id === jobId);
              if (newAssign) handleAccept(newAssign.id);
            }} className="btn-primary">Accept Job</button>
          )}
          {job.status === 'assigned' && user?.role === 'worker' && assignments.find((a: any) => a.worker_id === user?.id && a.status === 'pending') && (
            <button onClick={() => {
              const a = assignments.find((a: any) => a.worker_id === user?.id && a.status === 'pending');
              if (a) handleDecline(a.id, 'Other');
            }} className="btn-secondary">Decline</button>
          )}
          {['accepted', 'en_route', 'checked_in'].includes(job.status) && user?.role === 'worker' && (
            <button onClick={() => setShowCheckin(!showCheckin)} className="btn-primary">Check In</button>
          )}
          {['checked_in', 'in_progress'].includes(job.status) && user?.role === 'worker' && (
            <button onClick={() => updateStatus('submitted')} className="btn-primary">Submit Work</button>
          )}
          {['in_progress', 'submitted'].includes(job.status) && checkins.length === 0 && user?.role === 'worker' && (
            <button onClick={() => setShowCheckin(true)} className="btn-secondary">Add Check-in</button>
          )}
          {job.status === 'submitted' && user?.role === 'customer' && (
            <button onClick={() => updateStatus('under_review')} className="btn-secondary">Start Review</button>
          )}
          {['under_review', 'submitted'].includes(job.status) && user?.role === 'customer' && (
            <button onClick={() => updateStatus('completed')} className="btn-primary">Approve & Complete</button>
          )}
          {['under_review', 'submitted'].includes(job.status) && user?.role === 'customer' && (
            <button onClick={() => updateStatus('rework_required')} className="btn-secondary">Request Rework</button>
          )}
          {['assigned', 'accepted', 'en_route', 'checked_in', 'in_progress', 'submitted'].includes(job.status) && (
            <button onClick={() => updateStatus('cancelled')} className="btn-danger">Cancel Job</button>
          )}
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="job-detail-grid">
        <div className="job-info-card">
          <div className="info-section">
            <h3>Overview</h3>
            <div className="info-grid">
              <div className="info-item">
                <label>Description</label>
                <p>{job.description || 'No description'}</p>
              </div>
              <div className="info-item">
                <label>Scope of Work</label>
                <p>{job.scope_of_work || 'Not specified'}</p>
              </div>
              <div className="info-item">
                <label>Instructions</label>
                <p>{job.instructions || 'No instructions'}</p>
              </div>
              <div className="info-item">
                <label>Requirements</label>
                <p>{job.requirements || 'None'}</p>
              </div>
              <div className="info-item">
                <label>Pricing</label>
                <p>{job.pricing_type === 'fixed' ? `$${job.base_price?.toFixed(2) || '0.00'}` : `$${job.hourly_rate?.toFixed(2) || '0.00'}/hr`}</p>
              </div>
              <div className="info-item">
                <label>Status</label>
                <p>{job.status.replace('_', ' ')}</p>
              </div>
              <div className="info-item">
                <label>Priority</label>
                <p>{job.priority}</p>
              </div>
              <div className="info-item">
                <label>Scheduled</label>
                <p>{job.scheduled_at ? new Date(job.scheduled_at).toLocaleString() : 'Not scheduled'}</p>
              </div>
            </div>
          </div>
          {worker && (
            <div className="info-section">
              <h3>Assigned Worker</h3>
              <div className="worker-mini-card">
                <div className="worker-avatar">{worker.first_name?.charAt(0)}{worker.last_name?.charAt(0)}</div>
                <div>
                  <p>{worker.first_name} {worker.last_name}</p>
                  <p className="text-muted">{worker.email}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="job-sidebar">
          <div className="card">
            <div className="card-header"><h3>Store</h3></div>
            <div className="card-body">
              <p>{job.store_name || 'Unknown store'}</p>
              {job.store_address && <p className="text-muted">{job.store_address}</p>}
            </div>
          </div>
          <div className="card">
            <div className="card-header"><h3>Timeline</h3></div>
            <div className="card-body">
              <div className="timeline-item"><span>Created</span><small>{new Date(job.created_at).toLocaleString()}</small></div>
              {job.scheduled_at && <div className="timeline-item"><span>Scheduled</span><small>{new Date(job.scheduled_at).toLocaleString()}</small></div>}
              {job.assigned_worker_id && <div className="timeline-item"><span>Assigned</span><small>{new Date(job.updated_at).toLocaleString()}</small></div>}
              {job.completed_at && <div className="timeline-item"><span>Completed</span><small>{new Date(job.completed_at).toLocaleString()}</small></div>}
            </div>
          </div>
        </div>
      </div>

      <div className="job-tabs">
        <button className={`tab-btn ${activeTab === 'details' ? 'active' : ''}`} onClick={() => setActiveTab('details')}>Details</button>
        <button className={`tab-btn ${activeTab === 'tasks' ? 'active' : ''}`} onClick={() => setActiveTab('tasks')}>Tasks ({tasks.length})</button>
        <button className={`tab-btn ${activeTab === 'proof' ? 'active' : ''}`} onClick={() => setActiveTab('proof')}>Proof ({proof.length})</button>
        <button className={`tab-btn ${activeTab === 'checkins' ? 'active' : ''}`} onClick={() => setActiveTab('checkins')}>Check-ins ({checkins.length})</button>
        <button className={`tab-btn ${activeTab === 'messages' ? 'active' : ''}`} onClick={() => setActiveTab('messages')}>Messages</button>
      </div>

      <div className="tab-content">
        {activeTab === 'details' && (
          <div className="card">
            <div className="card-body">
              <h3 className="section-title">Job Description</h3>
              <p>{job.description || 'No description provided.'}</p>
              <h3 className="section-title">Scope of Work</h3>
              <p>{job.scope_of_work || 'Not specified.'}</p>
              <h3 className="section-title">Instructions for Worker</h3>
              <p>{job.instructions || 'No instructions.'}</p>
              <h3 className="section-title">Requirements</h3>
              <p>{job.requirements || 'None specified.'}</p>
            </div>
          </div>
        )}

        {activeTab === 'tasks' && (
          <div className="card">
            <div className="card-header"><h3>Task Checklist</h3></div>
            <div className="card-body">
              {tasks.length === 0 ? <p className="text-muted">No tasks defined.</p> : (
                <div className="task-list">
                  {tasks.map((t: any) => (
                    <div key={t.id} className="task-item">
                      <div className="task-checkbox">
                        <div className="checkbox" onClick={() => t.is_required && completeTask(t.id)}>
                          {t.is_required ? '✓' : ''}
                        </div>
                      </div>
                      <div className="task-info">
                        <div className="task-title">{t.title}</div>
                        <div className="task-desc">{t.description || 'No description'}</div>
                        <div className="task-meta">
                          <span className="task-category">{t.category}</span>
                          {t.proof_type && <span className="proof-type-badge">Proof: {t.proof_type}</span>}
                          {t.is_required ? <span className="required-badge">Required</span> : <span className="optional-badge">Optional</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'proof' && (
          <div className="card">
            <div className="card-header">
              <h3>Proof of Work</h3>
              <button onClick={() => setShowProof(true)} className="btn-secondary btn-sm">+ Upload Proof</button>
            </div>
            <div className="card-body">
              {showProof && (
                <div className="form-card">
                  <div className="form-group">
                    <label>Task (optional)</label>
                    <select value={proofForm.task_id} onChange={e => setProofForm(f => ({ ...f, task_id: e.target.value }))}>
                      <option value="">None</option>
                      {tasks.map((t: any) => <option key={t.id} value={t.id}>{t.title}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Caption</label>
                    <input type="text" value={proofForm.caption} onChange={e => setProofForm(f => ({ ...f, caption: e.target.value }))} placeholder="Describe the proof..." />
                  </div>
                  <div className="form-group">
                    <label>Type</label>
                    <select value={proofForm.type} onChange={e => setProofForm(f => ({ ...f, type: e.target.value as any }))}>
                      <option value="photo">Photo</option>
                      <option value="video">Video</option>
                      <option value="notes">Notes</option>
                    </select>
                  </div>
                  {error && <div className="form-error">{error}</div>}
                  <button onClick={handleProof} className="btn-primary">Upload Proof</button>
                </div>
              )}
              {proof.length === 0 ? <p className="text-muted">No proof uploaded yet.</p> : (
                <div className="proof-grid">
                  {proof.map((p: any) => (
                    <div key={p.id} className="proof-item">
                      <div className="proof-icon">
                        {p.type === 'photo' ? '📷' : p.type === 'video' ? '🎬' : '📝'}
                      </div>
                      <div className="proof-info">
                        <div className="proof-caption">{p.caption || 'No caption'}</div>
                        <div className="proof-meta">
                          <span>{p.type}</span>
                          <span>{new Date(p.uploaded_at).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'checkins' && (
          <div className="card">
            <div className="card-header">
              <h3>Check-ins</h3>
              <button onClick={() => setShowCheckin(true)} className="btn-secondary btn-sm">+ Add Check-in</button>
            </div>
            <div className="card-body">
              {showCheckin && (
                <div className="form-card">
                  <p className="text-muted">Simulated check-in at demo coordinates (San Francisco).</p>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Latitude</label>
                      <input type="number" step="0.0001" value={checkinForm.latitude} onChange={e => setCheckinForm(f => ({ ...f, latitude: parseFloat(e.target.value) }))} />
                    </div>
                    <div className="form-group">
                      <label>Longitude</label>
                      <input type="number" step="0.0001" value={checkinForm.longitude} onChange={e => setCheckinForm(f => ({ ...f, longitude: parseFloat(e.target.value) }))} />
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Accuracy (meters)</label>
                    <input type="number" value={checkinForm.accuracy} onChange={e => setCheckinForm(f => ({ ...f, accuracy: parseFloat(e.target.value) }))} />
                  </div>
                  <div className="form-group">
                    <label>Location Note</label>
                    <input type="text" value={checkinForm.location_note} onChange={e => setCheckinForm(f => ({ ...f, location_note: e.target.value }))} placeholder="Aisle 3, Shelf 4" />
                  </div>
                  {error && <div className="form-error">{error}</div>}
                  <button onClick={handleCheckin} className="btn-primary">Check In</button>
                </div>
              )}
              {checkins.length === 0 ? <p className="text-muted">No check-ins recorded.</p> : (
                <div className="checkin-list">
                  {checkins.map((c: any) => (
                    <div key={c.id} className="checkin-item">
                      <div className="checkin-icon">📍</div>
                      <div className="checkin-info">
                        <div className="checkin-coords">Lat: {c.latitude?.toFixed(4)}, Lng: {c.longitude?.toFixed(4)}</div>
                        <div className="checkin-meta">
                          {c.accuracy && <span>Accuracy: ±{c.accuracy} m</span>}
                          {c.location_note && <span>{c.location_note}</span>}
                          <span>{new Date(c.created_at).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'messages' && (
          <div className="card">
            <div className="card-header"><h3>Job Messages</h3></div>
            <div className="card-body">
              <p className="text-muted">Message functionality is available via the API. Use the dispatch and messaging endpoints to communicate.</p>
              {reviews.length > 0 && (
                <div className="reviews-section">
                  <h3 className="section-title">Reviews</h3>
                  {reviews.map((r: any) => (
                    <div key={r.id} className="review-item">
                      <div className="review-header">
                        <span className="review-rating">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
                        <span className="review-category">{r.category}</span>
                        <span className="review-date">{new Date(r.created_at).toLocaleDateString()}</span>
                      </div>
                      {r.comment && <p className="review-comment">{r.comment}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {job.status === 'submitted' || job.status === 'under_review' ? (
        <div className={`review-card ${showReview ? 'open' : ''}`}>
          <div className="review-card-header">
            <h3>Submit Review</h3>
            <button onClick={() => setShowReview(false)} className="close-btn">×</button>
          </div>
          <div className="review-card-body">
            <div className="form-group">
              <label>Review For</label>
              <select value={reviewForm.reviewee_id} onChange={e => setReviewForm(f => ({ ...f, reviewee_id: e.target.value }))}>
                <option value="">Select...</option>
                {worker && <option value={worker.user_id}>{worker.first_name} {worker.last_name} (Worker)</option>}
              </select>
            </div>
            <div className="form-group">
              <label>Rating</label>
              <div className="star-rating">
                {[1,2,3,4,5].map(i => (
                  <button key={i} onClick={() => setReviewForm(f => ({ ...f, rating: i }))} className={`star-btn ${i <= reviewForm.rating ? 'filled' : ''}`}>★</button>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label>Comment</label>
              <textarea value={reviewForm.comment} onChange={e => setReviewForm(f => ({ ...f, comment: e.target.value }))} placeholder="Share your feedback..." rows={3} />
            </div>
            <div className="form-group">
              <label>Category</label>
              <select value={reviewForm.category} onChange={e => setReviewForm(f => ({ ...f, category: e.target.value as any }))}>
                <option value="worker">Worker Performance</option>
                <option value="customer">Customer</option>
                <option value="general">General</option>
              </select>
            </div>
            {error && <div className="form-error">{error}</div>}
            <button onClick={handleReview} className="btn-primary">Submit Review</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
