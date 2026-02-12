import { Router, Response, Request } from 'express';
import prisma from '../db.js';
import { authenticate, requireRole, AuthRequest, getAccessibleJobIds, getAccessibleApplicantFilter } from '../middleware/auth.js';
import { uploadApplicationFiles } from '../middleware/upload.js';
import { validateUploadedFiles } from '../middleware/validateFiles.js';
import { sendRejectionEmail, getTemplate, resolveTemplate, sendThankYouEmail, sendReviewerNotification } from '../services/email.js';
import { checkSpam } from '../services/spamDetection.js';
import { checkApplicantUrls } from '../services/urlSafety.js';
import { validateBody } from '../middleware/validateBody.js';
import {
  publicApplicantSchema,
  manualApplicantSchema,
  applicantUpdateSchema,
  stageUpdateSchema,
  rejectionEmailSchema,
  assignJobSchema,
  noteSchema,
  confirmSpamSchema,
  bulkDeleteSchema,
  bulkMarkSpamSchema,
  bulkStageSchema,
} from '../schemas/index.js';
import { deleteUploadedFiles } from '../utils/deleteUploadedFiles.js';
import { formatCsvRow } from '../utils/csv.js';
import { parsePagination, prismaSkipTake, paginatedResponse } from '../utils/pagination.js';
import logger from '../lib/logger.js';
import { logActivity } from '../services/activityLog.js';
import { notifySubscribers } from '../services/notifications.js';

const router = Router();

// Get all applicants (with filters)
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { jobId, stage, search, eventId, spam } = req.query;

    // Access control: compound filter for job + event access
    const accessFilter = await getAccessibleApplicantFilter(req.user!);
    if (accessFilter.id === 'none') {
      return res.json([]);
    }

    const conditions: Record<string, unknown>[] = [];
    if (accessFilter.OR) conditions.push(accessFilter);

    // Spam filter: default to non-spam
    if (spam === 'true') {
      conditions.push({ spam: true });
    } else if (spam === 'all') {
      // no spam filter
    } else {
      conditions.push({ spam: false });
    }

    if (jobId) conditions.push({ jobId: jobId as string });
    if (eventId) conditions.push({ eventId: eventId as string });
    if (stage) conditions.push({ stage: stage as string });
    if (search) {
      conditions.push({
        OR: [
          { firstName: { contains: search as string } },
          { lastName: { contains: search as string } },
          { email: { contains: search as string } },
        ],
      });
    }

    const where = conditions.length > 0 ? { AND: conditions } : {};

    const includeClause = {
      job: {
        select: { id: true, title: true, department: true, archived: true },
      },
      event: {
        select: { id: true, name: true },
      },
      reviews: {
        include: {
          reviewer: {
            select: { id: true, name: true },
          },
        },
      },
      interviews: {
        select: { id: true, scheduledAt: true, status: true, type: true },
        orderBy: { scheduledAt: 'desc' as const },
        take: 1,
      },
      offers: {
        select: { id: true, status: true, createdAt: true },
        orderBy: { createdAt: 'desc' as const },
        take: 1,
      },
      _count: {
        select: { reviews: true, notes: true },
      },
    };

    const pagination = parsePagination(req.query);

    if (pagination) {
      const [applicants, total] = await Promise.all([
        prisma.applicant.findMany({
          where,
          include: includeClause,
          orderBy: { createdAt: 'desc' },
          ...prismaSkipTake(pagination),
        }),
        prisma.applicant.count({ where }),
      ]);
      return res.json(paginatedResponse(applicants, total, pagination));
    }

    const applicants = await prisma.applicant.findMany({
      where,
      include: includeClause,
      orderBy: { createdAt: 'desc' },
    });

    res.json(applicants);
  } catch (error) {
    logger.error({ err: error }, 'Get applicants error');
    res.status(500).json({ error: 'Failed to fetch applicants' });
  }
});

// Export applicants as CSV (admin/hiring_manager)
router.get('/export', authenticate, requireRole('admin', 'hiring_manager'), async (req: AuthRequest, res: Response) => {
  try {
    const { jobId, stage, search, eventId, spam } = req.query;

    const accessFilter = await getAccessibleApplicantFilter(req.user!);
    const conditions: Record<string, unknown>[] = [];
    if (accessFilter.OR) conditions.push(accessFilter);

    if (spam === 'true') {
      conditions.push({ spam: true });
    } else if (spam === 'all') {
      // no spam filter
    } else {
      conditions.push({ spam: false });
    }

    if (jobId) conditions.push({ jobId: jobId as string });
    if (eventId) conditions.push({ eventId: eventId as string });
    if (stage) conditions.push({ stage: stage as string });
    if (search) {
      conditions.push({
        OR: [
          { firstName: { contains: search as string } },
          { lastName: { contains: search as string } },
          { email: { contains: search as string } },
        ],
      });
    }

    const where = conditions.length > 0 ? { AND: conditions } : {};

    const applicants = await prisma.applicant.findMany({
      where,
      include: {
        job: { select: { title: true } },
        event: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const today = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="applicants-${today}.csv"`);

    const header = formatCsvRow(['Name', 'Email', 'Phone', 'Job', 'Stage', 'Event', 'Source', 'Created', 'Updated']);
    const rows = applicants.map((a) =>
      formatCsvRow([
        `${a.firstName} ${a.lastName}`,
        a.email,
        a.phone,
        a.job?.title || 'General Application',
        a.stage,
        a.event?.name || '',
        a.source || '',
        new Date(a.createdAt).toISOString(),
        new Date(a.updatedAt).toISOString(),
      ])
    );

    res.send([header, ...rows].join('\n'));
  } catch (error) {
    logger.error({ err: error }, 'Export CSV error');
    res.status(500).json({ error: 'Failed to export applicants' });
  }
});

// Check for duplicate applicants by email (pre-creation)
router.post('/check-duplicates', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { email, excludeId } = req.body;
    if (!email) {
      return res.json([]);
    }

    const where: Record<string, unknown> = { email: email.toLowerCase() };
    if (excludeId) {
      where.id = { not: excludeId };
    }

    const matches = await prisma.applicant.findMany({
      where,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        stage: true,
        createdAt: true,
        job: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    res.json(matches);
  } catch (error) {
    logger.error({ err: error }, 'Check duplicates error');
    res.status(500).json({ error: 'Failed to check duplicates' });
  }
});

// Get activity log for an applicant
router.get('/:id/activity', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Access control
    const accessFilter = await getAccessibleApplicantFilter(req.user!);
    if (accessFilter.id === 'none') {
      return res.status(404).json({ error: 'Applicant not found' });
    }
    const accessCheck = await prisma.applicant.findFirst({ where: { id, ...accessFilter } });
    if (!accessCheck) {
      return res.status(404).json({ error: 'Applicant not found' });
    }

    const pagination = parsePagination(req.query);

    const where = { applicantId: id };
    const include = { user: { select: { id: true, name: true } } };

    if (pagination) {
      const [logs, total] = await Promise.all([
        prisma.activityLog.findMany({
          where,
          include,
          orderBy: { createdAt: 'desc' },
          ...prismaSkipTake(pagination),
        }),
        prisma.activityLog.count({ where }),
      ]);
      return res.json(paginatedResponse(logs, total, pagination));
    }

    const logs = await prisma.activityLog.findMany({
      where,
      include,
      orderBy: { createdAt: 'desc' },
    });

    res.json(logs);
  } catch (error) {
    logger.error({ err: error }, 'Get activity log error');
    res.status(500).json({ error: 'Failed to fetch activity log' });
  }
});

// Get duplicate applicants (same email, different record)
router.get('/:id/duplicates', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Access control
    const accessFilter = await getAccessibleApplicantFilter(req.user!);
    if (accessFilter.id === 'none') {
      return res.status(404).json({ error: 'Applicant not found' });
    }
    const applicant = await prisma.applicant.findFirst({ where: { id, ...accessFilter } });
    if (!applicant) {
      return res.status(404).json({ error: 'Applicant not found' });
    }

    const duplicates = await prisma.applicant.findMany({
      where: { email: applicant.email, id: { not: id } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        stage: true,
        createdAt: true,
        job: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    res.json(duplicates);
  } catch (error) {
    logger.error({ err: error }, 'Get duplicates error');
    res.status(500).json({ error: 'Failed to fetch duplicates' });
  }
});

// Get single applicant
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Access control check
    const accessFilter = await getAccessibleApplicantFilter(req.user!);
    if (accessFilter.id === 'none') {
      return res.status(404).json({ error: 'Applicant not found' });
    }
    const accessCheck = await prisma.applicant.findFirst({ where: { id, ...accessFilter } });
    if (!accessCheck) {
      return res.status(404).json({ error: 'Applicant not found' });
    }

    const applicant = await prisma.applicant.findUnique({
      where: { id },
      include: {
        job: {
          select: { id: true, title: true, department: true, location: true },
        },
        event: {
          select: { id: true, name: true },
        },
        reviews: {
          include: {
            reviewer: {
              select: { id: true, name: true, email: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        notes: {
          orderBy: { createdAt: 'desc' },
        },
        interviews: {
          include: {
            participants: {
              include: { user: { select: { id: true, name: true, email: true } } },
            },
            createdBy: { select: { id: true, name: true } },
          },
          orderBy: { scheduledAt: 'desc' },
        },
        offers: {
          include: {
            createdBy: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    res.json(applicant);
  } catch (error) {
    logger.error({ err: error }, 'Get applicant error');
    res.status(500).json({ error: 'Failed to fetch applicant' });
  }
});

// Create applicant (public endpoint for job applications)
router.post('/', uploadApplicationFiles, validateUploadedFiles, validateBody(publicApplicantSchema), async (req: Request, res: Response) => {
  try {
    const {
      jobId,
      firstName,
      lastName,
      email,
      phone,
      linkedIn,
      website,
      portfolioUrl,
      coverLetter,
      source,
      sourceDetails,
      referrer,
      utmSource,
      utmMedium,
      utmCampaign,
      utmContent,
      website2,
    } = req.body;

    // Spam detection
    const spamResult = await checkSpam({ firstName, lastName, email, coverLetter, website2 }, req);

    let job: { id: string; title: string; status: string; department: string; officeId: string | null } | null = null;

    if (jobId) {
      // Verify job exists and is open
      job = await prisma.job.findUnique({ where: { id: jobId }, select: { id: true, title: true, status: true, department: true, officeId: true } });
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }
      if (job.status !== 'open') {
        return res.status(400).json({ error: 'This job is no longer accepting applications' });
      }

      // Check for duplicate application
      const existingApplication = await prisma.applicant.findFirst({
        where: { jobId, email },
      });
      if (existingApplication) {
        return res.status(400).json({ error: 'You have already applied for this position' });
      }
    }

    // Get uploaded file paths
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const resumePath = files?.resume?.[0]?.filename ? `/uploads/resumes/${files.resume[0].filename}` : null;
    const portfolioPath = files?.portfolio?.[0]?.filename ? `/uploads/portfolios/${files.portfolio[0].filename}` : null;

    const applicant = await prisma.applicant.create({
      data: {
        jobId: jobId || null,
        firstName,
        lastName,
        email,
        phone,
        linkedIn,
        website,
        portfolioUrl,
        coverLetter,
        source: source || (jobId ? 'Direct Application' : 'General Application'),
        sourceDetails,
        referrer,
        utmSource,
        utmMedium,
        utmCampaign,
        utmContent,
        resumePath,
        portfolioPath,
        spam: spamResult.isSpam,
        spamReason: spamResult.isSpam ? spamResult.reasons.join('; ') : null,
      },
      include: {
        job: {
          select: { id: true, title: true },
        },
      },
    });

    const jobTitle = job?.title || 'General Application';

    logActivity('applicant_created', {
      applicantId: applicant.id,
      metadata: { source: 'public', jobId: jobId || null, spam: spamResult.isSpam },
    });

    // Only send emails for non-spam submissions
    if (!spamResult.isSpam) {
      // Fire-and-forget: thank-you auto-responder
      (async () => {
        try {
          const template = await getTemplate('thank_you');
          const variables = { firstName, lastName, jobTitle };
          const subject = resolveTemplate(template.subject, variables);
          const body = resolveTemplate(template.body, variables);
          await sendThankYouEmail({ to: email, applicantName: `${firstName} ${lastName}`, subject, body });
        } catch (err) {
          logger.error({ err }, 'Thank-you email failed');
        }
      })();

      // Fire-and-forget: notify users subscribed to this job's notifications (skip for general pool)
      if (jobId) {
        (async () => {
          try {
            const subscribers = await prisma.jobNotificationSub.findMany({
              where: { jobId },
              include: { user: { select: { name: true, email: true } } },
            });
            for (const sub of subscribers) {
              await sendReviewerNotification({
                to: sub.user.email,
                reviewerName: sub.user.name,
                applicantName: `${firstName} ${lastName}`,
                applicantId: applicant.id,
                jobTitle,
              });
            }
          } catch (err) {
            logger.error({ err }, 'Subscriber notification failed');
          }
        })();
      }

      // Fire-and-forget: in-app notifications for subscribers (job, department, office)
      notifySubscribers({
        jobId: jobId || null,
        department: job?.department,
        officeId: job?.officeId,
        type: 'new_application',
        title: 'New Application',
        message: `${firstName} ${lastName} applied for ${jobTitle}`,
        link: `/applicants/${applicant.id}`,
      });
    }

    // Fire-and-forget: URL safety check
    const urls = [linkedIn, website, portfolioUrl].filter(Boolean) as string[];
    if (urls.length > 0) {
      checkApplicantUrls(applicant.id, urls);
    }

    res.status(201).json(applicant);
  } catch (error) {
    logger.error({ err: error }, 'Create applicant error');
    res.status(500).json({ error: 'Failed to submit application' });
  }
});

// Manually add applicant (admin, hiring_manager, or assigned reviewer)
router.post(
  '/manual',
  authenticate,
  uploadApplicationFiles,
  validateUploadedFiles,
  validateBody(manualApplicantSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const {
        jobId,
        firstName,
        lastName,
        email,
        phone,
        linkedIn,
        website,
        portfolioUrl,
        coverLetter,
        source,
      } = req.body;

      // Get uploaded file paths
      const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
      const resumePath = files?.resume?.[0]?.filename ? `/uploads/resumes/${files.resume[0].filename}` : null;
      const portfolioPath = files?.portfolio?.[0]?.filename ? `/uploads/portfolios/${files.portfolio[0].filename}` : null;

      // Check permissions: admin/hiring_manager always allowed, reviewer only if assigned to job or event
      if (req.user!.role === 'reviewer') {
        if (!jobId) {
          return res.status(403).json({ error: 'Insufficient permissions' });
        }
        const accessibleJobIds = await getAccessibleJobIds(req.user!);
        if (accessibleJobIds !== null && !accessibleJobIds.includes(jobId)) {
          return res.status(403).json({ error: 'Insufficient permissions' });
        }
      } else if (req.user!.role !== 'admin' && req.user!.role !== 'hiring_manager') {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      if (jobId) {
        const job = await prisma.job.findUnique({ where: { id: jobId } });
        if (!job) {
          return res.status(404).json({ error: 'Job not found' });
        }

        const existingApplication = await prisma.applicant.findFirst({
          where: { jobId, email },
        });
        if (existingApplication) {
          return res.status(400).json({ error: 'An applicant with this email already exists for this job' });
        }
      }

      const applicant = await prisma.applicant.create({
        data: {
          jobId: jobId || null,
          firstName,
          lastName,
          email,
          phone: phone || null,
          linkedIn: linkedIn || null,
          website: website || null,
          portfolioUrl: portfolioUrl || null,
          coverLetter: coverLetter || null,
          source: source || 'manual',
          resumePath,
          portfolioPath,
        },
        include: {
          job: {
            select: { id: true, title: true, department: true },
          },
        },
      });

      logActivity('applicant_created', {
        applicantId: applicant.id,
        userId: req.user!.id,
        metadata: { source: 'manual', jobId: jobId || null },
      });

      // Fire-and-forget: URL safety check
      const urls = [linkedIn, website, portfolioUrl].filter(Boolean) as string[];
      if (urls.length > 0) {
        checkApplicantUrls(applicant.id, urls);
      }

      res.status(201).json(applicant);
    } catch (error) {
      logger.error({ err: error }, 'Manual add applicant error');
      res.status(500).json({ error: 'Failed to add applicant' });
    }
  }
);

// Mark applicant as spam (admin/hiring_manager)
router.patch(
  '/:id/mark-spam',
  authenticate,
  requireRole('admin', 'hiring_manager'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;

      const existing = await prisma.applicant.findUnique({ where: { id } });
      if (!existing) {
        return res.status(404).json({ error: 'Applicant not found' });
      }

      const applicant = await prisma.applicant.update({
        where: { id },
        data: { spam: true, spamReason: `Manually flagged by ${req.user!.email}` },
        include: {
          job: { select: { id: true, title: true, department: true, location: true } },
          event: { select: { id: true, name: true } },
          reviews: {
            include: { reviewer: { select: { id: true, name: true, email: true } } },
            orderBy: { createdAt: 'desc' },
          },
          notes: { orderBy: { createdAt: 'desc' } },
        },
      });

      await prisma.note.create({
        data: { applicantId: id, content: `Manually flagged as spam by ${req.user!.email}` },
      });

      logActivity('marked_spam', { applicantId: id, userId: req.user!.id });

      res.json(applicant);
    } catch (error) {
      logger.error({ err: error }, 'Mark spam error');
      res.status(500).json({ error: 'Failed to mark as spam' });
    }
  }
);

// Bulk mark applicants as spam (admin/hiring_manager)
router.post(
  '/bulk-mark-spam',
  authenticate,
  requireRole('admin', 'hiring_manager'),
  validateBody(bulkMarkSpamSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const { ids } = req.body;

      const result = await prisma.$transaction(async (tx) => {
        const updated = await tx.applicant.updateMany({
          where: { id: { in: ids }, spam: false },
          data: { spam: true, spamReason: `Manually flagged by ${req.user!.email}` },
        });

        // Create notes for each applicant
        await tx.note.createMany({
          data: ids.map((applicantId: string) => ({
            applicantId,
            content: `Manually flagged as spam by ${req.user!.email}`,
          })),
        });

        return updated;
      });

      res.json({ message: `${result.count} applicant(s) marked as spam` });
    } catch (error) {
      logger.error({ err: error }, 'Bulk mark spam error');
      res.status(500).json({ error: 'Failed to mark applicants as spam' });
    }
  }
);

// Bulk stage change (admin/hiring_manager)
router.post(
  '/bulk-stage',
  authenticate,
  requireRole('admin', 'hiring_manager'),
  validateBody(bulkStageSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const { ids, stage } = req.body;

      const result = await prisma.$transaction(async (tx) => {
        // Get current stages for logging
        const applicants = await tx.applicant.findMany({
          where: { id: { in: ids } },
          select: { id: true, stage: true },
        });

        const updated = await tx.applicant.updateMany({
          where: { id: { in: ids } },
          data: { stage },
        });

        // Log activity for each applicant
        await tx.activityLog.createMany({
          data: applicants.map((a) => ({
            action: 'stage_changed',
            applicantId: a.id,
            userId: req.user!.id,
            metadata: JSON.stringify({ from: a.stage, to: stage, bulk: true }),
          })),
        });

        return updated;
      });

      res.json({ updated: result.count });
    } catch (error) {
      logger.error({ err: error }, 'Bulk stage change error');
      res.status(500).json({ error: 'Failed to update stages' });
    }
  }
);

// Delete all spam applicants (admin/hiring_manager)
router.delete(
  '/spam',
  authenticate,
  requireRole('admin', 'hiring_manager'),
  async (_req: AuthRequest, res: Response) => {
    try {
      const spamApplicants = await prisma.applicant.findMany({
        where: { spam: true },
        select: { id: true, resumePath: true, portfolioPath: true },
      });

      if (spamApplicants.length === 0) {
        return res.json({ message: '0 spam applicants deleted', count: 0 });
      }

      const ids = spamApplicants.map((a) => a.id);

      // Collect offer file paths before deletion
      const offerFiles = await prisma.offer.findMany({
        where: { applicantId: { in: ids } },
        select: { filePath: true },
      });

      await prisma.$transaction(async (tx) => {
        await tx.activityLog.deleteMany({ where: { applicantId: { in: ids } } });
        await tx.interviewParticipant.deleteMany({ where: { interview: { applicantId: { in: ids } } } });
        await tx.interview.deleteMany({ where: { applicantId: { in: ids } } });
        await tx.offer.deleteMany({ where: { applicantId: { in: ids } } });
        await tx.review.deleteMany({ where: { applicantId: { in: ids } } });
        await tx.note.deleteMany({ where: { applicantId: { in: ids } } });
        await tx.applicant.deleteMany({ where: { id: { in: ids } } });
      });

      // Fire-and-forget: clean up uploaded files
      const filePaths = [
        ...spamApplicants.flatMap((a) => [a.resumePath, a.portfolioPath]),
        ...offerFiles.map((o) => o.filePath),
      ];
      deleteUploadedFiles(filePaths).catch(() => {});

      res.json({ message: `${spamApplicants.length} spam applicant(s) deleted`, count: spamApplicants.length });
    } catch (error) {
      logger.error({ err: error }, 'Delete all spam error');
      res.status(500).json({ error: 'Failed to delete spam applicants' });
    }
  }
);

// Bulk delete applicants by IDs (admin/hiring_manager)
router.post(
  '/bulk-delete',
  authenticate,
  requireRole('admin', 'hiring_manager'),
  validateBody(bulkDeleteSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const { ids } = req.body;

      const applicants = await prisma.applicant.findMany({
        where: { id: { in: ids } },
        select: { id: true, resumePath: true, portfolioPath: true },
      });

      const foundIds = applicants.map((a) => a.id);

      // Collect offer file paths before deletion
      const offerFiles = await prisma.offer.findMany({
        where: { applicantId: { in: foundIds } },
        select: { filePath: true },
      });

      await prisma.$transaction(async (tx) => {
        await tx.activityLog.deleteMany({ where: { applicantId: { in: foundIds } } });
        await tx.interviewParticipant.deleteMany({ where: { interview: { applicantId: { in: foundIds } } } });
        await tx.interview.deleteMany({ where: { applicantId: { in: foundIds } } });
        await tx.offer.deleteMany({ where: { applicantId: { in: foundIds } } });
        await tx.review.deleteMany({ where: { applicantId: { in: foundIds } } });
        await tx.note.deleteMany({ where: { applicantId: { in: foundIds } } });
        await tx.applicant.deleteMany({ where: { id: { in: foundIds } } });
      });

      // Fire-and-forget: clean up uploaded files
      const filePaths = [
        ...applicants.flatMap((a) => [a.resumePath, a.portfolioPath]),
        ...offerFiles.map((o) => o.filePath),
      ];
      deleteUploadedFiles(filePaths).catch(() => {});

      res.json({ message: `${foundIds.length} applicant(s) deleted`, count: foundIds.length });
    } catch (error) {
      logger.error({ err: error }, 'Bulk delete error');
      res.status(500).json({ error: 'Failed to delete applicants' });
    }
  }
);

// Update applicant stage (workflow)
router.patch('/:id/stage', authenticate, validateBody(stageUpdateSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { stage } = req.body;

    // Access control
    const accessFilter = await getAccessibleApplicantFilter(req.user!);
    const existing = await prisma.applicant.findFirst({ where: { id, ...accessFilter } });
    if (!existing) {
      return res.status(404).json({ error: 'Applicant not found' });
    }

    const applicant = await prisma.applicant.update({
      where: { id },
      data: { stage },
      include: {
        job: {
          select: { id: true, title: true, department: true, officeId: true },
        },
      },
    });

    logActivity('stage_changed', {
      applicantId: id,
      userId: req.user!.id,
      metadata: { from: existing.stage, to: stage },
    });

    // Fire-and-forget: in-app notification for stage change
    notifySubscribers({
      jobId: applicant.job?.id || null,
      department: applicant.job?.department,
      officeId: applicant.job?.officeId,
      type: 'stage_changed',
      title: 'Stage Changed',
      message: `${applicant.firstName} ${applicant.lastName} moved to ${stage}`,
      link: `/applicants/${id}`,
      excludeUserId: req.user!.id,
    });

    res.json(applicant);
  } catch (error) {
    logger.error({ err: error }, 'Update stage error');
    res.status(500).json({ error: 'Failed to update applicant stage' });
  }
});

// Update applicant details
router.put('/:id', authenticate, uploadApplicationFiles, validateUploadedFiles, validateBody(applicantUpdateSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const {
      firstName,
      lastName,
      email,
      phone,
      linkedIn,
      website,
      portfolioUrl,
      coverLetter,
      source,
      startDate,
    } = req.body;

    // Access control
    const accessFilter = await getAccessibleApplicantFilter(req.user!);
    const existing = await prisma.applicant.findFirst({ where: { id, ...accessFilter } });
    if (!existing) {
      return res.status(404).json({ error: 'Applicant not found' });
    }

    const updateData: Record<string, unknown> = {};
    if (firstName) updateData.firstName = firstName;
    if (lastName) updateData.lastName = lastName;
    if (email) updateData.email = email;
    if (phone !== undefined) updateData.phone = phone;
    if (linkedIn !== undefined) updateData.linkedIn = linkedIn;
    if (website !== undefined) updateData.website = website;
    if (portfolioUrl !== undefined) updateData.portfolioUrl = portfolioUrl;
    if (coverLetter !== undefined) updateData.coverLetter = coverLetter;
    if (source !== undefined) updateData.source = source;
    if (startDate !== undefined) updateData.startDate = startDate ? new Date(startDate) : null;

    // Handle uploaded files
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    if (files?.resume?.[0]?.filename) {
      updateData.resumePath = `/uploads/resumes/${files.resume[0].filename}`;
    }
    if (files?.portfolio?.[0]?.filename) {
      updateData.portfolioPath = `/uploads/portfolios/${files.portfolio[0].filename}`;
    }

    const applicant = await prisma.applicant.update({
      where: { id },
      data: updateData,
      include: {
        job: { select: { id: true, title: true, department: true, location: true } },
        event: { select: { id: true, name: true } },
        reviews: {
          include: { reviewer: { select: { id: true, name: true, email: true } } },
          orderBy: { createdAt: 'desc' },
        },
        notes: { orderBy: { createdAt: 'desc' } },
      },
    });

    logActivity('applicant_updated', {
      applicantId: id,
      userId: req.user!.id,
    });

    // Fire-and-forget: URL safety check on updated URLs
    const urls = [linkedIn, website, portfolioUrl].filter(Boolean) as string[];
    if (urls.length > 0) {
      checkApplicantUrls(id, urls);
    }

    res.json(applicant);
  } catch (error) {
    logger.error({ err: error }, 'Update applicant error');
    res.status(500).json({ error: 'Failed to update applicant' });
  }
});

// Add note to applicant
router.post('/:id/notes', authenticate, validateBody(noteSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { content } = req.body;

    // Access control
    const accessFilter = await getAccessibleApplicantFilter(req.user!);
    const applicant = await prisma.applicant.findFirst({ where: { id, ...accessFilter } });
    if (!applicant) {
      return res.status(404).json({ error: 'Applicant not found' });
    }

    const note = await prisma.note.create({
      data: {
        applicantId: id,
        content,
      },
    });

    logActivity('note_added', { applicantId: id, userId: req.user!.id });

    res.status(201).json(note);
  } catch (error) {
    logger.error({ err: error }, 'Add note error');
    res.status(500).json({ error: 'Failed to add note' });
  }
});

// Get applicant notes
router.get('/:id/notes', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Access control
    const accessFilter = await getAccessibleApplicantFilter(req.user!);
    const applicant = await prisma.applicant.findFirst({ where: { id, ...accessFilter } });
    if (!applicant) {
      return res.status(404).json({ error: 'Applicant not found' });
    }

    const notes = await prisma.note.findMany({
      where: { applicantId: id },
      orderBy: { createdAt: 'desc' },
    });

    res.json(notes);
  } catch (error) {
    logger.error({ err: error }, 'Get notes error');
    res.status(500).json({ error: 'Failed to fetch notes' });
  }
});

// Send rejection email
router.post('/:id/send-rejection', authenticate, validateBody(rejectionEmailSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { emailBody } = req.body;

    // Access control
    const accessFilter = await getAccessibleApplicantFilter(req.user!);
    const accessCheck = await prisma.applicant.findFirst({ where: { id, ...accessFilter } });
    if (!accessCheck) {
      return res.status(404).json({ error: 'Applicant not found' });
    }

    const applicant = await prisma.applicant.findUnique({
      where: { id },
      include: { job: { select: { title: true } } },
    });

    if (!applicant) {
      return res.status(404).json({ error: 'Applicant not found' });
    }

    // Send the rejection email (mock in staging)
    await sendRejectionEmail({
      to: applicant.email,
      applicantName: `${applicant.firstName} ${applicant.lastName}`,
      jobTitle: applicant.job?.title || 'General Application',
      emailBody,
    });

    // Update stage to rejected and add a note
    const now = new Date();
    await Promise.all([
      prisma.applicant.update({
        where: { id },
        data: { stage: 'rejected' },
        include: {
          job: {
            select: { id: true, title: true, department: true, location: true },
          },
          reviews: {
            include: {
              reviewer: {
                select: { id: true, name: true, email: true },
              },
            },
            orderBy: { createdAt: 'desc' },
          },
          notes: {
            orderBy: { createdAt: 'desc' },
          },
        },
      }),
      prisma.note.create({
        data: {
          applicantId: id,
          content: `Rejection letter sent on ${now.toLocaleString()}`,
        },
      }),
    ]);

    // Re-fetch to include the new note
    const result = await prisma.applicant.findUnique({
      where: { id },
      include: {
        job: {
          select: { id: true, title: true, department: true, location: true },
        },
        reviews: {
          include: {
            reviewer: {
              select: { id: true, name: true, email: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        notes: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    res.json(result);
  } catch (error) {
    logger.error({ err: error }, 'Send rejection error');
    res.status(500).json({ error: 'Failed to send rejection email' });
  }
});

// Assign or reassign applicant to a job (admin/hiring_manager only)
router.patch(
  '/:id/assign-job',
  authenticate,
  requireRole('admin', 'hiring_manager'),
  validateBody(assignJobSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { jobId } = req.body;

      const applicant = await prisma.applicant.findUnique({
        where: { id },
        include: { job: { select: { title: true } } },
      });
      if (!applicant) {
        return res.status(404).json({ error: 'Applicant not found' });
      }

      const oldJobTitle = applicant.job?.title || 'General Pool';

      if (jobId) {
        // Validate target job
        const targetJob = await prisma.job.findUnique({ where: { id: jobId } });
        if (!targetJob) {
          return res.status(404).json({ error: 'Target job not found' });
        }
        if (targetJob.archived) {
          return res.status(400).json({ error: 'Cannot assign to an archived job' });
        }

        // Check for duplicate email in target job
        if (applicant.jobId !== jobId) {
          const existing = await prisma.applicant.findFirst({
            where: { jobId, email: applicant.email },
          });
          if (existing) {
            return res.status(400).json({ error: 'This applicant already has an application for the target job' });
          }
        }

        const newJobTitle = targetJob.title;
        await Promise.all([
          prisma.applicant.update({
            where: { id },
            data: { jobId },
          }),
          prisma.note.create({
            data: {
              applicantId: id,
              content: `Reassigned from "${oldJobTitle}" to "${newJobTitle}" by ${req.user!.email}`,
            },
          }),
        ]);
      } else {
        // Unassign — move to general pool
        await Promise.all([
          prisma.applicant.update({
            where: { id },
            data: { jobId: null },
          }),
          prisma.note.create({
            data: {
              applicantId: id,
              content: `Moved to General Pool from "${oldJobTitle}" by ${req.user!.email}`,
            },
          }),
        ]);
      }

      logActivity('job_assigned', {
        applicantId: id,
        userId: req.user!.id,
        metadata: { fromJobId: applicant.jobId || null, toJobId: jobId || null },
      });

      // Re-fetch full applicant
      const updated = await prisma.applicant.findUnique({
        where: { id },
        include: {
          job: {
            select: { id: true, title: true, department: true, location: true },
          },
          reviews: {
            include: {
              reviewer: {
                select: { id: true, name: true, email: true },
              },
            },
            orderBy: { createdAt: 'desc' },
          },
          notes: {
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      res.json(updated);
    } catch (error) {
      logger.error({ err: error }, 'Assign job error');
      res.status(500).json({ error: 'Failed to assign job' });
    }
  }
);

// Mark applicant as not spam
router.patch(
  '/:id/mark-not-spam',
  authenticate,
  requireRole('admin', 'hiring_manager'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;

      const existing = await prisma.applicant.findUnique({
        where: { id },
        include: { job: { select: { id: true, title: true } } },
      });
      if (!existing) {
        return res.status(404).json({ error: 'Applicant not found' });
      }

      const applicant = await prisma.applicant.update({
        where: { id },
        data: { spam: false, spamReason: null },
        include: {
          job: { select: { id: true, title: true, department: true, location: true } },
          event: { select: { id: true, name: true } },
          reviews: {
            include: { reviewer: { select: { id: true, name: true, email: true } } },
            orderBy: { createdAt: 'desc' },
          },
          notes: { orderBy: { createdAt: 'desc' } },
        },
      });

      await prisma.note.create({
        data: { applicantId: id, content: `Marked as not spam by ${req.user!.email}` },
      });

      logActivity('unmarked_spam', { applicantId: id, userId: req.user!.id });

      const jobTitle = existing.job?.title || 'General Application';
      const { firstName, lastName, email } = existing;

      // Fire-and-forget: send previously-suppressed thank-you email
      (async () => {
        try {
          const template = await getTemplate('thank_you');
          const variables = { firstName, lastName, jobTitle };
          const subject = resolveTemplate(template.subject, variables);
          const body = resolveTemplate(template.body, variables);
          await sendThankYouEmail({ to: email, applicantName: `${firstName} ${lastName}`, subject, body });
        } catch (err) {
          logger.error({ err }, 'Thank-you email failed');
        }
      })();

      // Fire-and-forget: send previously-suppressed subscriber notifications
      if (existing.jobId) {
        (async () => {
          try {
            const subscribers = await prisma.jobNotificationSub.findMany({
              where: { jobId: existing.jobId! },
              include: { user: { select: { name: true, email: true } } },
            });
            for (const sub of subscribers) {
              await sendReviewerNotification({
                to: sub.user.email,
                reviewerName: sub.user.name,
                applicantName: `${firstName} ${lastName}`,
                applicantId: id,
                jobTitle,
              });
            }
          } catch (err) {
            logger.error({ err }, 'Subscriber notification failed');
          }
        })();
      }

      // Re-fetch to include the new note
      const updated = await prisma.applicant.findUnique({
        where: { id },
        include: {
          job: { select: { id: true, title: true, department: true, location: true } },
          event: { select: { id: true, name: true } },
          reviews: {
            include: { reviewer: { select: { id: true, name: true, email: true } } },
            orderBy: { createdAt: 'desc' },
          },
          notes: { orderBy: { createdAt: 'desc' } },
        },
      });

      res.json(updated);
    } catch (error) {
      logger.error({ err: error }, 'Mark not spam error');
      res.status(500).json({ error: 'Failed to update applicant' });
    }
  }
);

// Confirm applicant as spam (with email/domain blocklist)
router.patch(
  '/:id/confirm-spam',
  authenticate,
  requireRole('admin', 'hiring_manager'),
  validateBody(confirmSpamSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { blockDomain } = req.body;

      const existing = await prisma.applicant.findUnique({ where: { id } });
      if (!existing) {
        return res.status(404).json({ error: 'Applicant not found' });
      }

      const emailLower = existing.email.toLowerCase();
      const domain = emailLower.split('@')[1];

      // Always block the exact email address
      await prisma.blockedEmail.upsert({
        where: { type_value: { type: 'email', value: emailLower } },
        update: {},
        create: { type: 'email', value: emailLower, createdById: req.user!.id },
      });

      let noteText = `Confirmed as spam by ${req.user!.email}. Blocked email: ${emailLower}`;

      // Optionally block the entire domain
      if (blockDomain && domain) {
        await prisma.blockedEmail.upsert({
          where: { type_value: { type: 'domain', value: domain } },
          update: {},
          create: { type: 'domain', value: domain, createdById: req.user!.id },
        });
        noteText += `. Blocked domain: @${domain}`;
      }

      await prisma.note.create({
        data: { applicantId: id, content: noteText },
      });

      logActivity('spam_confirmed', { applicantId: id, userId: req.user!.id });

      const applicant = await prisma.applicant.findUnique({
        where: { id },
        include: {
          job: { select: { id: true, title: true, department: true, location: true } },
          event: { select: { id: true, name: true } },
          reviews: {
            include: { reviewer: { select: { id: true, name: true, email: true } } },
            orderBy: { createdAt: 'desc' },
          },
          notes: { orderBy: { createdAt: 'desc' } },
        },
      });

      res.json(applicant);
    } catch (error) {
      logger.error({ err: error }, 'Confirm spam error');
      res.status(500).json({ error: 'Failed to update applicant' });
    }
  }
);

// Delete applicant (admin or hiring_manager only)
router.delete('/:id', authenticate, requireRole('admin', 'hiring_manager'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const applicant = await prisma.applicant.findUnique({ where: { id } });
    if (!applicant) {
      return res.status(404).json({ error: 'Applicant not found' });
    }

    // Collect offer file paths before deletion
    const offerFiles = await prisma.offer.findMany({
      where: { applicantId: id },
      select: { filePath: true },
    });

    // Delete related records first
    await prisma.activityLog.deleteMany({ where: { applicantId: id } });
    await prisma.interviewParticipant.deleteMany({ where: { interview: { applicantId: id } } });
    await prisma.interview.deleteMany({ where: { applicantId: id } });
    await prisma.offer.deleteMany({ where: { applicantId: id } });
    await prisma.review.deleteMany({ where: { applicantId: id } });
    await prisma.note.deleteMany({ where: { applicantId: id } });
    await prisma.applicant.delete({ where: { id } });

    // Fire-and-forget: clean up uploaded files
    const filePaths = [applicant.resumePath, applicant.portfolioPath, ...offerFiles.map(o => o.filePath)];
    deleteUploadedFiles(filePaths).catch(() => {});

    res.json({ message: 'Applicant deleted successfully' });
  } catch (error) {
    logger.error({ err: error }, 'Delete applicant error');
    res.status(500).json({ error: 'Failed to delete applicant' });
  }
});

export default router;
