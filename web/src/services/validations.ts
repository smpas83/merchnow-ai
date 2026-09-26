import { string, object, optional, z } from 'zod';

export const loginSchema = object({
  email: string().email('Invalid email address'),
  password: string().min(1, 'Password is required'),
});

export const registerSchema = object({
  email: string().email('Invalid email address'),
  password: string().min(6, 'Password must be at least 6 characters'),
  first_name: string().min(1, 'First name is required'),
  last_name: string().min(1, 'Last name is required'),
  role: z.enum(['customer', 'worker', 'admin']),
  phone: optional(string()),
});

export const createOrganizationSchema = object({
  name: string().min(1, 'Name is required'),
  type: z.enum(['customer', 'brand', 'retailer']),
  website: optional(string().url('Invalid URL')),
  industry: optional(string()),
});

export const createStoreSchema = object({
  name: string().min(1, 'Store name is required'),
  address: optional(string()),
  city: optional(string()),
  state: optional(string()),
  zip: optional(string()),
  latitude: optional(z.number()),
  longitude: optional(z.number()),
  manager_name: optional(string()),
  manager_phone: optional(string()),
  instructions: optional(string()),
});

export const createCampaignSchema = object({
  name: string().min(1, 'Campaign name is required'),
  description: optional(string()),
  start_date: optional(string()),
  end_date: optional(string()),
});

export const createJobSchema = object({
  campaign_id: optional(string()),
  store_id: string().min(1, 'Store is required'),
  title: string().min(1, 'Job title is required'),
  description: optional(string()),
  scope_of_work: optional(string()),
  instructions: optional(string()),
  requirements: optional(string()),
  scheduled_at: optional(string()),
  priority: z.enum(['low', 'normal', 'high', 'urgent']),
  pricing_type: z.enum(['fixed', 'hourly']),
  base_price: optional(z.number().min(0)),
  hourly_rate: optional(z.number().min(0)),
  estimated_duration_minutes: optional(z.number().min(1).max(480)),
});

export const createTaskSchema = object({
  order_index: z.number().min(0).max(999),
  title: string().min(1, 'Task title is required'),
  description: optional(string()),
  category: optional(z.enum(['check_in', 'execution', 'verification', 'photo', 'notes', 'check_out'])),
  is_required: optional(z.enum(['0', '1']).default('1')),
  proof_type: optional(z.enum(['location', 'photo', 'video', 'notes', 'none'])),
});

export const updateJobStatusSchema = object({
  status: z.enum([
    'created', 'scheduled', 'assigned', 'accepted', 'en_route',
    'checked_in', 'in_progress', 'submitted', 'under_review', 'completed',
    'cancelled', 'no_show', 'rework_required', 'disputed'
  ]),
  reject_reason: optional(string()),
});

export const createMessageSchema = object({
  recipient_id: string().min(1, 'Recipient is required'),
  content: string().min(1, 'Message content is required'),
  job_id: optional(string()),
});

export const checkinSchema = object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: optional(z.number().min(0)),
  location_note: optional(string()),
});

export const reviewSchema = object({
  reviewee_id: string().min(1, 'Reviewee is required'),
  rating: z.number().min(1).max(5),
  comment: optional(string()),
  category: z.enum(['worker', 'customer', 'general']),
});

export const proofSchema = object({
  job_id: string().min(1, 'Job is required'),
  task_id: optional(string()),
  type: z.enum(['photo', 'video', 'notes']).default('photo'),
  caption: optional(string()),
  latitude: optional(z.number()),
  longitude: optional(z.number()),
});
