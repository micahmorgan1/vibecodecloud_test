import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../db.js';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth.js';
import { validateBody } from '../middleware/validateBody.js';
import { userCreateSchema, userUpdateSchema } from '../schemas/index.js';
import { parsePagination, prismaSkipTake, paginatedResponse } from '../utils/pagination.js';
import logger from '../lib/logger.js';

/** Parse JSON scope strings to arrays for API response */
function parseUserScope(user: { scopedDepartments: string | null; scopedOffices: string | null; [key: string]: unknown }) {
  return {
    ...user,
    scopedDepartments: user.scopedDepartments ? JSON.parse(user.scopedDepartments) : null,
    scopedOffices: user.scopedOffices ? JSON.parse(user.scopedOffices) : null,
  };
}

/** Convert scope arrays to JSON strings for DB storage. Clears to null for non-HM roles. */
function scopeDataForRole(role: string | undefined, scopedDepartments?: string[] | null, scopedOffices?: string[] | null, scopeMode?: string, eventAccess?: boolean, offerAccess?: boolean) {
  if (role !== 'hiring_manager') {
    return { scopedDepartments: null, scopedOffices: null, scopeMode: 'or', eventAccess: true, offerAccess: false };
  }
  return {
    scopedDepartments: scopedDepartments && scopedDepartments.length > 0 ? JSON.stringify(scopedDepartments) : null,
    scopedOffices: scopedOffices && scopedOffices.length > 0 ? JSON.stringify(scopedOffices) : null,
    scopeMode: scopeMode || 'or',
    eventAccess: eventAccess !== undefined ? eventAccess : true,
    offerAccess: offerAccess !== undefined ? offerAccess : false,
  };
}

const router = Router();

// Get all users (with optional filters)
router.get('/', authenticate, requireRole('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { role, search } = req.query;

    const where: Record<string, unknown> = {};
    if (role) where.role = role as string;
    if (search) {
      where.OR = [
        { name: { contains: search as string } },
        { email: { contains: search as string } },
      ];
    }

    const pagination = parsePagination(req.query);

    const selectClause = {
      id: true, name: true, email: true, role: true, createdAt: true,
      scopedDepartments: true, scopedOffices: true, scopeMode: true, eventAccess: true, offerAccess: true,
    };

    if (pagination) {
      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where,
          select: selectClause,
          orderBy: { createdAt: 'desc' },
          ...prismaSkipTake(pagination),
        }),
        prisma.user.count({ where }),
      ]);
      const parsed = users.map(parseUserScope);
      return res.json(paginatedResponse(parsed, total, pagination));
    }

    const users = await prisma.user.findMany({
      where,
      select: selectClause,
      orderBy: { createdAt: 'desc' },
    });
    res.json(users.map(parseUserScope));
  } catch (error) {
    logger.error({ err: error }, 'Get users error');
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Create a new user
router.post('/', authenticate, requireRole('admin'), validateBody(userCreateSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { email, name, password, role, scopedDepartments, scopedOffices, scopeMode, eventAccess, offerAccess } = req.body;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(400).json({ error: 'A user with this email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const scopeData = scopeDataForRole(role, scopedDepartments, scopedOffices, scopeMode, eventAccess, offerAccess);

    const user = await prisma.user.create({
      data: { email, name, password: hashedPassword, role, ...scopeData },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        scopedDepartments: true,
        scopedOffices: true,
        eventAccess: true,
        offerAccess: true,
      },
    });

    res.status(201).json(parseUserScope(user));
  } catch (error) {
    logger.error({ err: error }, 'Create user error');
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Update a user
router.put('/:id', authenticate, requireRole('admin'), validateBody(userUpdateSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, email, role, password, scopedDepartments, scopedOffices, scopeMode, eventAccess, offerAccess } = req.body;

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (email && email !== existing.email) {
      const emailTaken = await prisma.user.findUnique({ where: { email } });
      if (emailTaken) {
        return res.status(400).json({ error: 'A user with this email already exists' });
      }
    }

    const updateData: Record<string, unknown> = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (role) updateData.role = role;
    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
      updateData.tokenVersion = { increment: 1 };
    }

    // Handle scope fields
    const effectiveRole = role || existing.role;
    const scopeData = scopeDataForRole(effectiveRole, scopedDepartments, scopedOffices, scopeMode, eventAccess, offerAccess);
    // Only update scope if provided or role changed
    if (scopedDepartments !== undefined || scopedOffices !== undefined || scopeMode !== undefined || eventAccess !== undefined || offerAccess !== undefined || (role && role !== existing.role)) {
      updateData.scopedDepartments = scopeData.scopedDepartments;
      updateData.scopedOffices = scopeData.scopedOffices;
      updateData.scopeMode = scopeData.scopeMode;
      updateData.eventAccess = scopeData.eventAccess;
      updateData.offerAccess = scopeData.offerAccess;
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        scopedDepartments: true,
        scopedOffices: true,
        eventAccess: true,
        offerAccess: true,
      },
    });

    res.json(parseUserScope(user));
  } catch (error) {
    logger.error({ err: error }, 'Update user error');
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Delete a user
router.delete('/:id', authenticate, requireRole('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    if (req.user!.id === id) {
      return res.status(400).json({ error: 'You cannot delete your own account' });
    }

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'User not found' });
    }

    await prisma.user.delete({ where: { id } });

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    logger.error({ err: error }, 'Delete user error');
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

export default router;
