import { Router, Response } from 'express';
import fs from 'fs';
import prisma from '../db.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { validateBody } from '../middleware/validateBody.js';
import { uploadOfferLetter } from '../middleware/upload.js';
import { offerCreateSchema, offerUpdateSchema } from '../schemas/index.js';
import { logActivity } from '../services/activityLog.js';
import { notifySubscribers } from '../services/notifications.js';
import logger from '../lib/logger.js';

const router = Router();

/** Check that user has offer access: admin always, HM only if offerAccess is true. Reviewers never. */
function hasOfferAccess(user: AuthRequest['user']): boolean {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (user.role === 'hiring_manager' && user.offerAccess) return true;
  return false;
}

// List offers for an applicant
router.get('/applicant/:applicantId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    if (!hasOfferAccess(req.user)) {
      return res.status(403).json({ error: 'No access to offers' });
    }

    const { applicantId } = req.params;

    const offers = await prisma.offer.findMany({
      where: { applicantId },
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: { select: { id: true, name: true } },
      },
    });

    res.json(offers);
  } catch (error) {
    logger.error({ err: error }, 'List offers error');
    res.status(500).json({ error: 'Failed to fetch offers' });
  }
});

// Create offer for an applicant
router.post(
  '/applicant/:applicantId',
  authenticate,
  uploadOfferLetter.single('offerLetter'),
  validateBody(offerCreateSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      if (!hasOfferAccess(req.user)) {
        return res.status(403).json({ error: 'No access to offers' });
      }

      const { applicantId } = req.params;
      const { status, notes, salary, offerDate, acceptedDate, declinedDate } = req.body;

      // Verify applicant exists
      const applicant = await prisma.applicant.findUnique({
        where: { id: applicantId },
        select: { id: true, firstName: true, lastName: true, jobId: true, job: { select: { id: true, title: true, department: true, officeId: true } } },
      });
      if (!applicant) {
        return res.status(404).json({ error: 'Applicant not found' });
      }

      const file = req.file as Express.Multer.File | undefined;

      // Auto-set date fields based on status
      const effectiveAcceptedDate = acceptedDate ? new Date(acceptedDate)
        : status === 'accepted' ? new Date() : null;
      const effectiveDeclinedDate = declinedDate ? new Date(declinedDate)
        : status === 'declined' ? new Date() : null;

      const offer = await prisma.offer.create({
        data: {
          status: status || 'draft',
          notes,
          salary,
          offerDate: offerDate ? new Date(offerDate) : null,
          acceptedDate: effectiveAcceptedDate,
          declinedDate: effectiveDeclinedDate,
          filePath: file ? `/uploads/offers/${file.filename}` : null,
          applicantId,
          createdById: req.user!.id,
        },
        include: {
          createdBy: { select: { id: true, name: true } },
        },
      });

      // Auto-advance to offer stage if currently in interview or earlier
      const earlyStages = ['new', 'screening', 'interview', 'fair_intake'];
      if (status === 'extended' && earlyStages.includes(applicant.jobId ? 'interview' : '')) {
        // Only auto-advance on extended status
      }
      if (status === 'extended') {
        const currentApplicant = await prisma.applicant.findUnique({ where: { id: applicantId }, select: { stage: true } });
        if (currentApplicant && earlyStages.includes(currentApplicant.stage)) {
          await prisma.applicant.update({
            where: { id: applicantId },
            data: { stage: 'offer' },
          });
          await prisma.note.create({
            data: {
              applicantId,
              content: `Automatically moved to offer stage (offer extended)`,
            },
          });
        }
      }

      logActivity('offer_created', {
        applicantId,
        userId: req.user!.id,
        metadata: { status: offer.status, offerId: offer.id },
      });

      // Notify subscribers about offer
      if (status === 'extended') {
        notifySubscribers({
          jobId: applicant.jobId,
          department: applicant.job?.department || undefined,
          officeId: applicant.job?.officeId,
          type: 'offer_extended',
          title: 'Offer Extended',
          message: `Offer extended to ${applicant.firstName} ${applicant.lastName}${applicant.job ? ` for ${applicant.job.title}` : ''}`,
          link: `/applicants/${applicantId}`,
          excludeUserId: req.user!.id,
        });
      }

      res.status(201).json(offer);
    } catch (error) {
      logger.error({ err: error }, 'Create offer error');
      res.status(500).json({ error: 'Failed to create offer' });
    }
  }
);

// Get single offer
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    if (!hasOfferAccess(req.user)) {
      return res.status(403).json({ error: 'No access to offers' });
    }

    const offer = await prisma.offer.findUnique({
      where: { id: req.params.id },
      include: {
        createdBy: { select: { id: true, name: true } },
        applicant: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    if (!offer) {
      return res.status(404).json({ error: 'Offer not found' });
    }

    res.json(offer);
  } catch (error) {
    logger.error({ err: error }, 'Get offer error');
    res.status(500).json({ error: 'Failed to fetch offer' });
  }
});

// Update offer
router.put('/:id', authenticate, validateBody(offerUpdateSchema), async (req: AuthRequest, res: Response) => {
  try {
    if (!hasOfferAccess(req.user)) {
      return res.status(403).json({ error: 'No access to offers' });
    }

    const { id } = req.params;
    const { status, notes, salary, offerDate, acceptedDate, declinedDate } = req.body;

    const existing = await prisma.offer.findUnique({
      where: { id },
      include: {
        applicant: { select: { id: true, firstName: true, lastName: true, stage: true, jobId: true, job: { select: { id: true, title: true, department: true, officeId: true } } } },
      },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Offer not found' });
    }

    const updateData: Record<string, unknown> = {};
    if (status !== undefined) updateData.status = status;
    if (notes !== undefined) updateData.notes = notes;
    if (salary !== undefined) updateData.salary = salary;
    if (offerDate !== undefined) updateData.offerDate = offerDate ? new Date(offerDate) : null;
    if (acceptedDate !== undefined) updateData.acceptedDate = acceptedDate ? new Date(acceptedDate) : null;
    if (declinedDate !== undefined) updateData.declinedDate = declinedDate ? new Date(declinedDate) : null;

    // Auto-set date fields when status changes
    if (status && status !== existing.status) {
      if (status === 'accepted' && !acceptedDate && !existing.acceptedDate) {
        updateData.acceptedDate = new Date();
      }
      if (status === 'declined' && !declinedDate && !existing.declinedDate) {
        updateData.declinedDate = new Date();
      }
    }

    const offer = await prisma.offer.update({
      where: { id },
      data: updateData,
      include: {
        createdBy: { select: { id: true, name: true } },
      },
    });

    // Handle stage auto-advance on status change
    if (status && status !== existing.status) {
      const applicant = existing.applicant;

      // Auto-advance to offer stage when extended
      if (status === 'extended') {
        const earlyStages = ['new', 'screening', 'interview', 'fair_intake'];
        if (earlyStages.includes(applicant.stage)) {
          await prisma.applicant.update({
            where: { id: applicant.id },
            data: { stage: 'offer' },
          });
          await prisma.note.create({
            data: { applicantId: applicant.id, content: 'Automatically moved to offer stage (offer extended)' },
          });
        }
      }

      // Auto-advance to hired when accepted
      if (status === 'accepted' && applicant.stage === 'offer') {
        await prisma.applicant.update({
          where: { id: applicant.id },
          data: { stage: 'hired' },
        });
        await prisma.note.create({
          data: { applicantId: applicant.id, content: 'Automatically moved to hired (offer accepted)' },
        });
      }

      logActivity('offer_status_changed', {
        applicantId: applicant.id,
        userId: req.user!.id,
        metadata: { offerId: id, from: existing.status, to: status },
      });

      // Notify on significant status changes
      const notifyStatuses = ['extended', 'accepted', 'declined', 'rescinded'];
      if (notifyStatuses.includes(status)) {
        const statusLabels: Record<string, string> = {
          extended: 'Offer Extended',
          accepted: 'Offer Accepted',
          declined: 'Offer Declined',
          rescinded: 'Offer Rescinded',
        };
        notifySubscribers({
          jobId: applicant.jobId,
          department: applicant.job?.department || undefined,
          officeId: applicant.job?.officeId,
          type: `offer_${status}`,
          title: statusLabels[status] || 'Offer Updated',
          message: `${statusLabels[status] || 'Offer updated'}: ${applicant.firstName} ${applicant.lastName}${applicant.job ? ` for ${applicant.job.title}` : ''}`,
          link: `/applicants/${applicant.id}`,
          excludeUserId: req.user!.id,
        });
      }
    }

    res.json(offer);
  } catch (error) {
    logger.error({ err: error }, 'Update offer error');
    res.status(500).json({ error: 'Failed to update offer' });
  }
});

// Upload/replace offer letter file
router.patch('/:id/upload', authenticate, uploadOfferLetter.single('offerLetter'), async (req: AuthRequest, res: Response) => {
  try {
    if (!hasOfferAccess(req.user)) {
      return res.status(403).json({ error: 'No access to offers' });
    }

    const { id } = req.params;
    const file = req.file as Express.Multer.File | undefined;

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const existing = await prisma.offer.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Offer not found' });
    }

    // Delete old file if exists
    if (existing.filePath) {
      const oldPath = existing.filePath.replace(/^\/uploads\//, '');
      const fullOldPath = `uploads/${oldPath}`;
      try { fs.unlinkSync(fullOldPath); } catch { /* ignore */ }
    }

    const offer = await prisma.offer.update({
      where: { id },
      data: { filePath: `/uploads/offers/${file.filename}` },
      include: {
        createdBy: { select: { id: true, name: true } },
      },
    });

    logActivity('offer_uploaded', {
      applicantId: existing.applicantId,
      userId: req.user!.id,
      metadata: { offerId: id },
    });

    res.json(offer);
  } catch (error) {
    logger.error({ err: error }, 'Upload offer letter error');
    res.status(500).json({ error: 'Failed to upload offer letter' });
  }
});

// Delete offer
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    if (!hasOfferAccess(req.user)) {
      return res.status(403).json({ error: 'No access to offers' });
    }

    const { id } = req.params;

    const existing = await prisma.offer.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Offer not found' });
    }

    // Delete file if exists
    if (existing.filePath) {
      const oldPath = existing.filePath.replace(/^\/uploads\//, '');
      const fullOldPath = `uploads/${oldPath}`;
      try { fs.unlinkSync(fullOldPath); } catch { /* ignore */ }
    }

    await prisma.offer.delete({ where: { id } });

    logActivity('offer_deleted', {
      applicantId: existing.applicantId,
      userId: req.user!.id,
      metadata: { offerId: id, status: existing.status },
    });

    res.json({ message: 'Offer deleted successfully' });
  } catch (error) {
    logger.error({ err: error }, 'Delete offer error');
    res.status(500).json({ error: 'Failed to delete offer' });
  }
});

export default router;
