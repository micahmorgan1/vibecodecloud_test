import { Router, Response } from 'express';
import prisma from '../db.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

const router = Router();

// Get all reviews for an applicant
router.get('/applicant/:applicantId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { applicantId } = req.params;

    const reviews = await prisma.review.findMany({
      where: { applicantId },
      include: {
        reviewer: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(reviews);
  } catch (error) {
    console.error('Get reviews error:', error);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

// Get review summary/average for an applicant
router.get('/applicant/:applicantId/summary', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { applicantId } = req.params;

    const reviews = await prisma.review.findMany({
      where: { applicantId },
    });

    if (reviews.length === 0) {
      return res.json({
        totalReviews: 0,
        averages: null,
        recommendations: {},
      });
    }

    // Calculate averages
    const sum = {
      rating: 0,
      technicalSkills: 0,
      designAbility: 0,
      portfolioQuality: 0,
      communication: 0,
      cultureFit: 0,
    };

    const counts = {
      rating: 0,
      technicalSkills: 0,
      designAbility: 0,
      portfolioQuality: 0,
      communication: 0,
      cultureFit: 0,
    };

    const recommendations: Record<string, number> = {};

    reviews.forEach((review) => {
      sum.rating += review.rating;
      counts.rating++;

      if (review.technicalSkills) {
        sum.technicalSkills += review.technicalSkills;
        counts.technicalSkills++;
      }
      if (review.designAbility) {
        sum.designAbility += review.designAbility;
        counts.designAbility++;
      }
      if (review.portfolioQuality) {
        sum.portfolioQuality += review.portfolioQuality;
        counts.portfolioQuality++;
      }
      if (review.communication) {
        sum.communication += review.communication;
        counts.communication++;
      }
      if (review.cultureFit) {
        sum.cultureFit += review.cultureFit;
        counts.cultureFit++;
      }

      if (review.recommendation) {
        recommendations[review.recommendation] = (recommendations[review.recommendation] || 0) + 1;
      }
    });

    res.json({
      totalReviews: reviews.length,
      averages: {
        overall: counts.rating > 0 ? sum.rating / counts.rating : null,
        technicalSkills: counts.technicalSkills > 0 ? sum.technicalSkills / counts.technicalSkills : null,
        designAbility: counts.designAbility > 0 ? sum.designAbility / counts.designAbility : null,
        portfolioQuality: counts.portfolioQuality > 0 ? sum.portfolioQuality / counts.portfolioQuality : null,
        communication: counts.communication > 0 ? sum.communication / counts.communication : null,
        cultureFit: counts.cultureFit > 0 ? sum.cultureFit / counts.cultureFit : null,
      },
      recommendations,
    });
  } catch (error) {
    console.error('Get review summary error:', error);
    res.status(500).json({ error: 'Failed to fetch review summary' });
  }
});

// Create or update a review
router.post('/applicant/:applicantId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { applicantId } = req.params;
    const {
      rating,
      technicalSkills,
      designAbility,
      portfolioQuality,
      communication,
      cultureFit,
      recommendation,
      comments,
    } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating is required and must be between 1 and 5' });
    }

    // Validate other ratings if provided
    const ratingFields = { technicalSkills, designAbility, portfolioQuality, communication, cultureFit };
    for (const [field, value] of Object.entries(ratingFields)) {
      if (value !== undefined && value !== null && (value < 1 || value > 5)) {
        return res.status(400).json({ error: `${field} must be between 1 and 5` });
      }
    }

    // Validate recommendation
    const validRecommendations = ['strong_yes', 'yes', 'maybe', 'no', 'strong_no'];
    if (recommendation && !validRecommendations.includes(recommendation)) {
      return res.status(400).json({ error: 'Invalid recommendation value' });
    }

    // Check if applicant exists
    const applicant = await prisma.applicant.findUnique({ where: { id: applicantId } });
    if (!applicant) {
      return res.status(404).json({ error: 'Applicant not found' });
    }

    // Upsert review (one review per reviewer per applicant)
    const review = await prisma.review.upsert({
      where: {
        reviewerId_applicantId: {
          reviewerId: req.user!.id,
          applicantId,
        },
      },
      update: {
        rating,
        technicalSkills,
        designAbility,
        portfolioQuality,
        communication,
        cultureFit,
        recommendation,
        comments,
      },
      create: {
        reviewerId: req.user!.id,
        applicantId,
        rating,
        technicalSkills,
        designAbility,
        portfolioQuality,
        communication,
        cultureFit,
        recommendation,
        comments,
      },
      include: {
        reviewer: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    res.status(201).json(review);
  } catch (error) {
    console.error('Create review error:', error);
    res.status(500).json({ error: 'Failed to create review' });
  }
});

// Get current user's review for an applicant
router.get('/applicant/:applicantId/mine', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { applicantId } = req.params;

    const review = await prisma.review.findUnique({
      where: {
        reviewerId_applicantId: {
          reviewerId: req.user!.id,
          applicantId,
        },
      },
    });

    res.json(review);
  } catch (error) {
    console.error('Get my review error:', error);
    res.status(500).json({ error: 'Failed to fetch review' });
  }
});

// Delete a review (only own review or admin)
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const review = await prisma.review.findUnique({ where: { id } });
    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }

    if (review.reviewerId !== req.user!.id && req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'You can only delete your own reviews' });
    }

    await prisma.review.delete({ where: { id } });

    res.json({ message: 'Review deleted successfully' });
  } catch (error) {
    console.error('Delete review error:', error);
    res.status(500).json({ error: 'Failed to delete review' });
  }
});

export default router;
