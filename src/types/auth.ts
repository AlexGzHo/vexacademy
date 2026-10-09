import type { Session, User } from '@supabase/supabase-js'

export type AppRole = 'student' | 'admin'

export interface Profile {
  id: string
  full_name: string
  avatar_url: string | null
  created_at: string
  updated_at: string
}

export interface UserRoleRecord {
  user_id: string
  role: AppRole
  created_at: string
}

export interface AuthContextType {
  user: User | null
  session: Session | null
  role: AppRole | null
  isPaymentReviewer: boolean
  loading: boolean
  roleLoading: boolean
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signUp: (email: string, password: string, fullName: string) => Promise<{
    error: Error | null
    needsEmailConfirmation: boolean
  }>
  signOut: () => Promise<void>
  refreshRole: () => Promise<void>
}

