const { z } = require('zod');
const { ClassSection } = require('../models');
const { AppError, ok, parse, wrap } = require('../utils');

const schema = z.object({
  gradeName: z.string().trim().min(1, 'Class/Grade is required').max(50),
  sectionName: z.string().trim().min(1, 'Section is required').max(50),
  description: z.string().trim().max(250).optional().default(''),
  status: z.enum(['Active', 'Inactive']).default('Active'),
}).strict();

const getAll = wrap(async (req, res) => {
  const filter = req.query.status === 'all' ? {} : { status: 'Active' };
  const items = await ClassSection.find(filter).sort({ gradeName: 1, sectionName: 1 }).lean();
  ok(res, items, 'Class/sections retrieved successfully');
});

const create = wrap(async (req, res) => {
  const doc = await ClassSection.create(parse(schema, req.body));
  ok(res, doc, 'Class/section created successfully', 201);
});

const update = wrap(async (req, res) => {
  const doc = await ClassSection.findByIdAndUpdate(req.params.id, parse(schema, req.body), { new: true, runValidators: true });
  if (!doc) throw new AppError(404, 'Class/section not found');
  ok(res, doc, 'Class/section updated successfully');
});

module.exports = { getAll, create, update };
