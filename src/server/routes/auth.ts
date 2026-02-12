import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../db.js';
import { generateToken, authenticate, AuthRequest } from '../middleware/auth.js';
import { validateBody } from '../middleware/validateBody.js';
import { loginSchema, passwordChangeSchema } from '../schemas/index.js';
import logger from '../lib/logger.js';
import { logActivity } from '../services/activityLog.js';

const router = Router();

// Public registration disabled — users are created by admins via /api/users
// Kept as a 404 to avoid leaking that the endpoint once existed
router.post('/register', (_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

// Login
router.post('/login', validateBody(loginSchema), async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    const ip = req.ip || req.socket.remoteAddress || 'unknown';

    // Find user
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      logActivity('login_failed', { metadata: { email, ip, reason: 'unknown_email' } });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      logActivity('login_failed', { userId: user.id, metadata: { email, ip, reason: 'wrong_password' } });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate token
    const token = generateToken({
      id: user.id,
      email: user.email,
      role: user.role,
      tokenVersion: user.tokenVersion,
    });

    logActivity('login_success', { userId: user.id, metadata: { email, ip } });

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      token,
    });
  } catch (error) {
    logger.error({ err: error }, 'Login error');
    res.status(500).json({ error: 'Failed to login' });
  }
});

// Get current user
router.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        scopedDepartments: true,
        scopedOffices: true,
        scopeMode: true,
        eventAccess: true,
        offerAccess: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Parse JSON scope fields for the response
    const response = {
      ...user,
      scopedDepartments: user.scopedDepartments ? JSON.parse(user.scopedDepartments) : null,
      scopedOffices: user.scopedOffices ? JSON.parse(user.scopedOffices) : null,
    };

    res.json(response);
  } catch (error) {
    logger.error({ err: error }, 'Get user error');
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// Update password
router.put('/password', authenticate, validateBody(passwordChangeSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const ip = req.ip || req.socket.remoteAddress || 'unknown';

    const validPassword = await bcrypt.compare(currentPassword, user.password);
    if (!validPassword) {
      logActivity('password_change_failed', { userId: req.user!.id, metadata: { ip, reason: 'wrong_current_password' } });
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const updated = await prisma.user.update({
      where: { id: req.user!.id },
      data: { password: hashedPassword, tokenVersion: { increment: 1 } },
    });

    const token = generateToken({
      id: updated.id,
      email: updated.email,
      role: updated.role,
      tokenVersion: updated.tokenVersion,
    });

    logActivity('password_changed', { userId: req.user!.id, metadata: { ip } });

    res.json({ message: 'Password updated successfully', token });
  } catch (error) {
    logger.error({ err: error }, 'Password update error');
    res.status(500).json({ error: 'Failed to update password' });
  }
});

export default router;
