import { Router, Response } from 'express';
import prisma from '../db.js';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth.js';
import { getTemplate, sendReviewRequest } from '../services/email.js';
import { validateBody } from '../middleware/validateBody.js';
import { templateUpdateSchema, reviewerAssignmentSchema, subscriberSchema, requestReviewSchema } from '../schemas/index.js';
import logger from '../lib/logger.js';

const router = Router();

// Get all email templates
router.get(
  '/templates',
  authenticate,
  requireRole('admin', 'hiring_manager'),
  async (_req: AuthRequest, res: Response) => {
    try {
      const templates = await prisma.emailTemplate.findMany();
      res.json(templates);
    } catch (error) {
      logger.error({ err: error }, 'Get templates error');
      res.status(500).json({ error: 'Failed to fetch templates' });
    }
  }
);

// Get one template by type (with hardcoded fallback)
router.get('/templates/:type', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { type } = req.params;
    const template = await getTemplate(type);
    res.json(template);
  } catch (error) {
    logger.error({ err: error }, 'Get template error');
    res.status(500).json({ error: 'Failed to fetch template' });
  }
});

// Upsert a template by type
router.put(
  '/templates/:type',
  authenticate,
  requireRole('admin', 'hiring_manager'),
  validateBody(templateUpdateSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const { type } = req.params;
      const { subject, body } = req.body;

      const validTypes = ['thank_you', 'rejection'];
      if (!validTypes.includes(type)) {
        return res.status(400).json({ error: 'Invalid template type' });
      }

      const template = await prisma.emailTemplate.upsert({
        where: { type },
        update: { subject, body, updatedBy: req.user!.id },
        create: { type, subject, body, updatedBy: req.user!.id },
      });

      res.json(template);
    } catch (error) {
      logger.error({ err: error }, 'Upsert template error');
      res.status(500).json({ error: 'Failed to save template' });
    }
  }
);

// List all users with role=reviewer
router.get(
  '/reviewers',
  authenticate,
  requireRole('admin', 'hiring_manager'),
  async (_req: AuthRequest, res: Response) => {
    try {
      const reviewers = await prisma.user.findMany({
        where: { role: 'reviewer' },
        select: { id: true, name: true, email: true },
      });
      res.json(reviewers);
    } catch (error) {
      logger.error({ err: error }, 'Get reviewers error');
      res.status(500).json({ error: 'Failed to fetch reviewers' });
    }
  }
);

// List all users (for notification subscriptions)
router.get(
  '/users',
  authenticate,
  requireRole('admin', 'hiring_manager'),
  async (_req: AuthRequest, res: Response) => {
    try {
      const users = await prisma.user.findMany({
        select: { id: true, name: true, email: true, role: true },
        orderBy: { name: 'asc' },
      });
      res.json(users);
    } catch (error) {
      logger.error({ err: error }, 'Get users error');
      res.status(500).json({ error: 'Failed to fetch users' });
    }
  }
);

// Get assigned reviewers for a job (access control only)
router.get(
  '/jobs/:jobId/reviewers',
  authenticate,
  requireRole('admin', 'hiring_manager'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { jobId } = req.params;
      const assignments = await prisma.jobReviewer.findMany({
        where: { jobId },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      });
      res.json(assignments);
    } catch (error) {
      logger.error({ err: error }, 'Get job reviewers error');
      res.status(500).json({ error: 'Failed to fetch job reviewers' });
    }
  }
);

// Set reviewer assignments for a job (access control only, delete-and-recreate)
router.put(
  '/jobs/:jobId/reviewers',
  authenticate,
  requireRole('admin', 'hiring_manager'),
  validateBody(reviewerAssignmentSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const { jobId } = req.params;
      const { userIds } = req.body;

      await prisma.jobReviewer.deleteMany({ where: { jobId } });

      if (userIds.length > 0) {
        await prisma.jobReviewer.createMany({
          data: userIds.map((userId: string) => ({ userId, jobId })),
        });
      }

      const result = await prisma.jobReviewer.findMany({
        where: { jobId },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      });

      res.json(result);
    } catch (error) {
      logger.error({ err: error }, 'Set job reviewers error');
      res.status(500).json({ error: 'Failed to save reviewer assignments' });
    }
  }
);

// Get notification subscribers for a job
router.get(
  '/jobs/:jobId/subscribers',
  authenticate,
  requireRole('admin', 'hiring_manager'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { jobId } = req.params;
      const subs = await prisma.jobNotificationSub.findMany({
        where: { jobId },
        include: {
          user: { select: { id: true, name: true, email: true, role: true } },
        },
      });
      res.json(subs);
    } catch (error) {
      logger.error({ err: error }, 'Get subscribers error');
      res.status(500).json({ error: 'Failed to fetch subscribers' });
    }
  }
);

// Set notification subscribers for a job (delete-and-recreate)
router.put(
  '/jobs/:jobId/subscribers',
  authenticate,
  requireRole('admin', 'hiring_manager'),
  validateBody(subscriberSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const { jobId } = req.params;
      const { userIds } = req.body;

      await prisma.jobNotificationSub.deleteMany({ where: { jobId } });

      if (userIds.length > 0) {
        await prisma.jobNotificationSub.createMany({
          data: userIds.map((userId: string) => ({ userId, jobId })),
        });
      }

      const result = await prisma.jobNotificationSub.findMany({
        where: { jobId },
        include: {
          user: { select: { id: true, name: true, email: true, role: true } },
        },
      });

      res.json(result);
    } catch (error) {
      logger.error({ err: error }, 'Set subscribers error');
      res.status(500).json({ error: 'Failed to save subscribers' });
    }
  }
);

// Get current user's assigned job IDs
router.get('/my-assignments', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const assignments = await prisma.jobReviewer.findMany({
      where: { userId: req.user!.id },
      select: { jobId: true },
    });
    res.json(assignments.map((a) => a.jobId));
  } catch (error) {
    logger.error({ err: error }, 'Get my assignments error');
    res.status(500).json({ error: 'Failed to fetch assignments' });
  }
});

// Send applicant for review to specific users
router.post(
  '/request-review/:applicantId',
  authenticate,
  requireRole('admin', 'hiring_manager'),
  validateBody(requestReviewSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const { applicantId } = req.params;
      const { userIds, message } = req.body;

      const applicant = await prisma.applicant.findUnique({
        where: { id: applicantId },
        include: { job: { select: { title: true } } },
      });
      if (!applicant) {
        return res.status(404).json({ error: 'Applicant not found' });
      }

      const sender = await prisma.user.findUnique({
        where: { id: req.user!.id },
        select: { name: true },
      });

      const recipients = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, email: true },
      });

      const applicantName = `${applicant.firstName} ${applicant.lastName}`;

      for (const recipient of recipients) {
        await sendReviewRequest({
          to: recipient.email,
          recipientName: recipient.name,
          applicantName,
          applicantId,
          jobTitle: applicant.job?.title || 'General Application',
          senderName: sender?.name || 'A manager',
          message,
        });
      }

      // Add a note to the applicant
      const recipientNames = recipients.map((r) => r.name).join(', ');
      await prisma.note.create({
        data: {
          applicantId,
          content: `Review requested from ${recipientNames} by ${sender?.name || 'a manager'}${message ? `: "${message}"` : ''}`,
        },
      });

      res.json({ success: true, notified: recipients.length });
    } catch (error) {
      logger.error({ err: error }, 'Request review error');
      res.status(500).json({ error: 'Failed to send review requests' });
    }
  }
);

export default router;
