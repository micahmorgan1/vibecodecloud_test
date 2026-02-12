import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../db.js';

if (!process.env.JWT_SECRET) {
  throw new Error('FATAL: JWT_SECRET environment variable is required. Set it in .env or your hosting provider.');
}
const JWT_SECRET: string = process.env.JWT_SECRET;

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    scopedDepartments?: string[] | null;
    scopedOffices?: string[] | null;
    scopeMode?: string;
    eventAccess?: boolean;
    offerAccess?: boolean;
  };
}

export async function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
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
      tokenVersion?: number;
    };

    // Verify tokenVersion against DB (and fetch scope for HMs)
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { tokenVersion: true, role: true, scopedDepartments: true, scopedOffices: true, scopeMode: true, eventAccess: true, offerAccess: true },
    });
    if (!user || (decoded.tokenVersion ?? 0) !== user.tokenVersion) {
      return res.status(401).json({ error: 'Token revoked' });
    }

    const authUser: AuthRequest['user'] = { id: decoded.id, email: decoded.email, role: decoded.role };

    // Populate scope fields for hiring managers
    if (user.role === 'hiring_manager') {
      authUser!.scopedDepartments = user.scopedDepartments ? JSON.parse(user.scopedDepartments) : null;
      authUser!.scopedOffices = user.scopedOffices ? JSON.parse(user.scopedOffices) : null;
      authUser!.scopeMode = user.scopeMode;
      authUser!.eventAccess = user.eventAccess;
      authUser!.offerAccess = user.offerAccess;
    }

    req.user = authUser;
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

export function generateToken(user: { id: string; email: string; role: string; tokenVersion?: number }) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, tokenVersion: user.tokenVersion ?? 0 },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

/**
 * Returns null for admin/global HM (no filtering needed).
 * Returns an array of accessible jobIds for reviewers and scoped HMs.
 */
export async function getAccessibleJobIds(user: { id: string; role: string; scopedDepartments?: string[] | null; scopedOffices?: string[] | null; scopeMode?: string }): Promise<string[] | null> {
  if (user.role === 'admin') {
    return null; // no filtering
  }

  if (user.role === 'hiring_manager') {
    // If no scope fields set, this is a global HM
    if (!user.scopedDepartments && !user.scopedOffices) return null;

    const mode = user.scopeMode || 'or';
    const deptCondition = user.scopedDepartments && user.scopedDepartments.length > 0
      ? { department: { in: user.scopedDepartments } }
      : null;
    const officeCondition = user.scopedOffices && user.scopedOffices.length > 0
      ? { officeId: { in: user.scopedOffices } }
      : null;

    if (!deptCondition && !officeCondition) return []; // scoped but empty = see nothing

    let where: Record<string, unknown>;
    if (!deptCondition || !officeCondition) {
      // Only one dimension specified — use it directly
      where = deptCondition || officeCondition!;
    } else if (mode === 'and') {
      // AND mode: jobs must match BOTH a scoped department AND a scoped office
      where = { AND: [deptCondition, officeCondition] };
    } else {
      // OR mode (default): jobs matching either department OR office
      where = { OR: [deptCondition, officeCondition] };
    }

    const jobs = await prisma.job.findMany({
      where,
      select: { id: true },
    });
    return jobs.map(j => j.id);
  }

  // Reviewer
  const assignments = await prisma.jobReviewer.findMany({
    where: { userId: user.id },
    select: { jobId: true },
  });
  return assignments.map((a) => a.jobId);
}

/**
 * Returns null for admin/global HM with eventAccess (no filtering needed).
 * Returns [] for HMs with eventAccess: false (no events).
 * Returns an array of accessible eventIds for reviewers (via EventReviewer).
 */
export async function getAccessibleEventIds(user: { id: string; role: string; eventAccess?: boolean }): Promise<string[] | null> {
  if (user.role === 'admin') {
    return null;
  }
  if (user.role === 'hiring_manager') {
    if (user.eventAccess === false) return [];
    return null;
  }
  // Reviewer — use EventReviewer for access control
  const assignments = await prisma.eventReviewer.findMany({
    where: { userId: user.id },
    select: { eventId: true },
  });
  return assignments.map((a) => a.eventId);
}

/**
 * Returns a Prisma WHERE clause for applicant queries that combines job + event access.
 * Admin/global HM: returns {} (no filter).
 * Scoped HM: returns { jobId: { in: [...] } }.
 * Reviewer: returns OR clause covering assigned jobs and assigned events.
 */
export async function getAccessibleApplicantFilter(user: { id: string; role: string; scopedDepartments?: string[] | null; scopedOffices?: string[] | null; scopeMode?: string }): Promise<Record<string, unknown>> {
  if (user.role === 'admin') {
    return {};
  }

  if (user.role === 'hiring_manager') {
    // Global HM — no filter
    if (!user.scopedDepartments && !user.scopedOffices) return {};

    // Scoped HM — derive job IDs from scope
    const jobIds = await getAccessibleJobIds(user);
    if (jobIds === null) return {};
    if (jobIds.length === 0) return { id: 'none' };
    return { jobId: { in: jobIds } };
  }

  // Reviewer
  const [jobAssignments, eventAssignments] = await Promise.all([
    prisma.jobReviewer.findMany({ where: { userId: user.id }, select: { jobId: true } }),
    prisma.eventReviewer.findMany({ where: { userId: user.id }, select: { eventId: true } }),
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
