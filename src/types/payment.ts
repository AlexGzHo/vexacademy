import type { Course } from './lms.ts'
import type { Profile } from './auth.ts'

export type PaymentMethod = 'yape' | 'plin'
export type PaymentStatus = 'pending' | 'approved' | 'rejected'

export interface PaymentRequest {
  id: string
  user_id: string
  course_id: string
  payment_method: PaymentMethod
  amount_pen: number
  proof_url: string
  status: PaymentStatus
  rejection_reason?: string | null
  reviewer_id?: string | null
  processed_at?: string | null
  created_at: string
  updated_at: string

  // Joins opcionales para UI
  course?: Course
  profile?: Profile
  reviewer?: Profile
}

export interface PaymentReviewer {
  user_id: string
  assigned_by?: string | null
  created_at: string
  profile?: Profile
}

