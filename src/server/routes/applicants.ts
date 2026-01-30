import { Router, Response, Request } from 'express';
import prisma from '../db.js';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth.js';
import { uploadApplicationFiles } from '../middleware/upload.js';
import { sendRejectionEmail } from '../services/email.js';

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

    const applicants = await prisma.applicant.findMany({
      where,
      include: {
        job: {
          select: { id: true, title: true, department: true },
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
      yearsExperience,
      currentCompany,
      currentTitle,
      source,
      sourceDetails,
      referrer,
      utmSource,
      utmMedium,
      utmCampaign,
      utmContent,
    } = req.body;

    if (!jobId || !firstName || !lastName || !email) {
      return res.status(400).json({ error: 'Job ID, first name, last name, and email are required' });
    }

    // Verify job exists and is open
    const job = await prisma.job.findUnique({ where: { id: jobId } });
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

    // Get uploaded file paths
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const resumePath = files?.resume?.[0]?.filename ? `/uploads/resumes/${files.resume[0].filename}` : null;
    const portfolioPath = files?.portfolio?.[0]?.filename ? `/uploads/portfolios/${files.portfolio[0].filename}` : null;

    const applicant = await prisma.applicant.create({
      data: {
        jobId,
        firstName,
        lastName,
        email,
        phone,
        linkedIn,
        website,
        portfolioUrl,
        coverLetter,
        yearsExperience: yearsExperience ? parseInt(yearsExperience) : null,
        currentCompany,
        currentTitle,
        source: source || 'Direct Application',
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

    res.status(201).json(applicant);
  } catch (error) {
    console.error('Create applicant error:', error);
    res.status(500).json({ error: 'Failed to submit application' });
  }
});

// Manually add applicant (admin or hiring_manager only)
router.post(
  '/manual',
  authenticate,
  requireRole('admin', 'hiring_manager'),
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
        yearsExperience,
        currentCompany,
        currentTitle,
        source,
      } = req.body;

      if (!jobId || !firstName || !lastName || !email) {
        return res.status(400).json({ error: 'Job, first name, last name, and email are required' });
      }

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

      const applicant = await prisma.applicant.create({
        data: {
          jobId,
          firstName,
          lastName,
          email,
          phone: phone || null,
          linkedIn: linkedIn || null,
          website: website || null,
          portfolioUrl: portfolioUrl || null,
          coverLetter: coverLetter || null,
          yearsExperience: yearsExperience ? parseInt(yearsExperience) : null,
          currentCompany: currentCompany || null,
          currentTitle: currentTitle || null,
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
      yearsExperience,
      currentCompany,
      currentTitle,
    } = req.body;

    const updateData: Record<string, unknown> = {};
    if (firstName) updateData.firstName = firstName;
    if (lastName) updateData.lastName = lastName;
    if (email) updateData.email = email;
    if (phone !== undefined) updateData.phone = phone;
    if (linkedIn !== undefined) updateData.linkedIn = linkedIn;
    if (website !== undefined) updateData.website = website;
    if (portfolioUrl !== undefined) updateData.portfolioUrl = portfolioUrl;
    if (coverLetter !== undefined) updateData.coverLetter = coverLetter;
    if (yearsExperience !== undefined) updateData.yearsExperience = yearsExperience;
    if (currentCompany !== undefined) updateData.currentCompany = currentCompany;
    if (currentTitle !== undefined) updateData.currentTitle = currentTitle;

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

    // Send the rejection email (mock in staging)
    await sendRejectionEmail({
      to: applicant.email,
      applicantName: `${applicant.firstName} ${applicant.lastName}`,
      jobTitle: applicant.job.title,
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
