import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';

export const teamRouter = Router();

// GET /api/team/members
teamRouter.get('/members', async (_req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        handle: true,
        monogram: true,
        role: true,
        status: true,
        statusText: true,
        avatarColor: true,
      },
    });
    res.json({ data: users });
  } catch (err) {
    console.error('Failed to fetch team members:', err);
    res.status(500).json({ error: 'Failed to fetch team members' });
  }
});
