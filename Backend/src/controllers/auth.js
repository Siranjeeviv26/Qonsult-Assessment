const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const rateLimit = require('express-rate-limit');
const { User } = require('../models');
const { AppError, ok, parse, wrap } = require('../utils');

const schema = z.object({
  // students (and admins) may sign in with their username or their email
  identifier: z.string().trim().min(1, 'Email or username is required').max(150),
  password: z.string().min(1, 'Password is required').max(200),
});

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many login attempts. Try again later.' },
});

const DUMMY = bcrypt.hashSync('dummy-password', 12); // equalises timing for unknown users

const login = wrap(async (req, res) => {
  const { identifier, password } = parse(schema, req.body);
  const id = identifier.toLowerCase();
  const user = await User.findOne({ $or: [{ username: id }, { email: id }], isActive: true });
  const valid = await bcrypt.compare(password, user?.passwordHash || DUMMY);
  if (!user || !valid) throw new AppError(401, 'Invalid email/username or password');
  const payload = { id: String(user._id), role: user.role, studentRef: user.studentRef ? String(user.studentRef) : null };
  const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '1h' });
  ok(res, {
    token,
    user: { id: payload.id, username: user.username, email: user.email, role: user.role, studentRef: payload.studentRef },
  }, 'Login successful');
});

module.exports = { login, limiter };
