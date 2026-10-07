import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout.tsx'
import { HomePage } from './pages/HomePage.tsx'
import { AdminPage } from './pages/admin/AdminPage.tsx'
import { LoginPage } from './pages/auth/LoginPage.tsx'
import { CoursesPage } from './pages/courses/CoursesPage.tsx'
import { NotFoundPage } from './pages/NotFoundPage.tsx'
import { StudentPage } from './pages/student/StudentPage.tsx'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="courses" element={<CoursesPage />} />
          <Route path="student" element={<StudentPage />} />
          <Route path="admin" element={<AdminPage />} />
          <Route path="auth/login" element={<LoginPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
