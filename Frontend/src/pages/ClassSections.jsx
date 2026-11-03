import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, parseError } from '../api.js';

const empty = { gradeName: '', sectionName: '', description: '', status: 'Active' };

export default function ClassSections() {
  const nav = useNavigate();
  const [items, setItems] = useState([]);
  const [values, setValues] = useState(empty);
  const [editingId, setEditingId] = useState(null);
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/class-sections', { params: { status: 'all' } });
      setItems(data.data);
    } catch (err) {
      setApiError(parseError(err).message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const set = (k) => (e) => setValues((v) => ({ ...v, [k]: e.target.value }));

  const cancel = () => nav('/students');

  const startEdit = (c) => {
    setEditingId(c._id);
    setValues({ gradeName: c.gradeName, sectionName: c.sectionName, description: c.description || '', status: c.status });
    setErrors({});
    setApiError('');
    setNotice('');
  };

  const validate = () => {
    const e = {};
    if (!values.gradeName.trim()) e.gradeName = 'Class/Grade is required';
    if (!values.sectionName.trim()) e.sectionName = 'Section is required';
    return e;
  };

  const submit = async (e) => {
    e.preventDefault();
    if (saving) return;
    const errs = validate();
    setErrors(errs);
    setApiError('');
    if (Object.keys(errs).length) return;
    setSaving(true);
    try {
      const payload = {
        gradeName: values.gradeName.trim(),
        sectionName: values.sectionName.trim(),
        description: values.description.trim(),
        status: values.status,
      };
      if (editingId) {
        await api.put(`/class-sections/${editingId}`, payload);
        setNotice('Class/section updated successfully');
      } else {
        await api.post('/class-sections', payload);
        setNotice('Class/section created successfully');
      }
      setValues(empty);
      setEditingId(null);
      load();
    } catch (err) {
      const { message, fields } = parseError(err);
      setApiError(message);
      setErrors(fields);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="row"><h1>Class sections</h1></div>

      {notice && <div className="alert success" role="status" onClick={() => setNotice('')}>{notice}</div>}
      {apiError && <div className="alert error" role="alert">{apiError}</div>}

      <form className="card form" onSubmit={submit} noValidate>
        <h2>{editingId ? 'Edit class/section' : 'Add class/section'}</h2>
        <div className="grid">
          <label>Class / Grade
            <input value={values.gradeName} onChange={set('gradeName')} maxLength={50} placeholder="e.g. Grade 1" />
            {errors.gradeName && <span className="err">{errors.gradeName}</span>}
          </label>
          <label>Section
            <input value={values.sectionName} onChange={set('sectionName')} maxLength={50} placeholder="e.g. A" />
            {errors.sectionName && <span className="err">{errors.sectionName}</span>}
          </label>
          <label>Description
            <input value={values.description} onChange={set('description')} maxLength={250} />
            {errors.description && <span className="err">{errors.description}</span>}
          </label>
          <label>Status
            <select value={values.status} onChange={set('status')}>
              <option>Active</option>
              <option>Inactive</option>
            </select>
          </label>
        </div>
        <div className="row">
          <button className="btn primary" disabled={saving}>{saving ? 'Saving…' : editingId ? 'Update' : 'Create'}</button>
          <button type="button" className="btn ghost" onClick={cancel} disabled={saving}>Cancel</button>
        </div>
      </form>

      <div className="card table-wrap">
        <table>
          <thead>
            <tr><th>Class / Grade</th><th>Section</th><th>Description</th><th>Status</th><th /></tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan="5" className="center muted">Loading class/sections…</td></tr>}
            {!loading && items.length === 0 && (
              <tr><td colSpan="5" className="center muted">No class/sections yet. Add one above.</td></tr>
            )}
            {!loading && items.map((c) => (
              <tr key={c._id}>
                <td>{c.gradeName}</td>
                <td>{c.sectionName}</td>
                <td>{c.description || '-'}</td>
                <td><span className={`badge ${c.status.toLowerCase()}`}>{c.status}</span></td>
                <td className="actions">
                  <button className="link" onClick={() => startEdit(c)}>Edit</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
