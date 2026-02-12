import { Router, Response } from 'express';
import prisma from '../db.js';
import { authenticate, requireRole, AuthRequest, getAccessibleEventIds } from '../middleware/auth.js';
import { validateBody } from '../middleware/validateBody.js';
import { uploadApplicationFiles } from '../middleware/upload.js';
import { validateUploadedFiles } from '../middleware/validateFiles.js';
import { eventCreateSchema, eventUpdateSchema, fairIntakeSchema, attendeesSchema } from '../schemas/index.js';
import { getTemplate, resolveTemplate, sendThankYouEmail } from '../services/email.js';
import { notifySubscribers } from '../services/notifications.js';
import logger from '../lib/logger.js';
import { activityLogData } from '../services/activityLog.js';
import { parsePagination, prismaSkipTake, paginatedResponse } from '../utils/pagination.js';

const router = Router();

// List events
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const accessibleEventIds = await getAccessibleEventIds(req.user!);

    const where = accessibleEventIds !== null
      ? { id: { in: accessibleEventIds } }
      : {};

    const pagination = parsePagination(req.query);

    const include = {
      createdBy: { select: { id: true, name: true } },
      _count: { select: { applicants: true } },
      attendees: {
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      },
    } as const;

    if (pagination) {
      const [events, total] = await Promise.all([
        prisma.recruitmentEvent.findMany({
          where,
          orderBy: { date: 'desc' },
          include,
          ...prismaSkipTake(pagination),
        }),
        prisma.recruitmentEvent.count({ where }),
      ]);
      return res.json(paginatedResponse(events, total, pagination));
    }

    const events = await prisma.recruitmentEvent.findMany({
      where,
      orderBy: { date: 'desc' },
      include,
    });

    res.json(events);
  } catch (error) {
    logger.error({ err: error }, 'List events error');
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// Public: list published upcoming events for website
router.get('/website', async (_req, res) => {
  try {
    const events = await prisma.recruitmentEvent.findMany({
      where: {
        publishToWebsite: true,
        date: { gte: new Date() },
      },
      select: {
        id: true,
        name: true,
        type: true,
        date: true,
        location: true,
        description: true,
        eventUrl: true,
        university: true,
      },
      orderBy: { date: 'asc' },
    });
    res.json(events);
  } catch (error) {
    logger.error({ err: error }, 'Public events error');
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// Get single event
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Access check for reviewers
    const accessibleEventIds = await getAccessibleEventIds(req.user!);
    if (accessibleEventIds !== null && !accessibleEventIds.includes(id)) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const event = await prisma.recruitmentEvent.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, name: true } },
        _count: { select: { applicants: true } },
        attendees: {
          include: {
            user: { select: { id: true, name: true, email: true, role: true } },
          },
        },
      },
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    res.json(event);
  } catch (error) {
    logger.error({ err: error }, 'Get event error');
    res.status(500).json({ error: 'Failed to fetch event' });
  }
});

// Create event (admin/HM only)
router.post(
  '/',
  authenticate,
  requireRole('admin', 'hiring_manager'),
  validateBody(eventCreateSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const { name, type, location, date, notes, description, eventUrl, university, publishToWebsite, attendeeIds } = req.body;

      const event = await prisma.recruitmentEvent.create({
        data: {
          name,
          type: type || 'job_fair',
          location: location || null,
          date: new Date(date),
          notes: notes || null,
          description: description || null,
          eventUrl: eventUrl || null,
          university: university || null,
          publishToWebsite: publishToWebsite || false,
          createdById: req.user!.id,
        },
      });

      // Create attendees if provided
      if (attendeeIds && attendeeIds.length > 0) {
        await prisma.eventAttendee.createMany({
          data: attendeeIds.map((userId: string) => ({
            userId,
            eventId: event.id,
          })),
        });

        // Auto-create EventReviewer for reviewer-role attendees
        const reviewerAttendees = await prisma.user.findMany({
          where: { id: { in: attendeeIds }, role: 'reviewer' },
          select: { id: true },
        });
        if (reviewerAttendees.length > 0) {
          await prisma.eventReviewer.createMany({
            data: reviewerAttendees.map(u => ({ userId: u.id, eventId: event.id })),
            skipDuplicates: true,
          });
        }
      }

      const created = await prisma.recruitmentEvent.findUnique({
        where: { id: event.id },
        include: {
          createdBy: { select: { id: true, name: true } },
          _count: { select: { applicants: true } },
          attendees: {
            include: {
              user: { select: { id: true, name: true, email: true } },
            },
          },
        },
      });

      res.status(201).json(created);
    } catch (error) {
      logger.error({ err: error }, 'Create event error');
      res.status(500).json({ error: 'Failed to create event' });
    }
  }
);

// Update event (admin/HM only)
router.put(
  '/:id',
  authenticate,
  requireRole('admin', 'hiring_manager'),
  validateBody(eventUpdateSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { name, type, location, date, notes, description, eventUrl, university, publishToWebsite } = req.body;

      const existing = await prisma.recruitmentEvent.findUnique({ where: { id } });
      if (!existing) {
        return res.status(404).json({ error: 'Event not found' });
      }

      const event = await prisma.recruitmentEvent.update({
        where: { id },
        data: {
          ...(name !== undefined && { name }),
          ...(type !== undefined && { type }),
          ...(location !== undefined && { location }),
          ...(date !== undefined && { date: new Date(date) }),
          ...(notes !== undefined && { notes }),
          ...(description !== undefined && { description: description || null }),
          ...(eventUrl !== undefined && { eventUrl: eventUrl || null }),
          ...(university !== undefined && { university: university || null }),
          ...(publishToWebsite !== undefined && { publishToWebsite }),
        },
        include: {
          createdBy: { select: { id: true, name: true } },
          _count: { select: { applicants: true } },
          attendees: {
            include: {
              user: { select: { id: true, name: true, email: true } },
            },
          },
        },
      });

      res.json(event);
    } catch (error) {
      logger.error({ err: error }, 'Update event error');
      res.status(500).json({ error: 'Failed to update event' });
    }
  }
);

// Delete event (admin only, only if no applicants)
router.delete(
  '/:id',
  authenticate,
  requireRole('admin'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;

      const event = await prisma.recruitmentEvent.findUnique({
        where: { id },
        include: { _count: { select: { applicants: true } } },
      });
      if (!event) {
        return res.status(404).json({ error: 'Event not found' });
      }
      if (event._count.applicants > 0) {
        return res.status(400).json({ error: 'Cannot delete event with linked applicants' });
      }

      await prisma.eventAttendee.deleteMany({ where: { eventId: id } });
      await prisma.eventReviewer.deleteMany({ where: { eventId: id } });
      await prisma.recruitmentEvent.delete({ where: { id } });

      res.json({ message: 'Event deleted successfully' });
    } catch (error) {
      logger.error({ err: error }, 'Delete event error');
      res.status(500).json({ error: 'Failed to delete event' });
    }
  }
);

// Set attendees (admin/HM) — delete-and-recreate pattern
router.put(
  '/:id/attendees',
  authenticate,
  requireRole('admin', 'hiring_manager'),
  validateBody(attendeesSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { attendeeIds } = req.body;

      const event = await prisma.recruitmentEvent.findUnique({ where: { id } });
      if (!event) {
        return res.status(404).json({ error: 'Event not found' });
      }

      // Get old reviewer attendees to diff
      const oldAttendees = await prisma.eventAttendee.findMany({
        where: { eventId: id },
        include: { user: { select: { id: true, role: true } } },
      });
      const oldReviewerIds = new Set(oldAttendees.filter(a => a.user.role === 'reviewer').map(a => a.userId));

      // Delete and recreate attendees
      await prisma.eventAttendee.deleteMany({ where: { eventId: id } });
      if (attendeeIds && attendeeIds.length > 0) {
        await prisma.eventAttendee.createMany({
          data: attendeeIds.map((userId: string) => ({
            userId,
            eventId: id,
          })),
        });
      }

      // Determine new reviewer attendees
      const newReviewerAttendees = attendeeIds && attendeeIds.length > 0
        ? await prisma.user.findMany({ where: { id: { in: attendeeIds }, role: 'reviewer' }, select: { id: true } })
        : [];
      const newReviewerIds = new Set(newReviewerAttendees.map(u => u.id));

      // Auto-create EventReviewer for newly added reviewer attendees
      const addedReviewers = [...newReviewerIds].filter(id => !oldReviewerIds.has(id));
      if (addedReviewers.length > 0) {
        await prisma.eventReviewer.createMany({
          data: addedReviewers.map(userId => ({ userId, eventId: id })),
          skipDuplicates: true,
        });
      }

      // Auto-remove EventReviewer for removed reviewer attendees
      const removedReviewers = [...oldReviewerIds].filter(id => !newReviewerIds.has(id));
      if (removedReviewers.length > 0) {
        await prisma.eventReviewer.deleteMany({
          where: { eventId: id, userId: { in: removedReviewers } },
        });
      }

      const updated = await prisma.recruitmentEvent.findUnique({
        where: { id },
        include: {
          createdBy: { select: { id: true, name: true } },
          _count: { select: { applicants: true } },
          attendees: {
            include: {
              user: { select: { id: true, name: true, email: true, role: true } },
            },
          },
        },
      });

      res.json(updated);
    } catch (error) {
      logger.error({ err: error }, 'Update attendees error');
      res.status(500).json({ error: 'Failed to update attendees' });
    }
  }
);

// Fair Intake — create applicant + review atomically
router.post('/:id/intake', authenticate, uploadApplicationFiles, validateUploadedFiles, validateBody(fairIntakeSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Access check
    const accessibleEventIds = await getAccessibleEventIds(req.user!);
    if (accessibleEventIds !== null && !accessibleEventIds.includes(id)) {
      return res.status(403).json({ error: 'Not authorized for this event' });
    }

    const event = await prisma.recruitmentEvent.findUnique({ where: { id } });
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const { firstName, lastName, email, phone, portfolioUrl, jobId, rating, recommendation, comments, source } = req.body;

    // Get uploaded file paths
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const resumePath = files?.resume?.[0]?.filename ? `/uploads/resumes/${files.resume[0].filename}` : null;
    const portfolioPath = files?.portfolio?.[0]?.filename ? `/uploads/portfolios/${files.portfolio[0].filename}` : null;

    // Validate job if provided
    if (jobId) {
      const job = await prisma.job.findUnique({ where: { id: jobId } });
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }
    }

    // Atomic transaction: create applicant + review + note
    const result = await prisma.$transaction(async (tx) => {
      const applicant = await tx.applicant.create({
        data: {
          firstName,
          lastName,
          email,
          phone: phone || null,
          portfolioUrl: portfolioUrl || null,
          resumePath,
          portfolioPath,
          jobId: jobId || null,
          eventId: id,
          source: source || event.name,
          stage: 'fair_intake',
        },
      });

      const review = await tx.review.create({
        data: {
          applicantId: applicant.id,
          reviewerId: req.user!.id,
          rating,
          recommendation: recommendation || null,
          comments: comments || null,
        },
      });

      await tx.note.create({
        data: {
          applicantId: applicant.id,
          content: `Added at ${event.name} by ${req.user!.email}`,
        },
      });

      await tx.activityLog.create({
        data: activityLogData('applicant_created', {
          applicantId: applicant.id,
          userId: req.user!.id,
          metadata: { source: 'event_intake', eventId: id },
        }),
      });

      return { ...applicant, review };
    });

    // Fire-and-forget: event thank-you auto-responder
    (async () => {
      try {
        const template = await getTemplate('event_thank_you');
        const variables = { firstName, lastName, eventName: event.name };
        const subject = resolveTemplate(template.subject, variables);
        const body = resolveTemplate(template.body, variables);
        await sendThankYouEmail({ to: email, applicantName: `${firstName} ${lastName}`, subject, body });
      } catch (err) {
        logger.error({ err }, 'Event thank-you email failed');
      }
    })();

    // Fire-and-forget: notify event subscribers
    notifySubscribers({
      jobId: jobId || null,
      eventId: id,
      type: 'new_application',
      title: 'New Fair Intake',
      message: `${firstName} ${lastName} was added at ${event.name}`,
      link: `/applicants/${result.id}`,
      excludeUserId: req.user!.id,
    });

    res.status(201).json(result);
  } catch (error) {
    logger.error({ err: error }, 'Fair intake error');
    res.status(500).json({ error: 'Failed to add applicant' });
  }
});

export default router;
