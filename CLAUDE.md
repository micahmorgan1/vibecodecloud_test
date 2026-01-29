# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

WHLC Architecture Applicant Tracking System — a full-stack monorepo with a React frontend and Express backend using SQLite via Prisma.

## Commands

```bash
npm run dev            # Run client (port 3000) + server (port 3001) concurrently
npm run client:dev     # Vite dev server only
npm run server:dev     # Express server with tsx watch (hot reload)
npm run build          # Build both client and server
npm start              # Run production server (serves built client)

npm run db:push        # Sync Prisma schema to database
npm run db:seed        # Seed database with demo data
npm run db:studio      # Open Prisma Studio GUI
```

No test framework is configured.

## Architecture

**Client** (`src/client/`): React 18 + React Router 6 + TailwindCSS, built with Vite. Pages are in `src/client/pages/`, auth state lives in `src/client/context/AuthContext.tsx`, and `src/client/lib/api.ts` is a singleton fetch wrapper that auto-attaches JWT tokens from localStorage.

**Server** (`src/server/`): Express on port 3001. Routes are in `src/server/routes/` (auth, jobs, applicants, reviews, users, dashboard). JWT authentication middleware is in `src/server/middleware/auth.ts`. File uploads (multer) go to `uploads/resumes/` and `uploads/portfolios/`.

**Database**: SQLite (`prisma/dev.db`). Schema is in `prisma/schema.prisma`. Models: User, Job, Applicant, Review, Note. One review per reviewer per applicant (upsert pattern).

**Dev proxy**: Vite proxies `/api` and `/uploads` to `localhost:3001`. In production, Express serves the built client and handles SPA fallback.

## Roles & Auth

Three roles with cascading permissions:
- **admin**: Full access including user management and applicant deletion
- **hiring_manager**: Job/applicant CRUD, can manually add applicants
- **reviewer**: Read-only jobs/applicants, can add reviews

Auth uses `authenticate` and `requireRole(...roles)` middleware. Demo logins: `admin@archfirm.com`, `manager@archfirm.com`, `reviewer@archfirm.com` (all use password `admin123`/`manager123`/`reviewer123`).

## Hiring Pipeline

Seven stages: `new` → `screening` → `interview` → `offer` → `hired` / `rejected` / `holding`. The rejection workflow includes a templated email (currently mock/console-logged) and records the rejection date. Moving an applicant out of `rejected` triggers an un-reject confirmation.

## Key Patterns

- API client (`src/client/lib/api.ts`): typed `get<T>`, `post<T>`, `put<T>`, `patch<T>`, `delete<T>`, `upload<T>` methods
- Custom CSS badge classes for stages defined in `src/client/index.css` (e.g., `.badge-new`, `.badge-rejected`)
- Stage color mappings are duplicated in Dashboard.tsx, Applicants.tsx, JobDetail.tsx, and ApplicantDetail.tsx
- Email service (`src/server/services/email.ts`) is a stub ready for a real provider
