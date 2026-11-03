import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { parseError } from '../api.js';

export default function Login() {
  const { user, login } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({ identifier: '', password: '' });
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState('');
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/students" replace />;

  const submit = async (e) => {
    e.preventDefault();
    if (loading) return;
    const errs = {};
    if (!form.identifier.trim()) errs.identifier = 'Username or email is required';
    if (!form.password) errs.password = 'Password is required';
    setErrors(errs);
    setApiError('');
    if (Object.keys(errs).length) return;
    setLoading(true);
    try {
      const u = await login(form.identifier.trim(), form.password);
      nav(u.role === 'admin' ? '/students' : `/students/${u.studentRef}`, { replace: true });
    } catch (err) {
      setApiError(parseError(err).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="card login" onSubmit={submit} noValidate>
      <h1>Sign in</h1>
      {apiError && <div className="alert error" role="alert">{apiError}</div>}
      <label>Username or email
        <input value={form.identifier} onChange={(e) => setForm({ ...form, identifier: e.target.value })} autoComplete="username" />
        {errors.identifier && <span className="err">{errors.identifier}</span>}
      </label>
      <label>Password
        <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} autoComplete="current-password" />
        {errors.password && <span className="err">{errors.password}</span>}
      </label>
      <button className="btn primary" disabled={loading}>{loading ? 'Signing in…' : 'Sign in'}</button>
    </form>
  );
}
