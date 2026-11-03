import { useEffect, useState, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api, parseError } from '../api.js';

const initial = { search: '', classSectionId: '', status: '', admissionFrom: '', admissionTo: '' };

export default function StudentList() {
  const location = useLocation();
  const [filters, setFilters] = useState(initial);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [rows, setRows] = useState([]);
  const [hasNext, setHasNext] = useState(false);
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(location.state?.message || '');

  useEffect(() => {
    api.get('/class-sections').then((r) => setSections(r.data.data)).catch(() => {});
  }, []);

  // debounce search typing
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(filters.search); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [filters.search]);

  const load = useCallback(async (signal) => {
    setLoading(true);
    setError('');
    try {
      const params = { sortBy, sortOrder, page, limit };
      if (debouncedSearch) params.search = debouncedSearch;
      ['classSectionId', 'status', 'admissionFrom', 'admissionTo'].forEach((k) => { if (filters[k]) params[k] = filters[k]; });
      const { data } = await api.get('/students', { params, signal });
      setRows(data.data);
      setHasNext(data.hasNext);
    } catch (err) {
      if (err.code !== 'ERR_CANCELED') setError(parseError(err).message);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, filters.classSectionId, filters.status, filters.admissionFrom, filters.admissionTo, sortBy, sortOrder, page, limit]);

  useEffect(() => {
    const c = new AbortController();
    load(c.signal);
    return () => c.abort();
  }, [load]);

  const setFilter = (k, v) => { setFilters((f) => ({ ...f, [k]: v })); if (k !== 'search') setPage(1); };
  const toggleSort = (field) => {
    if (sortBy === field) setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    else { setSortBy(field); setSortOrder('asc'); }
    setPage(1);
  };
  const arrow = (f) => (sortBy === f ? (sortOrder === 'asc' ? ' ▲' : ' ▼') : '');

  const deactivate = async (s) => {
    if (!window.confirm(`Deactivate ${s.name}? They can be reactivated by editing the student.`)) return;
    try {
      await api.delete(`/students/${s._id}`);
      setNotice('Student deactivated successfully');
      load();
    } catch (err) {
      setError(parseError(err).message);
    }
  };

  return (
    <>
      <div className="row">
        <h1>Students</h1>
        <span className="spacer" />
        <Link to="/class-sections" className="btn ghost">Class sections</Link>
        <Link to="/students/new" className="btn primary">Add student</Link>
      </div>

      {notice && <div className="alert success" role="status" onClick={() => setNotice('')}>{notice}</div>}

      <div className="card filters">
        <input placeholder="Search by name or email (starts with)" value={filters.search} onChange={(e) => setFilter('search', e.target.value)} />
        <select value={filters.classSectionId} onChange={(e) => setFilter('classSectionId', e.target.value)}>
          <option value="">All classes/sections</option>
          {sections.map((s) => <option key={s._id} value={s._id}>{s.gradeName} - {s.sectionName}</option>)}
        </select>
        <select value={filters.status} onChange={(e) => setFilter('status', e.target.value)}>
          <option value="">All statuses</option>
          <option>Active</option>
          <option>Inactive</option>
        </select>
        <label className="inline">Admitted from <input type="date" value={filters.admissionFrom} onChange={(e) => setFilter('admissionFrom', e.target.value)} /></label>
        <label className="inline">to <input type="date" value={filters.admissionTo} onChange={(e) => setFilter('admissionTo', e.target.value)} /></label>
        <button className="btn ghost" onClick={() => { setFilters(initial); setPage(1); }}>Clear</button>
      </div>

      {error && <div className="alert error" role="alert">{error} <button className="btn ghost" onClick={() => load()}>Retry</button></div>}

      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Student ID</th>
              <th className="sortable" onClick={() => toggleSort('name')}>Name{arrow('name')}</th>
              <th>Email</th>
              <th>Class</th>
              <th className="sortable" onClick={() => toggleSort('admissionDate')}>Admitted{arrow('admissionDate')}</th>
              <th className="sortable" onClick={() => toggleSort('dob')}>Date of birth{arrow('dob')}</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan="8" className="center muted">Loading students…</td></tr>}
            {!loading && !error && rows.length === 0 && (
              <tr><td colSpan="8" className="center muted">No students match these filters. Try clearing them or add a new student.</td></tr>
            )}
            {!loading && rows.map((s) => (
              <tr key={s._id}>
                <td>{s.studentId}</td>
                <td>{s.name}</td>
                <td>{s.email}</td>
                <td>{s.classSectionId ? `${s.classSectionId.gradeName} - ${s.classSectionId.sectionName}` : '-'}</td>
                <td>{s.admissionDate?.slice(0, 10)}</td>
                <td>{s.dob?.slice(0, 10)}</td>
                <td><span className={`badge ${s.status.toLowerCase()}`}>{s.status}</span></td>
                <td className="actions">
                  <Link to={`/students/${s._id}`}>View / Edit</Link>
                  {s.status === 'Active' && <button className="link danger" onClick={() => deactivate(s)}>Deactivate</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="row pager">
        <label className="inline">Rows per page
          <select value={limit} onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}>
            {[10, 20, 50, 100].map((n) => <option key={n}>{n}</option>)}
          </select>
        </label>
        <span className="spacer" />
        <button className="btn ghost" disabled={page === 1 || loading} onClick={() => setPage((p) => p - 1)}>Previous</button>
        <span>Page {page}</span>
        <button className="btn ghost" disabled={!hasNext || loading} onClick={() => setPage((p) => p + 1)}>Next</button>
      </div>
    </>
  );
}
