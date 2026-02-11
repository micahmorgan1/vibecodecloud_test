import { Router, Response } from 'express';
import prisma from '../db.js';
import { authenticate, requireRole, AuthRequest, getAccessibleJobIds } from '../middleware/auth.js';
import { formatJobForLinkedIn } from '../services/linkedInFormatter.js';
import { JOB_BOARD_PLATFORMS, getPlatformById, generateTrackingUrl } from '../services/jobBoardPlatforms.js';
import { generateUniqueSlug } from '../utils/slugify.js';
import { validateBody } from '../middleware/validateBody.js';
import { jobCreateSchema, jobUpdateSchema, linkedInStatusSchema, platformStatusSchema } from '../schemas/index.js';

const router = Router();

// Get all jobs (with optional filters)
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { status, department, type, archived } = req.query;

    const where: Record<string, unknown> = {};
    // Show archived jobs only if admin requests ?archived=true
    if (archived === 'true' && req.user!.role === 'admin') {
      where.archived = true;
    } else {
      where.archived = false;
    }
    if (status) where.status = status as string;
    if (department) where.department = department as string;
    if (type) where.type = type as string;

    // Reviewer access control: only see assigned jobs
    const accessibleJobIds = await getAccessibleJobIds(req.user!);
    if (accessibleJobIds !== null) {
      if (accessibleJobIds.length === 0) {
        return res.json([]);
      }
      where.id = { in: accessibleJobIds };
    }

    const jobs = await prisma.job.findMany({
      where,
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        office: true,
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

// Get all open jobs (public - no auth required)
router.get('/public', async (req, res) => {
  try {
    const { department, type, location } = req.query;

    const where: Record<string, unknown> = {
      status: 'open',
      archived: false,
    };

    if (department) where.department = department as string;
    if (type) where.type = type as string;
    if (location) where.location = location as string;

    const jobs = await prisma.job.findMany({
      where,
      select: {
        id: true,
        title: true,
        department: true,
        location: true,
        type: true,
        description: true,
        salary: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(jobs);
  } catch (error) {
    console.error('Get public jobs error:', error);
    res.status(500).json({ error: 'Failed to fetch jobs' });
  }
});

// Get open jobs published to the website (public - for WHLC website)
router.get('/website', async (_req, res) => {
  try {
    const jobs = await prisma.job.findMany({
      where: {
        status: 'open',
        publishToWebsite: true,
        archived: false,
      },
      select: {
        id: true,
        slug: true,
        title: true,
        department: true,
        location: true,
        type: true,
        description: true,
        responsibilities: true,
        requirements: true,
        benefits: true,
        salary: true,
        createdAt: true,
        office: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(jobs);
  } catch (error) {
    console.error('Get website jobs error:', error);
    res.status(500).json({ error: 'Failed to fetch jobs' });
  }
});

// Get single job by slug for the website (public)
router.get('/website/:slug', async (req, res) => {
  try {
    const { slug } = req.params;

    const job = await prisma.job.findUnique({
      where: { slug },
      select: {
        id: true,
        slug: true,
        title: true,
        department: true,
        location: true,
        type: true,
        description: true,
        responsibilities: true,
        requirements: true,
        benefits: true,
        salary: true,
        status: true,
        archived: true,
        createdAt: true,
        publishToWebsite: true,
        office: true,
      },
    });

    if (!job || job.status !== 'open' || !job.publishToWebsite || job.archived) {
      return res.status(404).json({ error: 'Job not found' });
    }

    res.json(job);
  } catch (error) {
    console.error('Get website job error:', error);
    res.status(500).json({ error: 'Failed to fetch job' });
  }
});

// Get single job by ID (public - no auth required for apply page)
router.get('/:id/public', async (req, res) => {
  try {
    const { id } = req.params;

    const job = await prisma.job.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        department: true,
        location: true,
        type: true,
        description: true,
        responsibilities: true,
        requirements: true,
        benefits: true,
        salary: true,
        status: true,
      },
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    res.json(job);
  } catch (error) {
    console.error('Get public job error:', error);
    res.status(500).json({ error: 'Failed to fetch job' });
  }
});

// Get single job by ID (authenticated - full details)
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Reviewer access control
    const accessibleJobIds = await getAccessibleJobIds(req.user!);
    if (accessibleJobIds !== null && !accessibleJobIds.includes(id)) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const job = await prisma.job.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        office: true,
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
  validateBody(jobCreateSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const { title, department, location, type, description, responsibilities, requirements, benefits, salary, slug: providedSlug, publishToWebsite, officeId } = req.body;

      // Auto-populate location from office if not explicitly provided
      let resolvedLocation = location;
      if (!resolvedLocation && officeId) {
        const office = await prisma.office.findUnique({ where: { id: officeId } });
        if (office) {
          resolvedLocation = `${office.city}, ${office.state}`;
        }
      }

      if (!resolvedLocation) {
        return res.status(400).json({ error: 'Location is required (provide directly or via office)' });
      }

      const slug = providedSlug
        ? providedSlug
        : await generateUniqueSlug(title);

      const job = await prisma.job.create({
        data: {
          title,
          slug,
          department,
          location: resolvedLocation,
          type,
          description,
          responsibilities: responsibilities || null,
          requirements,
          benefits: benefits || null,
          salary,
          publishToWebsite: publishToWebsite ?? false,
          officeId: officeId || null,
          createdById: req.user!.id,
        },
        include: {
          createdBy: {
            select: { id: true, name: true, email: true },
          },
          office: true,
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
  validateBody(jobUpdateSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { title, department, location, type, description, responsibilities, requirements, benefits, salary, status, slug, publishToWebsite, officeId } = req.body;

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
      if (responsibilities !== undefined) updateData.responsibilities = responsibilities || null;
      if (requirements) updateData.requirements = requirements;
      if (benefits !== undefined) updateData.benefits = benefits || null;
      if (salary !== undefined) updateData.salary = salary;
      if (slug !== undefined) updateData.slug = slug;
      if (publishToWebsite !== undefined) updateData.publishToWebsite = publishToWebsite;
      if (officeId !== undefined) {
        updateData.officeId = officeId || null;
        // Auto-update location if office changed and location not explicitly provided
        if (officeId && !location) {
          const office = await prisma.office.findUnique({ where: { id: officeId } });
          if (office) {
            updateData.location = `${office.city}, ${office.state}`;
          }
        }
      }
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
          office: true,
        },
      });

      res.json(job);
    } catch (error) {
      console.error('Update job error:', error);
      res.status(500).json({ error: 'Failed to update job' });
    }
  }
);

// Archive a job (admin only) — replaces hard delete
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

      await prisma.job.update({
        where: { id },
        data: {
          archived: true,
          archivedAt: new Date(),
          publishToWebsite: false,
        },
      });

      res.json({ message: 'Job archived successfully' });
    } catch (error) {
      console.error('Archive job error:', error);
      res.status(500).json({ error: 'Failed to archive job' });
    }
  }
);

// Unarchive a job (admin only)
router.patch(
  '/:id/unarchive',
  authenticate,
  requireRole('admin'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;

      const existingJob = await prisma.job.findUnique({ where: { id } });
      if (!existingJob) {
        return res.status(404).json({ error: 'Job not found' });
      }

      const job = await prisma.job.update({
        where: { id },
        data: {
          archived: false,
          archivedAt: null,
        },
        include: {
          createdBy: {
            select: { id: true, name: true, email: true },
          },
          office: true,
        },
      });

      res.json(job);
    } catch (error) {
      console.error('Unarchive job error:', error);
      res.status(500).json({ error: 'Failed to unarchive job' });
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

// Get LinkedIn preview for a job
router.get('/:id/linkedin-preview', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const job = await prisma.job.findUnique({
      where: { id },
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const linkedInPost = formatJobForLinkedIn(job, job.id);

    res.json({
      ...linkedInPost,
      currentlyPosted: job.postedToLinkedIn,
      postDate: job.linkedInPostDate,
      postUrl: job.linkedInPostUrl,
    });
  } catch (error) {
    console.error('LinkedIn preview error:', error);
    res.status(500).json({ error: 'Failed to generate LinkedIn preview' });
  }
});

// Update LinkedIn status for a job
router.patch(
  '/:id/linkedin-status',
  authenticate,
  requireRole('admin', 'hiring_manager'),
  validateBody(linkedInStatusSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { posted, postUrl } = req.body;

      const job = await prisma.job.update({
        where: { id },
        data: {
          postedToLinkedIn: posted,
          linkedInPostDate: posted ? new Date() : null,
          linkedInPostUrl: postUrl || null,
        },
      });

      res.json(job);
    } catch (error) {
      console.error('Update LinkedIn status error:', error);
      res.status(500).json({ error: 'Failed to update LinkedIn status' });
    }
  }
);

// Get all job board platforms with tracking URLs and status
router.get('/:id/platforms', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const job = await prisma.job.findUnique({
      where: { id },
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Build platform status for each job board
    const platforms = JOB_BOARD_PLATFORMS.map(platform => ({
      id: platform.id,
      name: platform.name,
      description: platform.description,
      color: platform.color,
      trackingUrl: generateTrackingUrl(platform, job.id),
      externalUrl: platform.externalUrl,
      posted: (job as Record<string, unknown>)[platform.postedField] as boolean || false,
      postDate: (job as Record<string, unknown>)[platform.postDateField] as Date | null,
      postUrl: (job as Record<string, unknown>)[platform.postUrlField] as string | null,
    }));

    res.json({ platforms });
  } catch (error) {
    console.error('Get platforms error:', error);
    res.status(500).json({ error: 'Failed to fetch platforms' });
  }
});

// Update platform posting status
router.patch(
  '/:id/platform-status',
  authenticate,
  requireRole('admin', 'hiring_manager'),
  validateBody(platformStatusSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { platformId, posted, postUrl } = req.body;

      const platform = getPlatformById(platformId);
      if (!platform) {
        return res.status(400).json({ error: 'Invalid platform ID' });
      }

      // Build update data dynamically based on platform
      const updateData: Record<string, unknown> = {
        [platform.postedField]: posted,
        [platform.postDateField]: posted ? new Date() : null,
        [platform.postUrlField]: postUrl || null,
      };

      const job = await prisma.job.update({
        where: { id },
        data: updateData,
      });

      res.json(job);
    } catch (error) {
      console.error('Update platform status error:', error);
      res.status(500).json({ error: 'Failed to update platform status' });
    }
  }
);

export default router;
