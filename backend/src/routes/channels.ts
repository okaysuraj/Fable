import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';

export const channelsRouter = Router();

// GET /api/channels
channelsRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const channels = await prisma.channel.findMany({
      orderBy: { createdAt: 'asc' },
    });
    res.json({ data: channels, total: channels.length });
  } catch (err) {
    console.error('Failed to fetch channels:', err);
    res.status(500).json({ error: 'Failed to fetch channels' });
  }
});

// GET /api/channels/:id
channelsRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const channel = await prisma.channel.findUnique({
      where: { id: req.params.id },
    });
    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }
    res.json({ data: channel });
  } catch (err) {
    console.error('Failed to fetch channel:', err);
    res.status(500).json({ error: 'Failed to fetch channel' });
  }
});
