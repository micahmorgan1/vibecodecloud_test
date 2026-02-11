import { Router, Response } from 'express';
import prisma from '../db.js';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth.js';
import { validateBody } from '../middleware/validateBody.js';
import { siteSettingUpdateSchema } from '../schemas/index.js';

const router = Router();

const PUBLIC_KEYS = ['about_whlc', 'events_intro', 'positions_intro'];

// Get a setting by key (public, whitelisted keys only)
router.get('/public/:key', async (req, res) => {
  try {
    const { key } = req.params;
    if (!PUBLIC_KEYS.includes(key)) {
      return res.status(404).json({ error: 'Setting not found' });
    }

    const setting = await prisma.siteSetting.findUnique({ where: { key } });
    if (!setting) {
      return res.status(404).json({ error: 'Setting not found' });
    }

    res.json({ key: setting.key, value: setting.value });
  } catch (error) {
    console.error('Get public setting error:', error);
    res.status(500).json({ error: 'Failed to fetch setting' });
  }
});

// Get a setting by key (authenticated, admin/HM)
router.get('/:key', authenticate, requireRole('admin', 'hiring_manager'), async (req: AuthRequest, res: Response) => {
  try {
    const { key } = req.params;
    const setting = await prisma.siteSetting.findUnique({ where: { key } });
    if (!setting) {
      return res.json({ key, value: '' });
    }
    res.json({ key: setting.key, value: setting.value });
  } catch (error) {
    console.error('Get setting error:', error);
    res.status(500).json({ error: 'Failed to fetch setting' });
  }
});

// Update/create a setting (authenticated, admin/HM)
router.put(
  '/:key',
  authenticate,
  requireRole('admin', 'hiring_manager'),
  validateBody(siteSettingUpdateSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const { key } = req.params;
      const { value } = req.body;

      const setting = await prisma.siteSetting.upsert({
        where: { key },
        create: { key, value },
        update: { value },
      });

      res.json({ key: setting.key, value: setting.value });
    } catch (error) {
      console.error('Update setting error:', error);
      res.status(500).json({ error: 'Failed to update setting' });
    }
  }
);

export default router;
