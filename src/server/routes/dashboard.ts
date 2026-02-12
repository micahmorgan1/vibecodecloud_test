import { Router, Response } from 'express';
import prisma from '../db.js';
import { authenticate, AuthRequest, getAccessibleApplicantFilter } from '../middleware/auth.js';
import logger from '../lib/logger.js';

const router = Router();

// Get dashboard overview stats
router.get('/stats', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const applicantFilter = await getAccessibleApplicantFilter(req.user!);
    const isReviewer = req.user!.role === 'reviewer';

    // Exclude spam from all stats
    const nonSpamFilter = { ...applicantFilter, spam: false };

    const [
      totalJobs,
      openJobs,
      totalApplicants,
      newApplicants,
      inReviewApplicants,
      totalReviews,
      generalPool,
      totalEvents,
      upcomingEvents,
      spamCount,
      upcomingInterviews,
    ] = await Promise.all([
      prisma.job.count({ where: { archived: false } }),
      prisma.job.count({ where: { archived: false, status: 'open' } }),
      prisma.applicant.count({ where: nonSpamFilter }),
      prisma.applicant.count({ where: { ...nonSpamFilter, stage: 'new' } }),
      prisma.applicant.count({ where: { ...nonSpamFilter, stage: { in: ['screening', 'interview'] } } }),
      isReviewer
        ? prisma.review.count({ where: { applicant: nonSpamFilter } })
        : prisma.review.count({ where: { applicant: { spam: false } } }),
      prisma.applicant.count({ where: { jobId: null, spam: false } }),
      prisma.recruitmentEvent.count(),
      prisma.recruitmentEvent.count({ where: { date: { gte: new Date() } } }),
      prisma.applicant.count({ where: { spam: true } }),
      prisma.interview.count({
        where: {
          status: 'scheduled',
          scheduledAt: { gte: new Date() },
          applicant: { spam: false },
        },
      }),
    ]);

    res.json({
      jobs: {
        total: totalJobs,
        open: openJobs,
      },
      applicants: {
        total: totalApplicants,
        new: newApplicants,
        inReview: inReviewApplicants,
        generalPool,
      },
      reviews: {
        total: totalReviews,
      },
      events: {
        total: totalEvents,
        upcoming: upcomingEvents,
      },
      spamCount,
      upcomingInterviews,
    });
  } catch (error) {
    logger.error({ err: error }, 'Get dashboard stats error');
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
});

// Get applicants by stage (pipeline view)
router.get('/pipeline', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const stages = ['fair_intake', 'new', 'screening', 'interview', 'offer', 'hired', 'rejected', 'holding'];
    const applicantFilter = await getAccessibleApplicantFilter(req.user!);

    const pipeline = await Promise.all(
      stages.map(async (stage) => {
        const where = { ...applicantFilter, stage, spam: false };
        const count = await prisma.applicant.count({ where });
        const applicants = await prisma.applicant.findMany({
          where,
          take: 5,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            createdAt: true,
            job: {
              select: { id: true, title: true },
            },
            _count: {
              select: { reviews: true },
            },
          },
        });
        return { stage, count, applicants };
      })
    );

    res.json(pipeline);
  } catch (error) {
    logger.error({ err: error }, 'Get pipeline error');
    res.status(500).json({ error: 'Failed to fetch pipeline data' });
  }
});

// Get recent activity
router.get('/activity', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const applicantFilter = await getAccessibleApplicantFilter(req.user!);
    const nonSpamFilter = { ...applicantFilter, spam: false };
    const reviewFilter = Object.keys(applicantFilter).length > 0 ? { applicant: nonSpamFilter } : { applicant: { spam: false } };

    const [recentApplicants, recentReviews] = await Promise.all([
      prisma.applicant.findMany({
        where: nonSpamFilter,
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          job: {
            select: { id: true, title: true },
          },
        },
      }),
      prisma.review.findMany({
        where: reviewFilter,
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          reviewer: {
            select: { id: true, name: true },
          },
          applicant: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      }),
    ]);

    res.json({
      recentApplicants,
      recentReviews,
    });
  } catch (error) {
    logger.error({ err: error }, 'Get activity error');
    res.status(500).json({ error: 'Failed to fetch activity' });
  }
});

// Get hiring funnel metrics
router.get('/funnel', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const applicantFilter = await getAccessibleApplicantFilter(req.user!);
    const nonSpamFilter = { ...applicantFilter, spam: false };

    const applicantsByStage = await prisma.applicant.groupBy({
      by: ['stage'],
      where: nonSpamFilter,
      _count: { id: true },
    });

    const applicantsLast30Days = await prisma.applicant.count({
      where: { ...nonSpamFilter, createdAt: { gte: thirtyDaysAgo } },
    });

    const hiredCount = await prisma.applicant.count({
      where: { ...nonSpamFilter, stage: 'hired' },
    });

    const totalApplicants = await prisma.applicant.count({ where: nonSpamFilter });

    res.json({
      stages: applicantsByStage.reduce((acc, item) => {
        acc[item.stage] = item._count.id;
        return acc;
      }, {} as Record<string, number>),
      last30Days: applicantsLast30Days,
      conversionRate: totalApplicants > 0 ? (hiredCount / totalApplicants) * 100 : 0,
    });
  } catch (error) {
    logger.error({ err: error }, 'Get funnel error');
    res.status(500).json({ error: 'Failed to fetch funnel data' });
  }
});

// Get top rated applicants
router.get('/top-applicants', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const applicantFilter = await getAccessibleApplicantFilter(req.user!);

    const applicantsWithReviews = await prisma.applicant.findMany({
      where: {
        ...applicantFilter,
        spam: false,
        stage: { notIn: ['rejected', 'hired'] },
        reviews: { some: {} },
      },
      include: {
        job: {
          select: { id: true, title: true },
        },
        reviews: true,
      },
    });

    // Calculate average ratings and sort
    const ranked = applicantsWithReviews
      .map((applicant) => {
        const avgRating =
          applicant.reviews.reduce((sum, r) => sum + r.rating, 0) / applicant.reviews.length;
        return {
          ...applicant,
          averageRating: avgRating,
          reviewCount: applicant.reviews.length,
        };
      })
      .sort((a, b) => b.averageRating - a.averageRating)
      .slice(0, 10);

    res.json(ranked);
  } catch (error) {
    logger.error({ err: error }, 'Get top applicants error');
    res.status(500).json({ error: 'Failed to fetch top applicants' });
  }
});

// Get source analytics
router.get('/sources', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { startDate, endDate } = req.query;

    const applicantAccessFilter = await getAccessibleApplicantFilter(req.user!);
    const where: Record<string, unknown> = { ...applicantAccessFilter, spam: false };
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        (where.createdAt as Record<string, unknown>).gte = new Date(startDate as string);
      }
      if (endDate) {
        (where.createdAt as Record<string, unknown>).lte = new Date(endDate as string);
      }
    }

    const applicants = await prisma.applicant.findMany({
      where,
      select: {
        source: true,
        utmSource: true,
        utmMedium: true,
        utmCampaign: true,
        stage: true,
      },
    });

    // Group by source
    const sourceBreakdown = applicants.reduce((acc, app) => {
      const source = app.source || 'Unknown';
      if (!acc[source]) {
        acc[source] = { total: 0, hired: 0, rejected: 0 };
      }
      acc[source].total++;
      if (app.stage === 'hired') acc[source].hired++;
      if (app.stage === 'rejected') acc[source].rejected++;
      return acc;
    }, {} as Record<string, { total: number; hired: number; rejected: number }>);

    res.json({ sourceBreakdown });
  } catch (error) {
    logger.error({ err: error }, 'Get source analytics error');
    res.status(500).json({ error: 'Failed to fetch source analytics' });
  }
});

// Get upcoming events
router.get('/upcoming-events', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const events = await prisma.recruitmentEvent.findMany({
      where: { date: { gte: new Date() } },
      orderBy: { date: 'asc' },
      take: 3,
      include: {
        _count: { select: { applicants: true } },
      },
    });
    res.json(events);
  } catch (error) {
    logger.error({ err: error }, 'Get upcoming events error');
    res.status(500).json({ error: 'Failed to fetch upcoming events' });
  }
});

export default router;
