import { Router, Response } from 'express';
import prisma from '../db.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import logger from '../lib/logger.js';

const router = Router();

// All notification routes require authentication
router.use(authenticate);

// GET / — current user's notifications (latest 50) + unread count
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      prisma.notification.count({
        where: { userId, read: false },
      }),
    ]);

    res.json({ notifications, unreadCount });

    // Fire-and-forget: clean up notifications older than 90 days
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 90);
    prisma.notification.deleteMany({
      where: { userId, createdAt: { lt: cutoff } },
    }).catch(err => logger.error({ err }, 'Failed to clean up old notifications'));
  } catch (err) {
    logger.error({ err }, 'Failed to fetch notifications');
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// GET /unread-count — lightweight badge count endpoint
router.get('/unread-count', async (req: AuthRequest, res: Response) => {
  try {
    const count = await prisma.notification.count({
      where: { userId: req.user!.id, read: false },
    });
    res.json({ count });
  } catch (err) {
    logger.error({ err }, 'Failed to fetch unread count');
    res.status(500).json({ error: 'Failed to fetch unread count' });
  }
});

// PATCH /:id/read — mark a single notification as read
router.patch('/:id/read', async (req: AuthRequest, res: Response) => {
  try {
    const notification = await prisma.notification.findUnique({
      where: { id: req.params.id },
    });

    if (!notification || notification.userId !== req.user!.id) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    const updated = await prisma.notification.update({
      where: { id: req.params.id },
      data: { read: true },
    });

    res.json(updated);
  } catch (err) {
    logger.error({ err }, 'Failed to mark notification as read');
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

// POST /mark-all-read — mark all of current user's notifications as read
router.post('/mark-all-read', async (req: AuthRequest, res: Response) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user!.id, read: false },
      data: { read: true },
    });
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Failed to mark all notifications as read');
    res.status(500).json({ error: 'Failed to mark all notifications as read' });
  }
});

// DELETE /:id — delete a notification
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const notification = await prisma.notification.findUnique({
      where: { id: req.params.id },
    });

    if (!notification || notification.userId !== req.user!.id) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    await prisma.notification.delete({
      where: { id: req.params.id },
    });

    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Failed to delete notification');
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

export default router;
