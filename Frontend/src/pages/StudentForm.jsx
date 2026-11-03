import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, parseError } from '../api.js';
import { useAuth } from '../auth.jsx';

const empty = { studentId: '', name: '', email: '', phone: '', classSectionId: '', admissionDate: '', dob: '', status: 'Active' };

function validate(v, isNew) {
  const e = {};
  const today = new Date().toISOString().slice(0, 10);
  if (isNew && !v.studentId.trim()) e.studentId = 'Student ID is required';
  if (!v.name.trim()) e.name = 'Student name is required';
  if (!/^\S+@\S+\.\S+$/.test(v.email.trim())) e.email = 'Enter a valid email';
  if (!/^\d{10}$/.test(v.phone.trim())) e.phone = 'Enter a valid 10-digit phone number';
  if (!v.classSectionId) e.classSectionId = 'Select a class/section';
  if (!v.dob) e.dob = 'Date of birth is required';
  else if (v.dob >= today) e.dob = 'Date of birth must be in the past';
  if (!v.admissionDate) e.admissionDate = 'Admission date is required';
  else if (v.admissionDate > today) e.admissionDate = 'Admission date cannot be in the future';
  else if (v.dob && v.admissionDate <= v.dob) e.admissionDate = 'Admission date must be after date of birth';
  return e;
}

export default function StudentForm() {
  const { id } = useParams();
  const isNew = !id;
  const nav = useNavigate();
  const { user } = useAuth();
  const readOnly = user.role !== 'admin';
  const [values, setValues] = useState(empty);
  const original = useRef(empty);
  const idemKey = useRef(crypto.randomUUID()); // one key per form session => safe against double-click/retry
  const [sections, setSections] = useState([]);
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState('');
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [cs, st] = await Promise.all([api.get('/class-sections'), isNew ? null : api.get(`/students/${id}`)]);
      setSections(cs.data.data);
      if (st) {
        const s = st.data.data;
        const v = {
          studentId: s.studentId, name: s.name, email: s.email, phone: s.phone,
          classSectionId: s.classSectionId?._id || '', admissionDate: s.admissionDate.slice(0, 10),
          dob: s.dob.slice(0, 10), status: s.status,
        };
        original.current = v;
        setValues(v);
      }
    } catch (err) {
      setApiError(parseError(err).message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  const set = (k) => (e) => setValues((v) => ({ ...v, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (saving || readOnly) return;       // blocks duplicate clicks
    const errs = validate(values, isNew);
    setErrors(errs);
    setApiError('');
    if (Object.keys(errs).length) return;
    setSaving(true);
    try {
      if (isNew) {
        await api.post('/students', { ...values, studentId: values.studentId.trim() }, { headers: { 'Idempotency-Key': idemKey.current } });
        nav('/students', { state: { message: 'Student created successfully' } });
      } else {
        // send only changed fields + their original values => no overwriting of other users' edits
        const changes = {}, base = {};
        Object.keys(values).forEach((k) => {
          if (k !== 'studentId' && values[k] !== original.current[k]) { changes[k] = values[k]; base[k] = original.current[k]; }
        });
        if (!Object.keys(changes).length) { setApiError('No changes to save.'); return; }
        await api.patch(`/students/${id}`, { changes, base });
        nav('/students', { state: { message: 'Student updated successfully' } });
      }
    } catch (err) {
      const { message, fields } = parseError(err);
      setApiError(message);
      setErrors(fields);
      if (err.response?.status === 409 && !isNew) load();  // refresh to latest data on conflict
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="muted">Loading student…</p>;

  const field = (k, label, props = {}) => (
    <label>{label}
      <input value={values[k]} onChange={set(k)} disabled={readOnly || props.disabled} {...props} />
      {errors[k] && <span className="err">{errors[k]}</span>}
    </label>
  );

  return (
    <form className="card form" onSubmit={submit} noValidate>
      <h1>{isNew ? 'Add student' : readOnly ? 'Student details' : 'Edit student'}</h1>
      {apiError && <div className="alert error" role="alert">{apiError}</div>}
      <div className="grid">
        {field('studentId', 'Student ID', { disabled: !isNew })}
        {field('name', 'Student name')}
        {field('email', 'Email', { type: 'email' })}
        {field('phone', 'Phone number', { type: 'tel', inputMode: 'numeric', maxLength: 10 })}
        <label>Class / Section
          <select value={values.classSectionId} onChange={set('classSectionId')} disabled={readOnly}>
            <option value="">Select…</option>
            {sections.map((s) => <option key={s._id} value={s._id}>{s.gradeName} - {s.sectionName}</option>)}
          </select>
          {errors.classSectionId && <span className="err">{errors.classSectionId}</span>}
        </label>
        {field('admissionDate', 'Date of admission', { type: 'date' })}
        {field('dob', 'Date of birth', { type: 'date' })}
        <label>Status
          <select value={values.status} onChange={set('status')} disabled={readOnly}>
            <option>Active</option>
            <option>Inactive</option>
          </select>
        </label>
      </div>
      <div className="row">
        {!readOnly && <button className="btn primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>}
        {!readOnly && <button type="button" className="btn ghost" onClick={() => nav('/students')} disabled={saving}>Cancel</button>}
      </div>
    </form>
  );
}
