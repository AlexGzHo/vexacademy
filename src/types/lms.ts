export type CourseLevel = 'Principiante' | 'Intermedio' | 'Avanzado'

export interface Course {
  id: string
  title: string
  slug: string
  description: string
  thumbnail_url: string
  level: CourseLevel
  duration: string
  price_pen: number
  is_free: boolean
  is_published: boolean
  created_at: string
  updated_at: string
  // Datos agregados opcionales
  modules_count?: number
  lessons_count?: number
  enrollments_count?: number
  is_enrolled?: boolean
  progress_percentage?: number
}

export interface Module {
  id: string
  course_id: string
  title: string
  description: string
  order_index: number
  is_published: boolean
  created_at: string
  updated_at: string
  lessons?: Lesson[]
}

export interface LessonResource {
  title: string
  url: string
}

export interface LessonContent {
  lesson_id: string
  video_url: string
  content_markdown: string
  code_snippet: string
  code_language: string
  prompt_text: string
  resources: LessonResource[]
  created_at: string
  updated_at: string
}

export interface Lesson {
  id: string
  module_id: string
  course_id: string
  title: string
  description: string
  duration_minutes: number
  order_index: number
  is_published: boolean
  is_preview: boolean
  created_at: string
  updated_at: string
  lesson_contents?: LessonContent | null
  is_completed?: boolean
}

export interface Enrollment {
  id: string
  user_id: string
  course_id: string
  status: 'active' | 'suspended' | 'cancelled'
  enrolled_at: string
  created_at: string
  updated_at: string
  course?: Course
  completed_lessons?: number
  total_lessons?: number
  progress_percentage?: number
  last_lesson_id?: string
}

export interface LessonProgress {
  id: string
  user_id: string
  lesson_id: string
  course_id: string
  is_completed: boolean
  completed_at: string | null
  created_at: string
  updated_at: string
}

