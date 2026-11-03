const mongoose = require('mongoose');
const { z } = require('zod');
const { Student, ClassSection } = require('../models');
const { AppError, ok, parse, wrap } = require('../utils');

/* ---------- validation ---------- */
const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
  .refine((s) => !Number.isNaN(Date.parse(s)), 'Invalid date');
const status = z.enum(['Active', 'Inactive']);

const createSchema = z.object({
  studentId: z.string().trim().min(1, 'Student ID is required').max(30),
  name: z.string().trim().min(1, 'Student name is required').max(100),
  email: z.string().trim().toLowerCase().email('Enter a valid email').max(150),
  phone: z.string().trim().regex(/^\d{10}$/, 'Enter a valid 10-digit phone number'),
  classSectionId: objectId,
  admissionDate: dateStr,
  dob: dateStr,
  status: status.default('Active'),
}).strict();

const updateFields = createSchema.omit({ studentId: true }).partial().strict();
const updateSchema = z.object({
  changes: updateFields.refine((o) => Object.keys(o).length > 0, 'Nothing to update'),
  base: z.record(z.any()).default({}), // original values of the changed fields (for conflict detection)
}).strict();

const listSchema = z.object({
  search: z.string().trim().max(100).optional(),
  classSectionId: objectId.optional(),
  status: status.optional(),
  admissionFrom: dateStr.optional(),
  admissionTo: dateStr.optional(),
  sortBy: z.enum(['name', 'admissionDate', 'dob']).default('name'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  limit: z.coerce.number().int().refine((n) => [10, 20, 50, 100].includes(n), 'Invalid page size').default(20),
});

// Business rules that need the DB or cross-field checks.
async function checkBusiness({ dob, admissionDate, classSectionId }) {
  const errors = [];
  const today = new Date().toISOString().slice(0, 10);
  if (dob && dob >= today) errors.push({ field: 'dob', message: 'Date of birth must be in the past' });
  if (admissionDate && admissionDate > today) errors.push({ field: 'admissionDate', message: 'Admission date cannot be in the future' });
  if (dob && admissionDate && admissionDate <= dob) errors.push({ field: 'admissionDate', message: 'Admission date must be after date of birth' });
  if (classSectionId) {
    const cs = await ClassSection.exists({ _id: classSectionId, status: 'Active' });
    if (!cs) errors.push({ field: 'classSectionId', message: 'Class/section does not exist or is inactive' });
  }
  if (errors.length) throw new AppError(422, 'Validation failed', errors);
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const iso = (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : v == null ? v : String(v));
const withDerived = (d) => ({
  ...d,
  ...(d.name !== undefined && { nameLower: d.name.toLowerCase() }),
  ...(d.email !== undefined && { emailLower: d.email.toLowerCase() }),
  ...(d.admissionDate !== undefined && { admissionDate: new Date(d.admissionDate) }),
  ...(d.dob !== undefined && { dob: new Date(d.dob) }),
});
const populateCs = { path: 'classSectionId', select: 'gradeName sectionName' };

/* ---------- list (search / filter / sort / paginate) ---------- */
const getAll = wrap(async (req, res) => {
  const q = parse(listSchema, req.query);
  const filter = {};
  if (q.status) filter.status = q.status;
  if (q.classSectionId) filter.classSectionId = new mongoose.Types.ObjectId(q.classSectionId);
  if (q.admissionFrom || q.admissionTo) {
    filter.admissionDate = {};
    if (q.admissionFrom) filter.admissionDate.$gte = new Date(q.admissionFrom);
    if (q.admissionTo) filter.admissionDate.$lte = new Date(q.admissionTo);
  }
  if (q.search) {
    // anchored, lowercase prefix match => can use the nameLower index
    const re = new RegExp('^' + escapeRe(q.search.toLowerCase()));
    filter.$or = [{ nameLower: re }, { emailLower: re }];
  }
  const sortField = q.sortBy === 'name' ? 'nameLower' : q.sortBy;
  const dir = q.sortOrder === 'asc' ? 1 : -1;

  // fetch limit+1 to know if a next page exists (avoids an expensive count on huge collections)
  const rows = await Student.find(filter)
    .sort({ [sortField]: dir, _id: dir })
    .skip((q.page - 1) * q.limit)
    .limit(q.limit + 1)
    .select('-nameLower -emailLower')
    .populate(populateCs)
    .lean();
  const hasNext = rows.length > q.limit;
  ok(res, rows.slice(0, q.limit), 'Students retrieved successfully', 200, { page: q.page, limit: q.limit, hasNext });
});

/* ---------- get by id (authorization enforced here: no IDOR) ---------- */
const getOne = wrap(async (req, res) => {
  const { id } = parse(z.object({ id: objectId }), req.params);
  if (req.user.role !== 'admin' && req.user.studentRef !== id) {
    throw new AppError(403, 'You do not have permission to view this student');
  }
  const s = await Student.findById(id).select('-nameLower -emailLower').populate(populateCs).lean();
  if (!s) throw new AppError(404, 'Student not found');
  ok(res, s, 'Student retrieved successfully');
});

/* ---------- create ---------- */
const create = wrap(async (req, res) => {
  const data = parse(createSchema, req.body);
  await checkBusiness(data);
  const student = await Student.create(withDerived(data));
  ok(res, student, 'Student created successfully', 201);
});

/* ---------- partial update with field-level conflict detection ---------- */
const update = wrap(async (req, res) => {
  const { id } = parse(z.object({ id: objectId }), req.params);
  const { changes, base } = parse(updateSchema, req.body);
  const keys = Object.keys(changes);

  for (let attempt = 0; attempt < 3; attempt++) {
    const doc = await Student.findById(id).lean();
    if (!doc) throw new AppError(404, 'Student not found');

    // Conflict only if someone else changed the SAME field to something different.
    const conflicts = keys.filter((k) => {
      const current = iso(doc[k]);
      return current !== iso(base[k]) && current !== changes[k];
    });
    if (conflicts.length) {
      throw new AppError(409, 'This student was changed by someone else. Reload and try again.',
        conflicts.map((f) => ({ field: f, message: 'Changed by another user' })));
    }

    await checkBusiness({
      dob: changes.dob ?? iso(doc.dob),
      admissionDate: changes.admissionDate ?? iso(doc.admissionDate),
      classSectionId: changes.classSectionId, // only re-check if being changed
    });

    const updated = await Student.findOneAndUpdate(
      { _id: id, version: doc.version }, // version in the filter => atomic compare-and-set
      { $set: withDerived(changes), $inc: { version: 1 } },
      { new: true }
    ).select('-nameLower -emailLower').populate(populateCs);
    if (updated) return ok(res, updated, 'Student updated successfully');
  }
  throw new AppError(409, 'Could not save because the record is being modified. Please retry.');
});

/* ---------- soft delete / deactivate ---------- */
const remove = wrap(async (req, res) => {
  const { id } = parse(z.object({ id: objectId }), req.params);
  const s = await Student.findByIdAndUpdate(id, { $set: { status: 'Inactive' }, $inc: { version: 1 } }, { new: true });
  if (!s) throw new AppError(404, 'Student not found');
  ok(res, { id, status: 'Inactive' }, 'Student deactivated successfully');
});

module.exports = { getAll, getOne, create, update, remove };
