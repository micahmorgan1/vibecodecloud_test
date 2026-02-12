import { Router, Response } from 'express';
import prisma from '../db.js';
import { authenticate, requireRole, AuthRequest, getAccessibleApplicantFilter } from '../middleware/auth.js';
import { validateBody } from '../middleware/validateBody.js';
import { interviewCreateSchema, interviewUpdateSchema, interviewFeedbackSchema } from '../schemas/index.js';
import logger from '../lib/logger.js';
import { logActivity } from '../services/activityLog.js';
import { notifyUsers, notifySubscribers } from '../services/notifications.js';

const router = Router();

const userSelect = { id: true, name: true, email: true };

// List interviews for an applicant
router.get('/applicant/:applicantId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { applicantId } = req.params;

    // Access control
    const accessFilter = await getAccessibleApplicantFilter(req.user!);
    if (accessFilter.id === 'none') {
      return res.status(404).json({ error: 'Applicant not found' });
    }
    const applicant = await prisma.applicant.findFirst({ where: { id: applicantId, ...accessFilter } });
    if (!applicant) {
      return res.status(404).json({ error: 'Applicant not found' });
    }

    const interviews = await prisma.interview.findMany({
      where: { applicantId },
      include: {
        participants: {
          include: { user: { select: userSelect } },
        },
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: { scheduledAt: 'desc' },
    });

    res.json(interviews);
  } catch (error) {
    logger.error({ err: error }, 'List interviews error');
    res.status(500).json({ error: 'Failed to fetch interviews' });
  }
});

// Schedule an interview
router.post(
  '/applicant/:applicantId',
  authenticate,
  requireRole('admin', 'hiring_manager'),
  validateBody(interviewCreateSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const { applicantId } = req.params;
      const { scheduledAt, location, type, notes, participantIds } = req.body;

      // Verify applicant exists
      const applicant = await prisma.applicant.findUnique({
        where: { id: applicantId },
        select: { id: true, firstName: true, lastName: true, stage: true, jobId: true, job: { select: { id: true, title: true, department: true, officeId: true } } },
      });
      if (!applicant) {
        return res.status(404).json({ error: 'Applicant not found' });
      }

      // Auto-advance to interview stage if in an earlier stage
      const earlyStages = ['fair_intake', 'new', 'screening'];
      const shouldAdvance = earlyStages.includes(applicant.stage);

      const interview = await prisma.$transaction(async (tx) => {
        const created = await tx.interview.create({
          data: {
            applicantId,
            scheduledAt: new Date(scheduledAt),
            location: location || null,
            type,
            notes: notes || null,
            createdById: req.user!.id,
            participants: {
              create: participantIds.map((userId: string) => ({ userId })),
            },
          },
          include: {
            participants: {
              include: { user: { select: userSelect } },
            },
            createdBy: { select: { id: true, name: true } },
          },
        });

        // Create note on applicant
        const dateStr = new Date(scheduledAt).toLocaleString();
        await tx.note.create({
          data: {
            applicantId,
            content: `Interview scheduled for ${dateStr} (${type.replace('_', ' ')}) by ${req.user!.email}`,
          },
        });

        // Auto-advance to interview stage
        if (shouldAdvance) {
          await tx.applicant.update({
            where: { id: applicantId },
            data: { stage: 'interview' },
          });
          await tx.note.create({
            data: {
              applicantId,
              content: `Automatically moved from ${applicant.stage} to interview (interview scheduled)`,
            },
          });
        }

        return created;
      });

      logActivity('interview_scheduled', {
        applicantId,
        userId: req.user!.id,
        metadata: { interviewId: interview.id, type, scheduledAt },
      });

      // Log stage change if auto-advanced
      if (shouldAdvance) {
        logActivity('stage_changed', {
          applicantId,
          userId: req.user!.id,
          metadata: { from: applicant.stage, to: 'interview', auto: true },
        });

        // Notify subscribers about stage change
        notifySubscribers({
          jobId: applicant.job?.id || null,
          department: applicant.job?.department,
          officeId: applicant.job?.officeId,
          type: 'stage_changed',
          title: 'Stage Changed',
          message: `${applicant.firstName} ${applicant.lastName} moved to interview`,
          link: `/applicants/${applicantId}`,
          excludeUserId: req.user!.id,
        });
      }

      // Fire-and-forget: notify participants
      const participantUserIds = participantIds.filter((id: string) => id !== req.user!.id);
      const applicantName = `${applicant.firstName} ${applicant.lastName}`;
      const jobTitle = applicant.job?.title || 'General Application';
      notifyUsers({
        userIds: participantUserIds,
        type: 'interview_scheduled',
        title: 'Interview Scheduled',
        message: `You are scheduled to interview ${applicantName} for ${jobTitle}`,
        link: `/applicants/${applicantId}`,
      });

      // Return updated stage in response so client can reflect it
      const responseData = shouldAdvance
        ? { ...interview, applicantStageChanged: true, newStage: 'interview' }
        : interview;
      res.status(201).json(responseData);
    } catch (error) {
      logger.error({ err: error }, 'Schedule interview error');
      res.status(500).json({ error: 'Failed to schedule interview' });
    }
  }
);

// Get single interview detail
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const interview = await prisma.interview.findUnique({
      where: { id },
      include: {
        participants: {
          include: { user: { select: userSelect } },
        },
        createdBy: { select: { id: true, name: true } },
        applicant: { select: { id: true, firstName: true, lastName: true, jobId: true } },
      },
    });

    if (!interview) {
      return res.status(404).json({ error: 'Interview not found' });
    }

    // Access control via applicant
    const accessFilter = await getAccessibleApplicantFilter(req.user!);
    if (accessFilter.id === 'none') {
      return res.status(404).json({ error: 'Interview not found' });
    }
    const accessCheck = await prisma.applicant.findFirst({
      where: { id: interview.applicantId, ...accessFilter },
    });
    if (!accessCheck) {
      return res.status(404).json({ error: 'Interview not found' });
    }

    res.json(interview);
  } catch (error) {
    logger.error({ err: error }, 'Get interview error');
    res.status(500).json({ error: 'Failed to fetch interview' });
  }
});

// Update interview
router.put(
  '/:id',
  authenticate,
  requireRole('admin', 'hiring_manager'),
  validateBody(interviewUpdateSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { scheduledAt, location, type, notes, status, feedback, outcome, participantIds } = req.body;

      const existing = await prisma.interview.findUnique({
        where: { id },
        include: {
          applicant: { select: { id: true, firstName: true, lastName: true, job: { select: { title: true } } } },
        },
      });
      if (!existing) {
        return res.status(404).json({ error: 'Interview not found' });
      }

      const interview = await prisma.$transaction(async (tx) => {
        // Update participants if provided (delete-and-recreate pattern)
        if (participantIds) {
          await tx.interviewParticipant.deleteMany({ where: { interviewId: id } });
          await tx.interviewParticipant.createMany({
            data: participantIds.map((userId: string) => ({ interviewId: id, userId })),
          });
        }

        const updateData: Record<string, unknown> = {};
        if (scheduledAt !== undefined) updateData.scheduledAt = new Date(scheduledAt);
        if (location !== undefined) updateData.location = location || null;
        if (type !== undefined) updateData.type = type;
        if (notes !== undefined) updateData.notes = notes || null;
        if (status !== undefined) updateData.status = status;
        if (feedback !== undefined) updateData.feedback = feedback || null;
        if (outcome !== undefined) updateData.outcome = outcome || null;

        const updated = await tx.interview.update({
          where: { id },
          data: updateData,
          include: {
            participants: {
              include: { user: { select: userSelect } },
            },
            createdBy: { select: { id: true, name: true } },
          },
        });

        // Create notes for status/outcome changes
        const applicantId = existing.applicantId;
        if (status && status !== existing.status) {
          await tx.note.create({
            data: {
              applicantId,
              content: `Interview status changed to ${status} by ${req.user!.email}`,
            },
          });
        }
        if (outcome && outcome !== existing.outcome) {
          await tx.note.create({
            data: {
              applicantId,
              content: `Interview outcome set to ${outcome} by ${req.user!.email}`,
            },
          });
        }

        return updated;
      });

      // Log activity for status/outcome changes
      if (status && status !== existing.status) {
        logActivity('interview_status_changed', {
          applicantId: existing.applicantId,
          userId: req.user!.id,
          metadata: { interviewId: id, from: existing.status, to: status },
        });
      }

      // Notify participants on reschedule
      if (scheduledAt && scheduledAt !== existing.scheduledAt.toISOString()) {
        const applicantName = `${existing.applicant.firstName} ${existing.applicant.lastName}`;
        const pIds = interview.participants
          .map(p => p.userId)
          .filter(uid => uid !== req.user!.id);
        notifyUsers({
          userIds: pIds,
          type: 'interview_scheduled',
          title: 'Interview Rescheduled',
          message: `Interview with ${applicantName} has been rescheduled`,
          link: `/applicants/${existing.applicantId}`,
        });
      }

      res.json(interview);
    } catch (error) {
      logger.error({ err: error }, 'Update interview error');
      res.status(500).json({ error: 'Failed to update interview' });
    }
  }
);

// Cancel interview
router.delete('/:id', authenticate, requireRole('admin', 'hiring_manager'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const existing = await prisma.interview.findUnique({
      where: { id },
      include: {
        participants: { select: { userId: true } },
        applicant: { select: { id: true, firstName: true, lastName: true, job: { select: { title: true } } } },
      },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Interview not found' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.interview.delete({ where: { id } });
      await tx.note.create({
        data: {
          applicantId: existing.applicantId,
          content: `Interview cancelled by ${req.user!.email}`,
        },
      });
    });

    logActivity('interview_cancelled', {
      applicantId: existing.applicantId,
      userId: req.user!.id,
      metadata: { interviewId: id },
    });

    // Fire-and-forget: notify participants
    const applicantName = `${existing.applicant.firstName} ${existing.applicant.lastName}`;
    const participantUserIds = existing.participants
      .map(p => p.userId)
      .filter(uid => uid !== req.user!.id);
    notifyUsers({
      userIds: participantUserIds,
      type: 'interview_cancelled',
      title: 'Interview Cancelled',
      message: `Interview with ${applicantName} has been cancelled`,
      link: `/applicants/${existing.applicantId}`,
    });

    res.json({ message: 'Interview cancelled' });
  } catch (error) {
    logger.error({ err: error }, 'Cancel interview error');
    res.status(500).json({ error: 'Failed to cancel interview' });
  }
});

// Add participant feedback
router.patch('/:id/feedback', authenticate, validateBody(interviewFeedbackSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { feedback, rating } = req.body;

    const interview = await prisma.interview.findUnique({
      where: { id },
      select: { id: true, applicantId: true },
    });
    if (!interview) {
      return res.status(404).json({ error: 'Interview not found' });
    }

    // Verify current user is a participant
    const participant = await prisma.interviewParticipant.findUnique({
      where: { interviewId_userId: { interviewId: id, userId: req.user!.id } },
    });
    if (!participant) {
      return res.status(403).json({ error: 'You are not a participant of this interview' });
    }

    const updated = await prisma.interviewParticipant.update({
      where: { id: participant.id },
      data: {
        feedback: feedback || null,
        rating: rating ?? null,
      },
      include: { user: { select: userSelect } },
    });

    logActivity('interview_feedback_added', {
      applicantId: interview.applicantId,
      userId: req.user!.id,
      metadata: { interviewId: id, rating },
    });

    res.json(updated);
  } catch (error) {
    logger.error({ err: error }, 'Interview feedback error');
    res.status(500).json({ error: 'Failed to save feedback' });
  }
});

export default router;
