const jwt = require('jsonwebtoken');
const { ZodError } = require('zod');
const { AppError, wrap, logger } = require('../utils');
const { IdempotencyKey } = require('../models');

// Verifies the Bearer JWT and attaches the decoded payload to req.user.
const authenticate = (req, res, next) => {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) throw new AppError(401, 'Authentication required');
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    throw new AppError(401, 'Invalid or expired token');
  }
  next();
};

const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) throw new AppError(403, 'You do not have permission to do this');
  next();
};

// Prevents duplicate processing when the same Idempotency-Key is replayed.
const idempotent = wrap(async (req, res, next) => {
  const key = req.get('Idempotency-Key');
  if (!key) return next();
  const id = `${req.user.id}:${key}`;
  try {
    await IdempotencyKey.create({ _id: id });
  } catch (e) {
    if (e.code === 11000) {
      const rec = await IdempotencyKey.findById(id).lean();
      if (rec?.status) return res.status(rec.status).json(rec.body); // replay stored response
      throw new AppError(409, 'This request is already being processed');
    }
    throw e;
  }
  const send = res.json.bind(res);
  res.json = (body) => {
    if (res.statusCode < 300) IdempotencyKey.updateOne({ _id: id }, { status: res.statusCode, body }).catch(() => {});
    else IdempotencyKey.deleteOne({ _id: id }).catch(() => {}); // allow retry after fixing errors
    return send(body);
  };
  next();
});

const notFound = (req, res, next) => next(new AppError(404, 'Route not found'));

// Central error handler: never leaks stack traces / DB internals.
const errorHandler = (err, req, res, next) => { // eslint-disable-line
  let status = 500, message = 'Something went wrong. Please try again later.', errors;
  if (err instanceof AppError) ({ status, message, errors } = err);
  else if (err instanceof ZodError) { status = 422; message = 'Validation failed'; }
  else if (err?.code === 11000) {
    status = 409;
    const f = Object.keys(err.keyPattern || {})[0] || 'value';
    const label = f === 'emailLower' ? 'email' : f;
    message = `A record with this ${label} already exists`;
    errors = [{ field: label, message: 'Must be unique' }];
  } else if (err?.name === 'ValidationError') {
    status = 422;
    message = 'Validation failed';
    errors = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
  } else if (err?.name === 'CastError') { status = 400; message = 'Invalid identifier'; }
  if (status >= 500) logger.error({ err, path: req.path, user: req.user?.id }, 'unhandled error');
  else logger.warn({ status, message, path: req.path }, 'request rejected');
  res.status(status).json({ success: false, message, ...(errors && { errors }) });
};

module.exports = { authenticate, requireRole, idempotent, notFound, errorHandler };
