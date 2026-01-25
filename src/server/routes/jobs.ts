import { Router, Response } from 'express';
import prisma from '../db.js';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth.js';

const router = Router();

// Get all jobs (with optional filters)
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { status, department, type } = req.query;

    const where: Record<string, string> = {};
    if (status) where.status = status as string;
    if (department) where.department = department as string;
    if (type) where.type = type as string;

    const jobs = await prisma.job.findMany({
      where,
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        _count: {
          select: { applicants: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(jobs);
  } catch (error) {
    console.error('Get jobs error:', error);
    res.status(500).json({ error: 'Failed to fetch jobs' });
  }
});

// Get single job by ID
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const job = await prisma.job.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        applicants: {
          include: {
            reviews: {
              include: {
                reviewer: {
                  select: { id: true, name: true },
                },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    res.json(job);
  } catch (error) {
    console.error('Get job error:', error);
    res.status(500).json({ error: 'Failed to fetch job' });
  }
});

// Create a new job (admin or hiring_manager only)
router.post(
  '/',
  authenticate,
  requireRole('admin', 'hiring_manager'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { title, department, location, type, description, requirements, salary } = req.body;

      if (!title || !department || !location || !type || !description || !requirements) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const job = await prisma.job.create({
        data: {
          title,
          department,
          location,
          type,
          description,
          requirements,
          salary,
          createdById: req.user!.id,
        },
        include: {
          createdBy: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      res.status(201).json(job);
    } catch (error) {
      console.error('Create job error:', error);
      res.status(500).json({ error: 'Failed to create job' });
    }
  }
);

// Update a job
router.put(
  '/:id',
  authenticate,
  requireRole('admin', 'hiring_manager'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { title, department, location, type, description, requirements, salary, status } = req.body;

      const existingJob = await prisma.job.findUnique({ where: { id } });
      if (!existingJob) {
        return res.status(404).json({ error: 'Job not found' });
      }

      const updateData: Record<string, unknown> = {};
      if (title) updateData.title = title;
      if (department) updateData.department = department;
      if (location) updateData.location = location;
      if (type) updateData.type = type;
      if (description) updateData.description = description;
      if (requirements) updateData.requirements = requirements;
      if (salary !== undefined) updateData.salary = salary;
      if (status) {
        updateData.status = status;
        if (status === 'closed') {
          updateData.closedAt = new Date();
        }
      }

      const job = await prisma.job.update({
        where: { id },
        data: updateData,
        include: {
          createdBy: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      res.json(job);
    } catch (error) {
      console.error('Update job error:', error);
      res.status(500).json({ error: 'Failed to update job' });
    }
  }
);

// Delete a job (admin only)
router.delete(
  '/:id',
  authenticate,
  requireRole('admin'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;

      const existingJob = await prisma.job.findUnique({ where: { id } });
      if (!existingJob) {
        return res.status(404).json({ error: 'Job not found' });
      }

      // Delete associated applicants first (cascade)
      await prisma.applicant.deleteMany({ where: { jobId: id } });
      await prisma.job.delete({ where: { id } });

      res.json({ message: 'Job deleted successfully' });
    } catch (error) {
      console.error('Delete job error:', error);
      res.status(500).json({ error: 'Failed to delete job' });
    }
  }
);

// Get job statistics
router.get('/:id/stats', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const job = await prisma.job.findUnique({ where: { id } });
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const applicantsByStage = await prisma.applicant.groupBy({
      by: ['stage'],
      where: { jobId: id },
      _count: { id: true },
    });

    const totalApplicants = await prisma.applicant.count({ where: { jobId: id } });

    const reviewedCount = await prisma.applicant.count({
      where: {
        jobId: id,
        reviews: { some: {} },
      },
    });

    res.json({
      total: totalApplicants,
      reviewed: reviewedCount,
      byStage: applicantsByStage.reduce((acc, item) => {
        acc[item.stage] = item._count.id;
        return acc;
      }, {} as Record<string, number>),
    });
  } catch (error) {
    console.error('Get job stats error:', error);
    res.status(500).json({ error: 'Failed to fetch job statistics' });
  }
});

export default router;
