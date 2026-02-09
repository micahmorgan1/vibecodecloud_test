import { Router, Response } from 'express';
import prisma from '../db.js';
import { authenticate, AuthRequest, getAccessibleJobIds } from '../middleware/auth.js';

const router = Router();

// Get dashboard overview stats
router.get('/stats', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const accessibleJobIds = await getAccessibleJobIds(req.user!);
    const jobFilter = accessibleJobIds !== null ? { id: { in: accessibleJobIds } } : {};
    const applicantFilter = accessibleJobIds !== null ? { jobId: { in: accessibleJobIds } } : {};

    const [
      totalJobs,
      openJobs,
      totalApplicants,
      newApplicants,
      inReviewApplicants,
      totalReviews,
    ] = await Promise.all([
      prisma.job.count({ where: jobFilter }),
      prisma.job.count({ where: { ...jobFilter, status: 'open' } }),
      prisma.applicant.count({ where: applicantFilter }),
      prisma.applicant.count({ where: { ...applicantFilter, stage: 'new' } }),
      prisma.applicant.count({ where: { ...applicantFilter, stage: { in: ['screening', 'interview'] } } }),
      prisma.review.count(accessibleJobIds !== null ? { where: { applicant: { jobId: { in: accessibleJobIds } } } } : undefined),
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
      },
      reviews: {
        total: totalReviews,
      },
    });
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
});

// Get applicants by stage (pipeline view)
router.get('/pipeline', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const stages = ['new', 'screening', 'interview', 'offer', 'hired', 'rejected', 'holding'];
    const accessibleJobIds = await getAccessibleJobIds(req.user!);
    const applicantFilter = accessibleJobIds !== null ? { jobId: { in: accessibleJobIds } } : {};

    const pipeline = await Promise.all(
      stages.map(async (stage) => {
        const where = { ...applicantFilter, stage };
        const count = await prisma.applicant.count({ where });
        const applicants = await prisma.applicant.findMany({
          where,
          take: 5,
          orderBy: { createdAt: 'desc' },
          include: {
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
    console.error('Get pipeline error:', error);
    res.status(500).json({ error: 'Failed to fetch pipeline data' });
  }
});

// Get recent activity
router.get('/activity', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const accessibleJobIds = await getAccessibleJobIds(req.user!);
    const applicantFilter = accessibleJobIds !== null ? { jobId: { in: accessibleJobIds } } : {};
    const reviewFilter = accessibleJobIds !== null ? { applicant: { jobId: { in: accessibleJobIds } } } : {};

    const [recentApplicants, recentReviews] = await Promise.all([
      prisma.applicant.findMany({
        where: applicantFilter,
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
    console.error('Get activity error:', error);
    res.status(500).json({ error: 'Failed to fetch activity' });
  }
});

// Get hiring funnel metrics
router.get('/funnel', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const accessibleJobIds = await getAccessibleJobIds(req.user!);
    const applicantFilter = accessibleJobIds !== null ? { jobId: { in: accessibleJobIds } } : {};

    const applicantsByStage = await prisma.applicant.groupBy({
      by: ['stage'],
      where: applicantFilter,
      _count: { id: true },
    });

    const applicantsLast30Days = await prisma.applicant.count({
      where: { ...applicantFilter, createdAt: { gte: thirtyDaysAgo } },
    });

    const hiredCount = await prisma.applicant.count({
      where: { ...applicantFilter, stage: 'hired' },
    });

    const totalApplicants = await prisma.applicant.count({ where: applicantFilter });

    res.json({
      stages: applicantsByStage.reduce((acc, item) => {
        acc[item.stage] = item._count.id;
        return acc;
      }, {} as Record<string, number>),
      last30Days: applicantsLast30Days,
      conversionRate: totalApplicants > 0 ? (hiredCount / totalApplicants) * 100 : 0,
    });
  } catch (error) {
    console.error('Get funnel error:', error);
    res.status(500).json({ error: 'Failed to fetch funnel data' });
  }
});

// Get top rated applicants
router.get('/top-applicants', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const accessibleJobIds = await getAccessibleJobIds(req.user!);
    const applicantFilter = accessibleJobIds !== null ? { jobId: { in: accessibleJobIds } } : {};

    const applicantsWithReviews = await prisma.applicant.findMany({
      where: {
        ...applicantFilter,
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
    console.error('Get top applicants error:', error);
    res.status(500).json({ error: 'Failed to fetch top applicants' });
  }
});

// Get source analytics
router.get('/sources', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { startDate, endDate } = req.query;

    const accessibleJobIds = await getAccessibleJobIds(req.user!);
    const where: Record<string, unknown> = accessibleJobIds !== null ? { jobId: { in: accessibleJobIds } } : {};
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
    console.error('Get source analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch source analytics' });
  }
});

export default router;
