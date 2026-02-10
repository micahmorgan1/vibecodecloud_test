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

**Server** (`src/server/`): Express on port 3001. Routes are in `src/server/routes/` (auth, jobs, applicants, reviews, users, dashboard, emailSettings, events). JWT authentication middleware is in `src/server/middleware/auth.ts`. File uploads (multer) go to `uploads/resumes/` and `uploads/portfolios/`.

**Database**: SQLite (`prisma/dev.db`). Schema is in `prisma/schema.prisma`. Models: User, Job, Applicant, Review, Note, EmailTemplate, JobReviewer, JobNotificationSub, Office, RecruitmentEvent, EventAttendee. One review per reviewer per applicant (upsert pattern).

**Dev proxy**: Vite proxies `/api` and `/uploads` to `localhost:3001`. In production, Express serves the built client and handles SPA fallback.

## Roles & Auth

Three roles with cascading permissions:
- **admin**: Full access including user management and applicant deletion
- **hiring_manager**: Job/applicant CRUD, can manually add applicants
- **reviewer**: Read-only jobs/applicants, can add reviews. Reviewers are scoped to assigned jobs via `JobReviewer` — unassigned reviewers see nothing. Assigned reviewers can also manually add applicants to their jobs.

Auth uses `authenticate`, `requireRole(...roles)`, `getAccessibleJobIds(user)`, `getAccessibleEventIds(user)`, and `getAccessibleApplicantFilter(user)` middleware. `getAccessibleJobIds` returns `null` for admin/hiring_manager (no filter) or an array of job IDs for reviewers. `getAccessibleApplicantFilter` returns a compound Prisma WHERE clause combining job + event access for applicant queries. Demo logins: `admin@archfirm.com`, `manager@archfirm.com`, `reviewer@archfirm.com` (all use password `admin123`/`manager123`/`reviewer123`).

## Job Archiving & General Applicant Pool

Jobs are **archived** instead of deleted. `DELETE /jobs/:id` sets `archived: true`, `archivedAt`, and `publishToWebsite: false` — all applicant data is preserved. Admin can view archived jobs via a "Show Archived" toggle and unarchive them (`PATCH /jobs/:id/unarchive`). All list/public endpoints filter `archived: false` by default.

**General applicant pool**: `Applicant.jobId` is nullable. Applicants with no job appear as "General Application" in the UI. Public and manual creation endpoints accept optional `jobId`. Reviewers cannot see general pool applicants (null `jobId` is excluded from their accessible jobs filter).

**Reassignment**: Admin/hiring_manager can reassign applicants between jobs or to/from the general pool via `PATCH /applicants/:id/assign-job`. The applicant's current stage is preserved and a note is created documenting the change.

## Hiring Pipeline

Seven stages: `new` → `screening` → `interview` → `offer` → `hired` / `rejected` / `holding`. The rejection workflow includes a templated email (currently mock/console-logged) and records the rejection date. Moving an applicant out of `rejected` triggers an un-reject confirmation.

## Key Patterns

- API client (`src/client/lib/api.ts`): typed `get<T>`, `post<T>`, `put<T>`, `patch<T>`, `delete<T>`, `upload<T>` methods
- Custom CSS badge classes for stages defined in `src/client/index.css` (e.g., `.badge-new`, `.badge-rejected`)
- Stage color mappings are duplicated in Dashboard.tsx, Applicants.tsx, JobDetail.tsx, and ApplicantDetail.tsx
- Email service (`src/server/services/email.ts`) is a mock/console-logged stub ready for a real provider (e.g., Postmark)
- Email templates (`EmailTemplate` model) are configurable via the Notifications page (`/email-settings`); `getTemplate(type)` loads from DB with hardcoded fallbacks
- Template variable resolution: `{{firstName}}`, `{{lastName}}`, `{{jobTitle}}` via `resolveTemplate()`

## Notifications & Email

**Email templates**: Thank-you auto-responder and default rejection letter are stored in `EmailTemplate` and editable by admin/hiring_manager at `/email-settings`. The rejection modal in `ApplicantDetail.tsx` pre-fills from the saved template.

**Notification subscriptions** (`JobNotificationSub`): Per-user, per-job. Any role can subscribe. When a public application is submitted, subscribed users receive a notification email (mock). Configured separately from reviewer access.

**Reviewer job access** (`JobReviewer`): Controls which jobs reviewers can see. Purely access control — does not affect notifications. Managed at `/email-settings`.

**Request Review**: Admin/hiring_manager can send a specific applicant to specific users for review via a modal on the applicant detail page. Sends mock email and creates a note on the applicant.

## Website Integration

Jobs have a `slug` (unique, auto-generated from title) and `publishToWebsite` flag. Public endpoints `GET /jobs/website` and `GET /jobs/website/:slug` serve published open jobs to the WHLC website. The WHLCddev project (`ats` branch) has Alpine.js components (`atsJobs`, `atsJobDetail`, `atsApplyForm`, `atsGeneralApplyForm`) that fetch from the ATS API. The general apply form (`atsGeneralApplyForm`) submits applicants without a `jobId` for the "Send us your Resume" page. The `ATS_API_URL` env var configures the API base URL.

## Recruitment Events

**Models**: `RecruitmentEvent` (name, type, location, date, notes, createdById) and `EventAttendee` (userId + eventId unique). `Applicant.eventId` is an optional foreign key linking applicants to events.

**Event types**: `job_fair`, `campus_visit`, `info_session`.

**Access control**: `getAccessibleEventIds(user)` returns `null` for admin/HM, event IDs for reviewers. `getAccessibleApplicantFilter(user)` combines job + event access into a single compound Prisma WHERE clause using `OR` conditions. This replaces the old job-only `applicantFilter` pattern in applicant, review, and dashboard routes.

**Fair Intake**: `POST /api/events/:id/intake` atomically creates an applicant + review + note in a single transaction. Used by the "Save & Add Another" flow in the EventDetail page. Any authenticated user with event access can use it.

**Event-scoped reviewer access**: Reviewers assigned as attendees to an event can see that event and its applicants, independently from their job assignments. A reviewer can be assigned to both jobs and events — the compound filter handles the union.

**Routes** (`src/server/routes/events.ts`): CRUD for events, `PUT /:id/attendees` for managing attendees (delete-and-recreate pattern), `POST /:id/intake` for fair intake. Registered at `/api/events`.

**Client pages**: `Events.tsx` (list + create modal), `EventDetail.tsx` (detail + fair intake form + applicants table). Events nav item visible to all roles.
