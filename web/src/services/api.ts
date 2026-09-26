import type { Organization, Store, Campaign, Job, Task, JobStatus, WorkerProfile, Review } from '../types';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

async function authHeaders(): Promise<HeadersInit> {
  const token = localStorage.getItem('merchnow_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// Organizations
export async function getOrganizations(): Promise<Organization[]> {
  const res = await fetch(`${API}/organizations`, { headers: await authHeaders() });
  return res.json();
}

export async function createOrganization(data: any): Promise<Organization> {
  const res = await fetch(`${API}/organizations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...await authHeaders() },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error((await res.json()).error);
  return res.json();
}

// Stores
export async function getStores(orgId?: string): Promise<Store[]> {
  const params = new URLSearchParams();
  if (orgId) params.set('orgId', orgId);
  const res = await fetch(`${API}/stores?${params}`, { headers: await authHeaders() });
  return res.json();
}

export async function getStore(id: string): Promise<Store> {
  const res = await fetch(`${API}/stores/${id}`, { headers: await authHeaders() });
  return res.json();
}

export async function createStore(data: any): Promise<Store> {
  const res = await fetch(`${API}/stores`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...await authHeaders() },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error((await res.json()).error);
  return res.json();
}

// Campaigns
export async function getCampaigns(orgId?: string): Promise<Campaign[]> {
  const params = new URLSearchParams();
  if (orgId) params.set('orgId', orgId);
  const res = await fetch(`${API}/campaigns?${params}`, { headers: await authHeaders() });
  return res.json();
}

export async function getCampaign(id: string): Promise<Campaign> {
  const res = await fetch(`${API}/campaigns/${id}`, { headers: await authHeaders() });
  return res.json();
}

export async function createCampaign(data: any): Promise<Campaign> {
  const res = await fetch(`${API}/campaigns`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...await authHeaders() },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error((await res.json()).error);
  return res.json();
}

// Jobs
export async function getJobs(filters?: { orgId?: string; campaignId?: string; storeId?: string; status?: string }): Promise<Job[]> {
  const params = new URLSearchParams();
  if (filters) {
    if (filters.orgId) params.set('orgId', filters.orgId);
    if (filters.campaignId) params.set('campaignId', filters.campaignId);
    if (filters.storeId) params.set('storeId', filters.storeId);
    if (filters.status) params.set('status', filters.status);
  }
  const res = await fetch(`${API}/jobs?${params}`, { headers: await authHeaders() });
  return res.json();
}

export async function getJob(id: string): Promise<Job> {
  const res = await fetch(`${API}/jobs/${id}`, { headers: await authHeaders() });
  return res.json();
}

export async function createJob(data: any): Promise<Job> {
  const res = await fetch(`${API}/jobs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...await authHeaders() },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error((await res.json()).error);
  return res.json();
}

export async function updateJobStatus(jobId: string, status: JobStatus, rejectReason?: string): Promise<Job> {
  const res = await fetch(`${API}/jobs/${jobId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...await authHeaders() },
    body: JSON.stringify({ status, reject_reason: rejectReason }),
  });
  if (!res.ok) throw new Error((await res.json()).error);
  return res.json();
}

export async function assignWorker(jobId: string, workerId: string): Promise<{ success: boolean }> {
  const res = await fetch(`${API}/jobs/${jobId}/assign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...await authHeaders() },
    body: JSON.stringify({ workerId }),
  });
  if (!res.ok) throw new Error((await res.json()).error);
  return res.json();
}

export async function cancelJob(jobId: string, reason?: string): Promise<Job> {
  const res = await fetch(`${API}/jobs/${jobId}/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...await authHeaders() },
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) throw new Error((await res.json()).error);
  return res.json();
}

// Tasks
export async function getTasks(jobId: string): Promise<Task[]> {
  const res = await fetch(`${API}/tasks/job/${jobId}`, { headers: await authHeaders() });
  return res.json();
}

export async function createTask(jobId: string, data: any): Promise<Task> {
  const res = await fetch(`${API}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...await authHeaders() },
    body: JSON.stringify({ ...data, job_id: jobId }),
  });
  if (!res.ok) throw new Error((await res.json()).error);
  return res.json();
}

export async function completeTask(taskId: string, notes?: string): Promise<{ id: string; taskId: string; status: string }> {
  const res = await fetch(`${API}/tasks/complete/${taskId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...await authHeaders() },
    body: JSON.stringify({ notes }),
  });
  if (!res.ok) throw new Error((await res.json()).error);
  return res.json();
}

// Workers
export async function getWorkers(orgId?: string, filters?: { available?: boolean; skill?: string; minRating?: number }): Promise<WorkerProfile[]> {
  const params = new URLSearchParams();
  if (orgId && orgId !== 'all') params.set('orgId', orgId);
  if (filters) {
    if (filters.available) params.set('available', 'true');
    if (filters.skill) params.set('skill', filters.skill);
    if (filters.minRating) params.set('minRating', String(filters.minRating));
  }
  const res = await fetch(`${API}/workers?${params}`, { headers: await authHeaders() });
  return res.json();
}

export async function getWorker(id: string): Promise<WorkerProfile & { first_name: string; last_name: string; email: string }> {
  const res = await fetch(`${API}/workers/${id}`, { headers: await authHeaders() });
  return res.json();
}

export async function toggleWorkerAvailability(userId: string): Promise<{ is_available: boolean }> {
  const res = await fetch(`${API}/workers/${userId}/toggle-availability`, {
    method: 'POST',
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error((await res.json()).error);
  return res.json();
}

// Assignments
export async function getAssignments(filters?: { jobId?: string; workerId?: string; status?: string }): Promise<any[]> {
  const params = new URLSearchParams();
  if (filters) {
    if (filters.jobId) params.set('jobId', filters.jobId);
    if (filters.workerId) params.set('workerId', filters.workerId);
    if (filters.status) params.set('status', filters.status);
  }
  const res = await fetch(`${API}/assignments?${params}`, { headers: await authHeaders() });
  return res.json();
}

export async function createAssignment(jobId: string, workerId: string): Promise<any> {
  const res = await fetch(`${API}/assignments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...await authHeaders() },
    body: JSON.stringify({ jobId, workerId }),
  });
  if (!res.ok) throw new Error((await res.json()).error);
  return res.json();
}

export async function acceptAssignment(assignmentId: string): Promise<any> {
  const res = await fetch(`${API}/assignments/${assignmentId}/accept`, {
    method: 'POST',
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error((await res.json()).error);
  return res.json();
}

export async function declineAssignment(assignmentId: string, reason?: string): Promise<any> {
  const res = await fetch(`${API}/assignments/${assignmentId}/decline`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...await authHeaders() },
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) throw new Error((await res.json()).error);
  return res.json();
}

export async function cancelAssignment(assignmentId: string, reason?: string): Promise<any> {
  const res = await fetch(`${API}/assignments/${assignmentId}/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...await authHeaders() },
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) throw new Error((await res.json()).error);
  return res.json();
}

// Dispatch
export async function getAvailableJobs(): Promise<any[]> {
  const res = await fetch(`${API}/dispatch/available-jobs`, { headers: await authHeaders() });
  return res.json();
}

export async function getWorkerAvailability(userId: string): Promise<any> {
  const res = await fetch(`${API}/dispatch/worker-availability`, {
    headers: await authHeaders(),
    body: JSON.stringify({ userId }),
  });
  if (!res.ok) throw new Error((await res.json()).error);
  return res.json();
}

// Proof
export async function uploadProof(data: any): Promise<any> {
  const res = await fetch(`${API}/proof`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...await authHeaders() },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error((await res.json()).error);
  return res.json();
}

export async function getProof(jobId: string): Promise<any[]> {
  const res = await fetch(`${API}/proof/job/${jobId}`, { headers: await authHeaders() });
  return res.json();
}

// Check-ins
export async function checkIn(jobId: string, data: { latitude: number; longitude: number; accuracy?: number; location_note?: string }): Promise<any> {
  const res = await fetch(`${API}/checkins/job/${jobId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...await authHeaders() },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error((await res.json()).error);
  return res.json();
}

export async function getCheckIns(jobId: string): Promise<any[]> {
  const res = await fetch(`${API}/checkins/job/${jobId}`, { headers: await authHeaders() });
  return res.json();
}

// Reviews
export async function createReview(data: any): Promise<Review> {
  const res = await fetch(`${API}/reviews`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...await authHeaders() },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error((await res.json()).error);
  return res.json();
}

export async function getReviews(jobId: string): Promise<Review[]> {
  const res = await fetch(`${API}/reviews/job/${jobId}`, { headers: await authHeaders() });
  return res.json();
}

// Messages
export async function sendMessage(data: { recipient_id: string; content: string; job_id?: string }): Promise<any> {
  const res = await fetch(`${API}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...await authHeaders() },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error((await res.json()).error);
  return res.json();
}

export async function getMessages(filters?: { jobId?: string; withUserId?: string }): Promise<any[]> {
  const params = new URLSearchParams();
  if (filters) {
    if (filters.jobId) params.set('jobId', filters.jobId);
    if (filters.withUserId) params.set('withUserId', filters.withUserId);
  }
  const res = await fetch(`${API}/messages?${params}`, { headers: await authHeaders() });
  return res.json();
}

// Notifications
export async function getNotifications(): Promise<any[]> {
  const res = await fetch(`${API}/notifications`, { headers: await authHeaders() });
  return res.json();
}

export async function markNotificationRead(id: string): Promise<{ read: boolean }> {
  const res = await fetch(`${API}/notifications/${id}/read`, {
    method: 'PATCH',
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error((await res.json()).error);
  return res.json();
}

// Audit
export async function getAuditEvents(limit?: number): Promise<any[]> {
  const params = new URLSearchParams();
  if (limit) params.set('limit', String(limit));
  const res = await fetch(`${API}/audit?${params}`, { headers: await authHeaders() });
  return res.json();
}

// Health
export async function healthCheck(): Promise<{ status: string; timestamp: string; version: string }> {
  const res = await fetch(`${API}/health`);
  return res.json();
}
