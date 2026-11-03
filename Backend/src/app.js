require('dotenv/config');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const connectDB = require('./config/DB');
const authRoutes = require('./routes/auth');
const classRoutes = require('./routes/classSections');
const studentRoutes = require('./routes/students');
const { notFound, errorHandler } = require('./middleware');
const { logger } = require('./utils');

for (const k of ['MONGO_URI', 'JWT_SECRET']) {
  if (!process.env[k]) { logger.fatal(`Missing env var ${k}`); process.exit(1); }
}

const app = express();
app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_ORIGIN, exposedHeaders: ['Idempotency-Key'] }));
app.use(express.json({ limit: '100kb' }));

app.get('/api/health', (req, res) => res.json({ success: true, data: { status: 'up' }, message: 'OK' }));
app.use('/api/auth', authRoutes);
app.use('/api/class-sections', classRoutes);
app.use('/api/students', studentRoutes);
app.use(notFound);
app.use(errorHandler);

connectDB()
  .then(() => {
    const port = process.env.PORT || 5000;
    const server = app.listen(port, () => console.log(`API listening on :${port}`));
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`Port ${port} is already in use. Stop the other process (or change PORT in .env) and retry.`);
      } else {
        console.error(`Server error: ${err.message}`);
      }
      process.exit(1);
    });
  })
  .catch((err) => {
    console.error(`Could not connect to MongoDB (${err.message}). Is mongod running?`);
    process.exit(1);
  });

process.on('unhandledRejection', (e) => logger.error({ err: e }, 'unhandledRejection'));
