const pino = require('pino');

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

class AppError extends Error {
  constructor(status, message, errors) {
    super(message);
    this.status = status;
    this.errors = errors;
  }
}

const ok = (res, data, message = 'OK', status = 200, extra = {}) =>
  res.status(status).json({ success: true, data, message, ...extra });

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Validate input with a zod schema; throws a 422 with field-level errors.
const parse = (schema, input) => {
  const r = schema.safeParse(input);
  if (!r.success) {
    throw new AppError(
      422,
      'Validation failed',
      r.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }))
    );
  }
  return r.data;
};

module.exports = { logger, AppError, ok, wrap, parse };
