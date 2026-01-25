import { Router, Response } from 'express';
import prisma from '../db.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

const router = Router();

// Get dashboard overview stats
router.get('/stats', authenticate, async (_req: AuthRequest, res: Response) => {
  try {
    const [
      totalJobs,
      openJobs,
      totalApplicants,
      newApplicants,
      inReviewApplicants,
      totalReviews,
    ] = await Promise.all([
      prisma.job.count(),
      prisma.job.count({ where: { status: 'open' } }),
      prisma.applicant.count(),
      prisma.applicant.count({ where: { stage: 'new' } }),
      prisma.applicant.count({ where: { stage: { in: ['screening', 'interview'] } } }),
      prisma.review.count(),
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
router.get('/pipeline', authenticate, async (_req: AuthRequest, res: Response) => {
  try {
    const stages = ['new', 'screening', 'interview', 'offer', 'hired', 'rejected'];

    const pipeline = await Promise.all(
      stages.map(async (stage) => {
        const count = await prisma.applicant.count({ where: { stage } });
        const applicants = await prisma.applicant.findMany({
          where: { stage },
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
router.get('/activity', authenticate, async (_req: AuthRequest, res: Response) => {
  try {
    const [recentApplicants, recentReviews] = await Promise.all([
      prisma.applicant.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          job: {
            select: { id: true, title: true },
          },
        },
      }),
      prisma.review.findMany({
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
router.get('/funnel', authenticate, async (_req: AuthRequest, res: Response) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const applicantsByStage = await prisma.applicant.groupBy({
      by: ['stage'],
      _count: { id: true },
    });

    const applicantsLast30Days = await prisma.applicant.count({
      where: { createdAt: { gte: thirtyDaysAgo } },
    });

    const hiredCount = await prisma.applicant.count({
      where: { stage: 'hired' },
    });

    const totalApplicants = await prisma.applicant.count();

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
router.get('/top-applicants', authenticate, async (_req: AuthRequest, res: Response) => {
  try {
    const applicantsWithReviews = await prisma.applicant.findMany({
      where: {
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

export default router;
