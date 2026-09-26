import { Router, Request, Response } from 'express';
import { checkDatabaseConnection } from '../lib/prisma.js';

export const healthRouter = Router();

const startTime = Date.now();

healthRouter.get('/', async (_req: Request, res: Response) => {
  const isDbLive = await checkDatabaseConnection();
  res.json({
    status: 'ok',
    service: 'fable-express-backend',
    version: '1.0.0',
    database: isDbLive ? 'postgresql_connected' : 'disconnected',
    uptime: Math.floor((Date.now() - startTime) / 1000),
    timestamp: new Date().toISOString(),
  });
});
