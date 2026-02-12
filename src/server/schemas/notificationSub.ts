import { z } from 'zod';
import { stripHtml } from '../utils/sanitize.js';

export const notificationSubSchema = z.object({
  type: z.enum(['job', 'department', 'office', 'event', 'all']),
  value: z.string().trim().min(1).max(500).transform(stripHtml),
});

export const bulkNotificationSubSchema = z.object({
  subscriptions: z.array(notificationSubSchema).max(200),
});
