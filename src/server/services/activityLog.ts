import prisma from '../db.js';
import logger from '../lib/logger.js';

interface ActivityParams {
  applicantId?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Fire-and-forget activity logging. Never throws.
 */
export function logActivity(action: string, params: ActivityParams = {}) {
  const { applicantId, userId, metadata } = params;
  prisma.activityLog.create({
    data: {
      action,
      applicantId: applicantId || null,
      userId: userId || null,
      metadata: metadata ? JSON.stringify(metadata) : null,
    },
  }).catch((err) => {
    logger.error({ err, action, applicantId, userId }, 'Failed to log activity');
  });
}

/**
 * Returns Prisma create data for use inside transactions.
 */
export function activityLogData(action: string, params: ActivityParams = {}) {
  const { applicantId, userId, metadata } = params;
  return {
    action,
    applicantId: applicantId || null,
    userId: userId || null,
    metadata: metadata ? JSON.stringify(metadata) : null,
  };
}
