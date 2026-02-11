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
} from '../schemas/index.js';

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

    const applicants = await prisma.applicant.findMany({
      where,
      include: {
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
        _count: {
          select: { reviews: true, notes: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(applicants);
  } catch (error) {
    console.error('Get applicants error:', error);
    res.status(500).json({ error: 'Failed to fetch applicants' });
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
      },
    });

    res.json(applicant);
  } catch (error) {
    console.error('Get applicant error:', error);
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
    const spamResult = checkSpam({ firstName, lastName, email, coverLetter, website2 }, req);

    let job: { id: string; title: string; status: string } | null = null;

    if (jobId) {
      // Verify job exists and is open
      job = await prisma.job.findUnique({ where: { id: jobId }, select: { id: true, title: true, status: true } });
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
          console.error('Thank-you email failed:', err);
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
            console.error('Subscriber notification failed:', err);
          }
        })();
      }
    }

    // Fire-and-forget: URL safety check
    const urls = [linkedIn, website, portfolioUrl].filter(Boolean) as string[];
    if (urls.length > 0) {
      checkApplicantUrls(applicant.id, urls);
    }

    res.status(201).json(applicant);
  } catch (error) {
    console.error('Create applicant error:', error);
    res.status(500).json({ error: 'Failed to submit application' });
  }
});

// Manually add applicant (admin, hiring_manager, or assigned reviewer)
router.post(
  '/manual',
  authenticate,
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
        },
        include: {
          job: {
            select: { id: true, title: true, department: true },
          },
        },
      });

      // Fire-and-forget: URL safety check
      const urls = [linkedIn, website, portfolioUrl].filter(Boolean) as string[];
      if (urls.length > 0) {
        checkApplicantUrls(applicant.id, urls);
      }

      res.status(201).json(applicant);
    } catch (error) {
      console.error('Manual add applicant error:', error);
      res.status(500).json({ error: 'Failed to add applicant' });
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
          select: { id: true, title: true },
        },
      },
    });

    res.json(applicant);
  } catch (error) {
    console.error('Update stage error:', error);
    res.status(500).json({ error: 'Failed to update applicant stage' });
  }
});

// Update applicant details
router.put('/:id', authenticate, validateBody(applicantUpdateSchema), async (req: AuthRequest, res: Response) => {
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

    const applicant = await prisma.applicant.update({
      where: { id },
      data: updateData,
    });

    // Fire-and-forget: URL safety check on updated URLs
    const urls = [linkedIn, website, portfolioUrl].filter(Boolean) as string[];
    if (urls.length > 0) {
      checkApplicantUrls(id, urls);
    }

    res.json(applicant);
  } catch (error) {
    console.error('Update applicant error:', error);
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

    res.status(201).json(note);
  } catch (error) {
    console.error('Add note error:', error);
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
    console.error('Get notes error:', error);
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
    console.error('Send rejection error:', error);
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
      console.error('Assign job error:', error);
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
          console.error('Thank-you email failed:', err);
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
            console.error('Subscriber notification failed:', err);
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
      console.error('Mark not spam error:', error);
      res.status(500).json({ error: 'Failed to update applicant' });
    }
  }
);

// Confirm applicant as spam
router.patch(
  '/:id/confirm-spam',
  authenticate,
  requireRole('admin', 'hiring_manager'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;

      const existing = await prisma.applicant.findUnique({ where: { id } });
      if (!existing) {
        return res.status(404).json({ error: 'Applicant not found' });
      }

      await prisma.note.create({
        data: { applicantId: id, content: `Confirmed as spam by ${req.user!.email}` },
      });

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
      console.error('Confirm spam error:', error);
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

    // Delete related records first
    await prisma.review.deleteMany({ where: { applicantId: id } });
    await prisma.note.deleteMany({ where: { applicantId: id } });
    await prisma.applicant.delete({ where: { id } });

    res.json({ message: 'Applicant deleted successfully' });
  } catch (error) {
    console.error('Delete applicant error:', error);
    res.status(500).json({ error: 'Failed to delete applicant' });
  }
});

export default router;
