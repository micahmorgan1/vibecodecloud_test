import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

export function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as {
      id: string;
      email: string;
      role: string;
    };
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
}

export function generateToken(user: { id: string; email: string; role: string }) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

/**
 * Returns null for admin/hiring_manager (no filtering needed).
 * Returns an array of accessible jobIds for reviewers.
 */
export async function getAccessibleJobIds(user: { id: string; role: string }): Promise<string[] | null> {
  if (user.role === 'admin' || user.role === 'hiring_manager') {
    return null; // no filtering
  }
  const assignments = await prisma.jobReviewer.findMany({
    where: { userId: user.id },
    select: { jobId: true },
  });
  return assignments.map((a) => a.jobId);
}

/**
 * Returns null for admin/hiring_manager (no filtering needed).
 * Returns an array of accessible eventIds for reviewers.
 */
export async function getAccessibleEventIds(user: { id: string; role: string }): Promise<string[] | null> {
  if (user.role === 'admin' || user.role === 'hiring_manager') {
    return null;
  }
  const attendees = await prisma.eventAttendee.findMany({
    where: { userId: user.id },
    select: { eventId: true },
  });
  return attendees.map((a) => a.eventId);
}

/**
 * Returns a Prisma WHERE clause for applicant queries that combines job + event access.
 * Admin/HM: returns {} (no filter).
 * Reviewer: returns OR clause covering assigned jobs and assigned events.
 */
export async function getAccessibleApplicantFilter(user: { id: string; role: string }): Promise<Record<string, unknown>> {
  if (user.role === 'admin' || user.role === 'hiring_manager') {
    return {};
  }
  const [jobAssignments, eventAssignments] = await Promise.all([
    prisma.jobReviewer.findMany({ where: { userId: user.id }, select: { jobId: true } }),
    prisma.eventAttendee.findMany({ where: { userId: user.id }, select: { eventId: true } }),
  ]);
  const jobIds = jobAssignments.map((a) => a.jobId);
  const eventIds = eventAssignments.map((a) => a.eventId);

  if (jobIds.length === 0 && eventIds.length === 0) {
    return { id: 'none' };
  }

  const conditions: Record<string, unknown>[] = [];
  if (jobIds.length > 0) {
    conditions.push({ jobId: { in: jobIds } });
  }
  if (eventIds.length > 0) {
    conditions.push({ eventId: { in: eventIds } });
  }
  return { OR: conditions };
}
