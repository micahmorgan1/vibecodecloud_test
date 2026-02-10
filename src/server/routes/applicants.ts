import { Router, Response, Request } from 'express';
import prisma from '../db.js';
import { authenticate, requireRole, AuthRequest, getAccessibleJobIds } from '../middleware/auth.js';
import { uploadApplicationFiles } from '../middleware/upload.js';
import { sendRejectionEmail, getTemplate, resolveTemplate, sendThankYouEmail, sendReviewerNotification } from '../services/email.js';

const router = Router();

// Get all applicants (with filters)
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { jobId, stage, search } = req.query;

    const where: Record<string, unknown> = {};
    if (jobId) where.jobId = jobId as string;
    if (stage) where.stage = stage as string;
    if (search) {
      where.OR = [
        { firstName: { contains: search as string } },
        { lastName: { contains: search as string } },
        { email: { contains: search as string } },
      ];
    }

    // Reviewer access control: only see applicants for assigned jobs (excludes general pool)
    const accessibleJobIds = await getAccessibleJobIds(req.user!);
    if (accessibleJobIds !== null) {
      if (accessibleJobIds.length === 0) {
        return res.json([]);
      }
      where.jobId = where.jobId
        ? (accessibleJobIds.includes(where.jobId as string) ? where.jobId : '__none__')
        : { in: accessibleJobIds };
    }

    const applicants = await prisma.applicant.findMany({
      where,
      include: {
        job: {
          select: { id: true, title: true, department: true, archived: true },
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

    const applicant = await prisma.applicant.findUnique({
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

    if (!applicant) {
      return res.status(404).json({ error: 'Applicant not found' });
    }

    // Reviewer access control (general pool applicants hidden from reviewers)
    const accessibleJobIds = await getAccessibleJobIds(req.user!);
    if (accessibleJobIds !== null && (!applicant.jobId || !accessibleJobIds.includes(applicant.jobId))) {
      return res.status(404).json({ error: 'Applicant not found' });
    }

    res.json(applicant);
  } catch (error) {
    console.error('Get applicant error:', error);
    res.status(500).json({ error: 'Failed to fetch applicant' });
  }
});

// Create applicant (public endpoint for job applications)
router.post('/', uploadApplicationFiles, async (req: Request, res: Response) => {
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
    } = req.body;

    if (!firstName || !lastName || !email) {
      return res.status(400).json({ error: 'First name, last name, and email are required' });
    }

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
      },
      include: {
        job: {
          select: { id: true, title: true },
        },
      },
    });

    const jobTitle = job?.title || 'General Application';

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
              jobTitle,
            });
          }
        } catch (err) {
          console.error('Subscriber notification failed:', err);
        }
      })();
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

      if (!firstName || !lastName || !email) {
        return res.status(400).json({ error: 'First name, last name, and email are required' });
      }

      // Check permissions: admin/hiring_manager always allowed, reviewer only if assigned to a specific job
      if (!jobId) {
        // General pool: only admin/hiring_manager can add
        if (req.user!.role !== 'admin' && req.user!.role !== 'hiring_manager') {
          return res.status(403).json({ error: 'Insufficient permissions' });
        }
      } else if (req.user!.role === 'reviewer') {
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

      res.status(201).json(applicant);
    } catch (error) {
      console.error('Manual add applicant error:', error);
      res.status(500).json({ error: 'Failed to add applicant' });
    }
  }
);

// Update applicant stage (workflow)
router.patch('/:id/stage', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { stage } = req.body;

    const validStages = ['new', 'screening', 'interview', 'offer', 'hired', 'rejected', 'holding'];
    if (!stage || !validStages.includes(stage)) {
      return res.status(400).json({ error: 'Invalid stage. Valid stages: ' + validStages.join(', ') });
    }

    // Reviewer access control
    const existing = await prisma.applicant.findUnique({ where: { id }, select: { jobId: true } });
    if (!existing) {
      return res.status(404).json({ error: 'Applicant not found' });
    }
    const accessibleJobIds = await getAccessibleJobIds(req.user!);
    if (accessibleJobIds !== null && (!existing.jobId || !accessibleJobIds.includes(existing.jobId))) {
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
router.put('/:id', authenticate, async (req: AuthRequest, res: Response) => {
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

    // Reviewer access control
    const existing = await prisma.applicant.findUnique({ where: { id }, select: { jobId: true } });
    if (!existing) {
      return res.status(404).json({ error: 'Applicant not found' });
    }
    const accessibleJobIds = await getAccessibleJobIds(req.user!);
    if (accessibleJobIds !== null && (!existing.jobId || !accessibleJobIds.includes(existing.jobId))) {
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

    res.json(applicant);
  } catch (error) {
    console.error('Update applicant error:', error);
    res.status(500).json({ error: 'Failed to update applicant' });
  }
});

// Add note to applicant
router.post('/:id/notes', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'Note content is required' });
    }

    const applicant = await prisma.applicant.findUnique({ where: { id } });
    if (!applicant) {
      return res.status(404).json({ error: 'Applicant not found' });
    }

    // Reviewer access control
    const accessibleJobIds = await getAccessibleJobIds(req.user!);
    if (accessibleJobIds !== null && (!applicant.jobId || !accessibleJobIds.includes(applicant.jobId))) {
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

    // Reviewer access control
    const applicant = await prisma.applicant.findUnique({ where: { id }, select: { jobId: true } });
    if (!applicant) {
      return res.status(404).json({ error: 'Applicant not found' });
    }
    const accessibleJobIds = await getAccessibleJobIds(req.user!);
    if (accessibleJobIds !== null && (!applicant.jobId || !accessibleJobIds.includes(applicant.jobId))) {
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
router.post('/:id/send-rejection', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { emailBody } = req.body;

    if (!emailBody) {
      return res.status(400).json({ error: 'Email body is required' });
    }

    const applicant = await prisma.applicant.findUnique({
      where: { id },
      include: { job: { select: { title: true } } },
    });

    if (!applicant) {
      return res.status(404).json({ error: 'Applicant not found' });
    }

    // Reviewer access control
    const accessibleJobIds = await getAccessibleJobIds(req.user!);
    if (accessibleJobIds !== null && (!applicant.jobId || !accessibleJobIds.includes(applicant.jobId))) {
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
