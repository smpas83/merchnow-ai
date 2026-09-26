export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: 'customer' | 'worker' | 'admin';
  phone?: string;
  avatar_url?: string;
  status?: string;
  is_available?: number;
  created_at: string;
  updated_at: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  type: string;
  website?: string;
  industry?: string;
  logo_url?: string;
  status: string;
  owner_id?: string;
  created_at: string;
  updated_at: string;
}

export interface Store {
  id: string;
  organization_id: string;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  latitude?: number;
  longitude?: number;
  manager_name?: string;
  manager_phone?: string;
  description?: string;
  instructions?: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface Campaign {
  id: string;
  organization_id: string;
  name: string;
  description?: string;
  status: string;
  start_date?: string;
  end_date?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export type JobStatus =
  | 'created' | 'scheduled' | 'assigned' | 'accepted'
  | 'en_route' | 'checked_in' | 'in_progress' | 'submitted'
  | 'under_review' | 'completed'
  | 'cancelled' | 'no_show' | 'rework_required' | 'disputed';

export interface Job {
  id: string;
  organization_id: string;
  campaign_id?: string;
  store_id: string;
  title: string;
  description?: string;
  scope_of_work?: string;
  instructions?: string;
  requirements?: string;
  scheduled_at?: string;
  status: JobStatus;
  priority: string;
  pricing_type: string;
  base_price?: number;
  hourly_rate?: number;
  estimated_duration_minutes?: number;
  created_by?: string;
  assigned_worker_id?: string;
  reject_reason?: string;
  rework_count?: number;
  completed_at?: string;
  cancelled_at?: string;
  no_show_at?: string;
  store?: Store;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  job_id: string;
  order_index: number;
  title: string;
  description?: string;
  category?: string;
  is_required: number;
  proof_type?: string;
  created_at: string;
  updated_at: string;
}

export interface WorkerProfile {
  id: string;
  user_id: string;
  hourly_rate: number;
  is_available: number;
  skills?: string;
  certifications?: string;
  bio?: string;
  travel_radius_miles: number;
  total_jobs_completed: number;
  avg_rating?: number;
  location_note?: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

export interface Review {
  id: string;
  job_id: string;
  reviewer_id: string;
  reviewee_id: string;
  rating: number;
  comment?: string;
  category: string;
  created_at: string;
}

export interface Message {
  id: string;
  job_id?: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  sender_first?: string;
  sender_last?: string;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title?: string;
  body?: string;
  data?: string;
  read: number;
  created_at: string;
}

export interface AuditEvent {
  id: string;
  event_type: string;
  actor_id?: string;
  actor_type?: string;
  resource_type?: string;
  resource_id?: string;
  action?: string;
  metadata?: string;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

export interface CheckIn {
  id: string;
  job_id: string;
  worker_id: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  location_note?: string;
  created_at: string;
}

export interface ProofAsset {
  id: string;
  job_id: string;
  task_id?: string;
  worker_id: string;
  type: string;
  caption?: string;
  latitude?: number;
  longitude?: number;
  file_path?: string;
  file_url?: string;
  uploaded_at: string;
}

export interface AvailableJob {
  id: string;
  organization_id: string;
  campaign_id?: string;
  store_id: string;
  title: string;
  description?: string;
  store?: Store;
  address?: string;
  latitude?: number;
  longitude?: number;
  organization_name?: string;
  status: string;
  priority: string;
  base_price?: number;
  scheduled_at?: string;
  created_at: string;
}
