import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';

export const settingsRouter = Router();

// GET /api/settings
settingsRouter.get('/', async (_req: Request, res: Response) => {
  try {
    let setting = await prisma.workspaceSetting.findUnique({
      where: { id: 'default_settings' },
    });

    if (!setting) {
      setting = await prisma.workspaceSetting.create({
        data: { id: 'default_settings' },
      });
    }

    res.json({ data: setting });
  } catch (err) {
    console.error('Failed to fetch settings:', err);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// PUT /api/settings
settingsRouter.put('/', async (req: Request, res: Response) => {
  try {
    const updated = await prisma.workspaceSetting.upsert({
      where: { id: 'default_settings' },
      update: req.body,
      create: {
        id: 'default_settings',
        ...req.body,
      },
    });

    res.json({
      data: updated,
      message: 'Settings updated',
    });
  } catch (err) {
    console.error('Failed to update settings:', err);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});
