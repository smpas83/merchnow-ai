// Shared types for MerchNow mobile app
export interface User {
  id: string; email: string; first_name: string; last_name: string;
  role: 'customer' | 'worker' | 'admin'; phone?: string; status?: string;
  organization_id?: string; created_at: string; updated_at?: string;
}
export interface Store {
  id: string; organization_id: string; name: string; address?: string;
  city?: string; state?: string; zip?: string; latitude?: number;
  longitude?: number; manager_name?: string; manager_phone?: string;
  description?: string; instructions?: string; status?: string;
  created_at: string; updated_at?: string;
}
export interface Job {
  id: string; organization_id: string; store_id: string; title: string;
  description?: string; scope_of_work?: string; instructions?: string;
  requirements?: string; scheduled_at?: string; status: string;
  priority: string; pricing_type: string; base_price?: number;
  hourly_rate?: number; estimated_duration_minutes?: number;
  created_by?: string; assigned_worker_id?: string; reject_reason?: string;
  rework_count?: number; completed_at?: string; cancelled_at?: string;
  no_show_at?: string; created_at: string; updated_at?: string;
}
export interface Task {
  id: string; job_id: string; order_index: number; title: string;
  description?: string; category?: string; is_required: number;
  proof_type?: string; created_at: string; updated_at?: string;
}
export interface WorkerProfile {
  id: string; user_id: string; hourly_rate?: number; is_available?: number;
  experience_years?: number; availability?: string; skills?: string;
  certifications?: string; bio?: string; service_territory?: string;
  travel_radius_miles?: number; total_jobs_completed?: number;
  avg_rating?: number; location_note?: string; avatar_url?: string;
  created_at: string; updated_at?: string;
}
