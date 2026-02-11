import prisma from '../db.js';
import logger from '../lib/logger.js';

interface CreateNotificationParams {
  userId: string;
  type: string;
  title: string;
  message: string;
  link?: string;
}

/**
 * Create a single notification. Fire-and-forget — never throws.
 */
export async function createNotification(params: CreateNotificationParams): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        userId: params.userId,
        type: params.type,
        title: params.title,
        message: params.message,
        link: params.link,
      },
    });
  } catch (err) {
    logger.error({ err, params }, 'Failed to create notification');
  }
}

interface NotifyJobSubscribersParams {
  jobId: string | null;
  type: string;
  title: string;
  message: string;
  link?: string;
  excludeUserId?: string;
}

/**
 * Notify all users subscribed to a job. Fire-and-forget — never throws.
 */
export async function notifyJobSubscribers(params: NotifyJobSubscribersParams): Promise<void> {
  try {
    if (!params.jobId) return;

    const subs = await prisma.jobNotificationSub.findMany({
      where: { jobId: params.jobId },
      select: { userId: true },
    });

    const userIds = subs
      .map(s => s.userId)
      .filter(id => id !== params.excludeUserId);

    if (userIds.length === 0) return;

    await prisma.notification.createMany({
      data: userIds.map(userId => ({
        userId,
        type: params.type,
        title: params.title,
        message: params.message,
        link: params.link,
      })),
    });
  } catch (err) {
    logger.error({ err, params }, 'Failed to notify job subscribers');
  }
}

interface NotifyUsersParams {
  userIds: string[];
  type: string;
  title: string;
  message: string;
  link?: string;
}

/**
 * Bulk-create notifications for a list of users. Fire-and-forget — never throws.
 */
export async function notifyUsers(params: NotifyUsersParams): Promise<void> {
  try {
    if (params.userIds.length === 0) return;

    await prisma.notification.createMany({
      data: params.userIds.map(userId => ({
        userId,
        type: params.type,
        title: params.title,
        message: params.message,
        link: params.link,
      })),
    });
  } catch (err) {
    logger.error({ err, params }, 'Failed to notify users');
  }
}
