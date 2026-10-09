import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout.tsx'
import { ProtectedRoute } from './components/ProtectedRoute.tsx'
import { AuthProvider } from './context/AuthContext.tsx'
import { NotificationsProvider } from './hooks/useRealTimeNotifications.ts'
import { DashboardPage } from './pages/DashboardPage.tsx'
import { HomePage } from './pages/HomePage.tsx'
import { AdminPage } from './pages/admin/AdminPage.tsx'
import { ConfirmPage } from './pages/auth/ConfirmPage.tsx'
import { LoginPage } from './pages/auth/LoginPage.tsx'
import { SignupPage } from './pages/auth/SignupPage.tsx'
import { CoursesPage } from './pages/courses/CoursesPage.tsx'
import { CourseDetailPage } from './pages/courses/CourseDetailPage.tsx'
import { LessonPlayerPage } from './pages/courses/LessonPlayerPage.tsx'
import { NotFoundPage } from './pages/NotFoundPage.tsx'
import { StudentPage } from './pages/student/StudentPage.tsx'

export default function App() {
  return (
    <AuthProvider>
      <NotificationsProvider>
        <BrowserRouter basename={import.meta.env.BASE_URL}>
          <Routes>
            <Route path="/" element={<Layout />}>
              {/* Rutas Públicas */}
              <Route index element={<HomePage />} />
              <Route path="courses" element={<CoursesPage />} />
              <Route path="courses/:courseId" element={<CourseDetailPage />} />
              <Route
                path="courses/:courseId/lessons/:lessonId"
                element={<LessonPlayerPage />}
              />
              <Route path="auth/login" element={<LoginPage />} />
              <Route path="auth/signup" element={<SignupPage />} />
              <Route path="auth/confirm" element={<ConfirmPage />} />

              {/* Rutas Protegidas */}
              <Route
                path="dashboard"
                element={
                  <ProtectedRoute>
                    <DashboardPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="student"
                element={
                  <ProtectedRoute>
                    <StudentPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="admin"
                element={
                  <ProtectedRoute allowedRoles={['admin']} allowReviewer={true}>
                    <AdminPage />
                  </ProtectedRoute>
                }
              />

              {/* Fallback 404 */}
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </NotificationsProvider>
    </AuthProvider>
  )
}
