import { Routes, Route, Navigate, Link } from 'react-router-dom';
import { useAuth, Protected } from './auth.jsx';
import Login from './pages/Login.jsx';
import StudentList from './pages/StudentList.jsx';
import StudentForm from './pages/StudentForm.jsx';
import ClassSections from './pages/ClassSections.jsx';

export default function App() {
  const { user, logout } = useAuth();
  return (
    <>
      {user && (
        <header className="topbar">
          <Link to="/students" className="brand">Student Management</Link>
          <span className="spacer" />
          <span className="muted">{user.username} ({user.role})</span>
          <button className="btn ghost" onClick={logout}>Log out</button>
        </header>
      )}
      <main className="container">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/students" element={<Protected adminOnly><StudentList /></Protected>} />
          <Route path="/students/new" element={<Protected adminOnly><StudentForm /></Protected>} />
          <Route path="/students/:id" element={<Protected><StudentForm /></Protected>} />
          <Route path="/class-sections" element={<Protected adminOnly><ClassSections /></Protected>} />
          <Route path="*" element={<Navigate to="/students" replace />} />
        </Routes>
      </main>
    </>
  );
}
