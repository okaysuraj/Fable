import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { healthRouter } from './routes/health.js';
import { authRouter } from './routes/auth.js';
import { channelsRouter } from './routes/channels.js';
import { messagesRouter } from './routes/messages.js';
import { teamRouter } from './routes/team.js';
import { settingsRouter } from './routes/settings.js';
import { requireAuth } from './lib/auth.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 5000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// Middleware
app.use(
  cors({
    origin: [FRONTEND_URL, 'http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request Logger
app.use((req: Request, _res: Response, next: NextFunction) => {
  const timestamp = new Date().toISOString().split('T')[1].slice(0, 8);
  console.log(`[${timestamp}] ${req.method} ${req.url}`);
  next();
});

// Public routes (no auth required)
app.use('/api/health', healthRouter);
app.use('/api/auth', authRouter);

// Protected routes (auth required)
app.use('/api/channels', requireAuth, channelsRouter);
app.use('/api/messages', requireAuth, messagesRouter);
app.use('/api/team', requireAuth, teamRouter);
app.use('/api/settings', requireAuth, settingsRouter);

// Root route
app.get('/', (_req: Request, res: Response) => {
  res.json({
    name: 'Fable Studio API',
    description: 'Express.js backend for Fable collaborative workspace',
    endpoints: [
      '/api/health',
      '/api/auth/register',
      '/api/auth/login',
      '/api/auth/me',
      '/api/channels',
      '/api/messages',
      '/api/team/members',
      '/api/settings',
    ],
  });
});

// 404 Handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Global Error Handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[API Error]:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✨ Fable Express Backend is active on http://localhost:${PORT}`);
  console.log(`📡 Health check ready at http://localhost:${PORT}/api/health`);
});

export default app;
