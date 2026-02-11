import { Router, Response } from 'express';
import prisma from '../db.js';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth.js';
import { validateBody } from '../middleware/validateBody.js';
import { officeCreateSchema, officeUpdateSchema } from '../schemas/index.js';
import logger from '../lib/logger.js';

const router = Router();

// Get all offices (any authenticated user)
router.get('/', authenticate, async (_req: AuthRequest, res: Response) => {
  try {
    const offices = await prisma.office.findMany({
      include: {
        _count: { select: { jobs: true } },
      },
      orderBy: { name: 'asc' },
    });
    res.json(offices);
  } catch (error) {
    logger.error({ err: error }, 'Get offices error');
    res.status(500).json({ error: 'Failed to fetch offices' });
  }
});

// Create office (admin only)
router.post(
  '/',
  authenticate,
  requireRole('admin'),
  validateBody(officeCreateSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const { name, address, city, state, zip, phone } = req.body;

      const office = await prisma.office.create({
        data: { name, address, city, state, zip, phone },
        include: { _count: { select: { jobs: true } } },
      });

      res.status(201).json(office);
    } catch (error) {
      logger.error({ err: error }, 'Create office error');
      res.status(500).json({ error: 'Failed to create office' });
    }
  }
);

// Update office (admin only)
router.put(
  '/:id',
  authenticate,
  requireRole('admin'),
  validateBody(officeUpdateSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { name, address, city, state, zip, phone } = req.body;

      const existing = await prisma.office.findUnique({ where: { id } });
      if (!existing) {
        return res.status(404).json({ error: 'Office not found' });
      }

      const updateData: Record<string, string> = {};
      if (name) updateData.name = name;
      if (address) updateData.address = address;
      if (city) updateData.city = city;
      if (state) updateData.state = state;
      if (zip) updateData.zip = zip;
      if (phone) updateData.phone = phone;

      const office = await prisma.office.update({
        where: { id },
        data: updateData,
        include: { _count: { select: { jobs: true } } },
      });

      res.json(office);
    } catch (error) {
      logger.error({ err: error }, 'Update office error');
      res.status(500).json({ error: 'Failed to update office' });
    }
  }
);

// Delete office (admin only, block if jobs assigned)
router.delete(
  '/:id',
  authenticate,
  requireRole('admin'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;

      const existing = await prisma.office.findUnique({
        where: { id },
        include: { _count: { select: { jobs: true } } },
      });
      if (!existing) {
        return res.status(404).json({ error: 'Office not found' });
      }

      if (existing._count.jobs > 0) {
        return res.status(400).json({
          error: `Cannot delete office with ${existing._count.jobs} assigned job(s). Reassign or remove jobs first.`,
        });
      }

      await prisma.office.delete({ where: { id } });
      res.json({ message: 'Office deleted successfully' });
    } catch (error) {
      logger.error({ err: error }, 'Delete office error');
      res.status(500).json({ error: 'Failed to delete office' });
    }
  }
);

export default router;
