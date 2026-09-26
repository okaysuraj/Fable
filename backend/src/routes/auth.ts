import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import { signToken, requireAuth, AuthRequest } from '../lib/auth.js';

export const authRouter = Router();

// POST /api/auth/register
authRouter.post('/register', async (req: Request, res: Response) => {
  const { email, password, name } = req.body;

  if (!email || !password || !name) {
    return res.status(400).json({ error: 'email, password, and name are required' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  try {
    // Check if email already exists
    const existing = await prisma.account.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    // Generate handle and monogram from name
    const handle = `@${name.toLowerCase().replace(/\s+/g, '')}`;
    const nameParts = name.trim().split(/\s+/);
    const monogram = nameParts.length >= 2
      ? (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase()
      : name.slice(0, 2).toUpperCase();

    const userId = `usr_${Date.now().toString(36)}`;

    // Create user + account in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          id: userId,
          name,
          handle,
          monogram,
          role: 'Member',
          status: 'online',
          statusText: 'Just joined Fable',
          avatarColor: '#2D3748',
        },
      });

      const account = await tx.account.create({
        data: {
          email,
          password: hashedPassword,
          userId: user.id,
        },
      });

      return { user, account };
    });

    const token = signToken({
      accountId: result.account.id,
      userId: result.user.id,
      email,
    });

    res.status(201).json({
      token,
      user: {
        id: result.user.id,
        name: result.user.name,
        handle: result.user.handle,
        monogram: result.user.monogram,
        role: result.user.role,
        status: result.user.status,
        statusText: result.user.statusText,
        avatarColor: result.user.avatarColor,
      },
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /api/auth/login
authRouter.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  try {
    const account = await prisma.account.findUnique({
      where: { email },
      include: { user: true },
    });

    if (!account) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const valid = await bcrypt.compare(password, account.password);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Update user status to online
    await prisma.user.update({
      where: { id: account.userId },
      data: { status: 'online' },
    });

    const token = signToken({
      accountId: account.id,
      userId: account.userId,
      email: account.email,
    });

    res.json({
      token,
      user: {
        id: account.user.id,
        name: account.user.name,
        handle: account.user.handle,
        monogram: account.user.monogram,
        role: account.user.role,
        status: 'online',
        statusText: account.user.statusText,
        avatarColor: account.user.avatarColor,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// GET /api/auth/me — get current user from token
authRouter.get('/me', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.auth!.userId },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      user: {
        id: user.id,
        name: user.name,
        handle: user.handle,
        monogram: user.monogram,
        role: user.role,
        status: user.status,
        statusText: user.statusText,
        avatarColor: user.avatarColor,
      },
    });
  } catch (err) {
    console.error('Auth me error:', err);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});
