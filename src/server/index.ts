import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import authRoutes from './routes/auth.js';
import jobRoutes from './routes/jobs.js';
import applicantRoutes from './routes/applicants.js';
import reviewRoutes from './routes/reviews.js';
import dashboardRoutes from './routes/dashboard.js';
import userRoutes from './routes/users.js';
import emailSettingsRoutes from './routes/emailSettings.js';
import officeRoutes from './routes/offices.js';
import eventRoutes from './routes/events.js';
import siteSettingsRoutes from './routes/siteSettings.js';
import notificationRoutes from './routes/notifications.js';
import interviewRoutes from './routes/interviews.js';
import offerRoutes from './routes/offers.js';
import logger from './lib/logger.js';
import { requestLogger } from './middleware/requestLogger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3005;

// Trust proxy for correct client IP behind reverse proxies
app.set('trust proxy', true);

// Security headers
app.use(helmet({
  contentSecurityPolicy: false, // Vite-built SPA uses inline scripts; CSP can be fine-tuned later
  crossOriginEmbedderPolicy: false,
}));

// Serve static frontend in production (before CORS/API middleware)
if (process.env.NODE_ENV === 'production') {
  const clientPath = path.join(__dirname, '../client');
  app.use(express.static(clientPath));

  // Serve uploaded files
  app.use('/uploads', express.static(path.join(__dirname, '../../uploads')));
}

// CORS — restrict origins in production/staging (API routes only)
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : null;

if (!allowedOrigins && process.env.NODE_ENV === 'production') {
  logger.warn('ALLOWED_ORIGINS is not set — CORS will allow all origins. Set ALLOWED_ORIGINS in production.');
}

app.use('/api', cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (server-to-server, curl, mobile apps)
    if (!origin) return callback(null, true);
    // In dev (no ALLOWED_ORIGINS set), allow all origins
    if (!allowedOrigins || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// In dev, serve uploads and allow all CORS
if (process.env.NODE_ENV !== 'production') {
  app.use('/uploads', express.static(path.join(__dirname, '../../uploads')));
  app.use(cors());
}

// Rate limiting
const rateLimitOptions = {
  // Disable trust proxy validation — we handle proxy trust at the Express level
  validate: { trustProxy: false },
};

const apiLimiter = rateLimit({
  ...rateLimitOptions,
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 200 : 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api/', apiLimiter);

// Strict rate limit on auth endpoints
const authLimiter = rateLimit({
  ...rateLimitOptions,
  windowMs: 15 * 60 * 1000,
  max: 10, // 10 attempts per 15 min
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: 'Too many login attempts, please try again later.' },
});
app.use('/api/auth/login', authLimiter);

// Strict rate limit on public form submissions
const publicFormLimiter = rateLimit({
  ...rateLimitOptions,
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many submissions, please try again later.' },
});
app.use('/api/applicants', (req, _res, next) => {
  // Only rate-limit unauthenticated POST (public application forms)
  if (req.method === 'POST' && !req.headers.authorization) {
    return publicFormLimiter(req, _res, next);
  }
  next();
});

app.use(requestLogger);
app.use(express.json());

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/applicants', applicantRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/users', userRoutes);
app.use('/api/email-settings', emailSettingsRoutes);
app.use('/api/offices', officeRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/settings', siteSettingsRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/interviews', interviewRoutes);
app.use('/api/offers', offerRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// SPA fallback — serve index.html for all non-API routes in production
if (process.env.NODE_ENV === 'production') {
  const clientPath = path.join(__dirname, '../client');
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientPath, 'index.html'));
  });
}

// Error handling middleware
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error({ err }, 'Unhandled error');
  res.status(500).json({ error: 'Something went wrong!' });
});

app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});
