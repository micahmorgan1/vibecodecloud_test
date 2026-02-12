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

interface NotifySubscribersParams {
  jobId: string | null;
  eventId?: string;
  department?: string;
  officeId?: string | null;
  type: string;
  title: string;
  message: string;
  link?: string;
  excludeUserId?: string;
}

/**
 * Notify all users who match any subscription: job, department, office, or "all".
 * "all" subscribers are included if the triggering job falls within their access scope.
 * Also checks legacy JobNotificationSub for backwards compatibility.
 * Fire-and-forget — never throws.
 */
export async function notifySubscribers(params: NotifySubscribersParams): Promise<void> {
  try {
    const conditions: { type: string; value: string }[] = [];
    if (params.jobId) conditions.push({ type: 'job', value: params.jobId });
    if (params.department) conditions.push({ type: 'department', value: params.department });
    if (params.officeId) conditions.push({ type: 'office', value: params.officeId });
    if (params.eventId) conditions.push({ type: 'event', value: params.eventId });

    const userIdSet = new Set<string>();

    // Check new NotificationSub table (specific subscriptions)
    if (conditions.length > 0) {
      const subs = await prisma.notificationSub.findMany({
        where: { OR: conditions },
        select: { userId: true },
      });
      subs.forEach(s => userIdSet.add(s.userId));
    }

    // Check "all" subscribers — they get notified for everything they have access to
    const allSubs = await prisma.notificationSub.findMany({
      where: { type: 'all' },
      select: { userId: true, user: { select: { id: true, role: true, scopedDepartments: true, scopedOffices: true, scopeMode: true } } },
    });
    for (const sub of allSubs) {
      const u = sub.user;
      // Admin and global HMs get everything
      if (u.role === 'admin') {
        userIdSet.add(u.id);
        continue;
      }
      if (u.role === 'hiring_manager') {
        if (!u.scopedDepartments && !u.scopedOffices) {
          userIdSet.add(u.id); // global HM
          continue;
        }
        // Scoped HM — check if job matches their scope, respecting AND/OR mode
        const depts: string[] = u.scopedDepartments ? JSON.parse(u.scopedDepartments) : [];
        const offices: string[] = u.scopedOffices ? JSON.parse(u.scopedOffices) : [];
        const deptMatch = depts.length === 0 || (params.department && depts.includes(params.department));
        const officeMatch = offices.length === 0 || (params.officeId && offices.includes(params.officeId));

        if (u.scopeMode === 'and') {
          if (deptMatch && officeMatch) userIdSet.add(u.id);
        } else {
          if (deptMatch || officeMatch) userIdSet.add(u.id);
        }
        continue;
      }
      // Reviewer — check if assigned to this job or event
      if (u.role === 'reviewer') {
        if (params.jobId) {
          const jobAssigned = await prisma.jobReviewer.findUnique({
            where: { userId_jobId: { userId: u.id, jobId: params.jobId } },
          });
          if (jobAssigned) { userIdSet.add(u.id); continue; }
        }
        if (params.eventId) {
          const eventAssigned = await prisma.eventReviewer.findUnique({
            where: { userId_eventId: { userId: u.id, eventId: params.eventId } },
          });
          if (eventAssigned) userIdSet.add(u.id);
        }
      }
    }

    // Also check legacy JobNotificationSub for backwards compatibility
    if (params.jobId) {
      const legacySubs = await prisma.jobNotificationSub.findMany({
        where: { jobId: params.jobId },
        select: { userId: true },
      });
      legacySubs.forEach(s => userIdSet.add(s.userId));
    }

    // Exclude acting user
    if (params.excludeUserId) userIdSet.delete(params.excludeUserId);

    if (userIdSet.size === 0) return;

    await prisma.notification.createMany({
      data: [...userIdSet].map(userId => ({
        userId,
        type: params.type,
        title: params.title,
        message: params.message,
        link: params.link,
      })),
    });
  } catch (err) {
    logger.error({ err, params }, 'Failed to notify subscribers');
  }
}

/**
 * @deprecated Use notifySubscribers instead. Kept for backwards compatibility.
 */
export async function notifyJobSubscribers(params: {
  jobId: string | null;
  type: string;
  title: string;
  message: string;
  link?: string;
  excludeUserId?: string;
}): Promise<void> {
  return notifySubscribers(params);
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
