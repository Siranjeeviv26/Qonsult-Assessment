import axios from 'axios';

export const api = axios.create({ baseURL: '/api', timeout: 15000 });

api.interceptors.request.use((cfg) => {
  const t = localStorage.getItem('token');
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401 && !err.config.url.includes('/auth/login')) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// Turn any error into { message, fields: {field: message} }
export function parseError(err) {
  if (!err.response) return { message: 'Cannot reach the server. Check your connection and try again.', fields: {} };
  const d = err.response.data;
  const fields = {};
  (d?.errors || []).forEach((e) => { fields[e.field] = e.message; });
  // A 5xx without a JSON message means the API itself was unreachable (e.g. the
  // dev proxy returned an error page), not that the request was rejected.
  const fallback = err.response.status >= 500
    ? 'The API server is not responding. Make sure the backend is running (npm run dev in /server).'
    : 'Something went wrong. Please try again.';
  return { message: d?.message || fallback, fields };
}
