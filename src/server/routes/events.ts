import { Router, Response } from 'express';
import prisma from '../db.js';
import { authenticate, requireRole, AuthRequest, getAccessibleEventIds } from '../middleware/auth.js';
import { validateBody } from '../middleware/validateBody.js';
import { eventCreateSchema, eventUpdateSchema, fairIntakeSchema, attendeesSchema } from '../schemas/index.js';

const router = Router();

// List events
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const accessibleEventIds = await getAccessibleEventIds(req.user!);

    const where = accessibleEventIds !== null
      ? { id: { in: accessibleEventIds } }
      : {};

    const events = await prisma.recruitmentEvent.findMany({
      where,
      orderBy: { date: 'desc' },
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

    res.json(events);
  } catch (error) {
    console.error('List events error:', error);
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
    console.error('Get event error:', error);
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
      const { name, type, location, date, notes, attendeeIds } = req.body;

      const event = await prisma.recruitmentEvent.create({
        data: {
          name,
          type: type || 'job_fair',
          location: location || null,
          date: new Date(date),
          notes: notes || null,
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
      console.error('Create event error:', error);
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
      const { name, type, location, date, notes } = req.body;

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
      console.error('Update event error:', error);
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
      await prisma.recruitmentEvent.delete({ where: { id } });

      res.json({ message: 'Event deleted successfully' });
    } catch (error) {
      console.error('Delete event error:', error);
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

      // Delete and recreate
      await prisma.eventAttendee.deleteMany({ where: { eventId: id } });
      if (attendeeIds && attendeeIds.length > 0) {
        await prisma.eventAttendee.createMany({
          data: attendeeIds.map((userId: string) => ({
            userId,
            eventId: id,
          })),
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
      console.error('Update attendees error:', error);
      res.status(500).json({ error: 'Failed to update attendees' });
    }
  }
);

// Fair Intake — create applicant + review atomically
router.post('/:id/intake', authenticate, validateBody(fairIntakeSchema), async (req: AuthRequest, res: Response) => {
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

    const { firstName, lastName, email, phone, jobId, rating, recommendation, comments, source } = req.body;

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
          jobId: jobId || null,
          eventId: id,
          source: source || event.name,
          stage: 'new',
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

      return { ...applicant, review };
    });

    res.status(201).json(result);
  } catch (error) {
    console.error('Fair intake error:', error);
    res.status(500).json({ error: 'Failed to add applicant' });
  }
});

export default router;
