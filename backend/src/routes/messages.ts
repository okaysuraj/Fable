import { Router, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { AuthRequest } from '../lib/auth.js';

export const messagesRouter = Router();

type MessageWithRelations = Prisma.MessageGetPayload<{
  include: {
    sender: true;
    reactions: true;
  };
}>;

function formatMessage(m: MessageWithRelations, currentUserId: string) {
  const reactionCounts: Record<string, { icon: string; count: number; reactedByMe: boolean }> = {};
  for (const r of m.reactions) {
    if (!reactionCounts[r.icon]) {
      reactionCounts[r.icon] = { icon: r.icon, count: 0, reactedByMe: false };
    }
    reactionCounts[r.icon].count += 1;
    if (r.userId === currentUserId) {
      reactionCounts[r.icon].reactedByMe = true;
    }
  }

  return {
    id: m.id,
    channelId: m.channelId,
    sender: {
      id: m.sender.id,
      name: m.sender.name,
      handle: m.sender.handle,
      monogram: m.sender.monogram,
      role: m.sender.role,
      status: m.sender.status,
      statusText: m.sender.statusText,
      avatarColor: m.sender.avatarColor,
    },
    timestamp: m.timestamp,
    content: m.content,
    voiceNote: m.voiceNote,
    codeSnippet: m.codeSnippet,
    attachments: m.attachments,
    isPinned: m.isPinned,
    reactions: Object.values(reactionCounts),
  };
}

// GET /api/messages/:channelId
messagesRouter.get('/:channelId', async (req: Request, res: Response) => {
  const { channelId } = req.params;
  const authReq = req as AuthRequest;
  const currentUserId = authReq.auth?.userId || '';

  try {
    const dbMessages = await prisma.message.findMany({
      where: { channelId },
      include: {
        sender: true,
        reactions: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    const formatted = dbMessages.map((m) => formatMessage(m, currentUserId));

    res.json({
      channelId,
      data: formatted,
      total: formatted.length,
    });
  } catch (err) {
    console.error('Failed to fetch messages:', err);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// GET /api/messages (all grouped by channel)
messagesRouter.get('/', async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const currentUserId = authReq.auth?.userId || '';

  try {
    const channels = await prisma.channel.findMany({ select: { id: true } });
    const result: Record<string, ReturnType<typeof formatMessage>[]> = {};

    for (const ch of channels) {
      const msgs = await prisma.message.findMany({
        where: { channelId: ch.id },
        include: { sender: true, reactions: true },
        orderBy: { createdAt: 'asc' },
      });
      result[ch.id] = msgs.map((m) => formatMessage(m, currentUserId));
    }

    res.json({ data: result });
  } catch (err) {
    console.error('Failed to fetch all messages:', err);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// POST /api/messages
messagesRouter.post('/', async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const senderId = authReq.auth?.userId;
  const { channelId, content, voiceNote, codeSnippet } = req.body;

  if (!channelId || (!content && !voiceNote)) {
    return res.status(400).json({ error: 'channelId and content or voiceNote are required' });
  }

  if (!senderId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const formattedHours = hours % 12 || 12;
    const formattedMinutes = minutes < 10 ? `0${minutes}` : minutes;
    const timestamp = `${formattedHours}:${formattedMinutes} ${ampm}`;

    const msgId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    const created = await prisma.message.create({
      data: {
        id: msgId,
        channelId,
        senderId,
        timestamp,
        content: content || '',
        voiceNote: voiceNote as object | undefined,
        codeSnippet: codeSnippet as object | undefined,
      },
      include: {
        sender: true,
        reactions: true,
      },
    });

    res.status(201).json({
      data: formatMessage(created, senderId),
      message: 'Message created successfully',
    });
  } catch (err) {
    console.error('Failed to create message:', err);
    res.status(500).json({ error: 'Failed to create message' });
  }
});

// POST /api/messages/:id/reactions
messagesRouter.post('/:id/reactions', async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const userId = authReq.auth?.userId;
  const { id } = req.params;
  const { icon } = req.body;

  if (!icon) {
    return res.status(400).json({ error: 'Reaction icon is required' });
  }

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const existing = await prisma.reaction.findUnique({
      where: {
        messageId_userId_icon: {
          messageId: id,
          userId,
          icon,
        },
      },
    });

    if (existing) {
      await prisma.reaction.delete({ where: { id: existing.id } });
    } else {
      await prisma.reaction.create({
        data: { messageId: id, userId, icon },
      });
    }

    // Fetch updated message
    const updated = await prisma.message.findUnique({
      where: { id },
      include: { sender: true, reactions: true },
    });

    if (!updated) {
      return res.status(404).json({ error: 'Message not found' });
    }

    res.json({
      data: formatMessage(updated, userId),
      message: 'Reaction updated',
    });
  } catch (err) {
    console.error('Failed to toggle reaction:', err);
    res.status(500).json({ error: 'Failed to update reaction' });
  }
});
