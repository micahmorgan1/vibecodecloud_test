# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

WHLC Architecture Applicant Tracking System — a full-stack monorepo with a React frontend and Express backend using PostgreSQL via Prisma. Deployed on Railway.

## Commands

```bash
npm run dev            # Run client (port 3000) + server (port 3005) concurrently
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

**Server** (`src/server/`): Express on port 3005. Routes are in `src/server/routes/` (auth, jobs, applicants, reviews, users, dashboard, emailSettings, events, interviews, offers, notifications, offices, siteSettings). JWT authentication middleware is in `src/server/middleware/auth.ts`. File uploads (multer) go to `uploads/resumes/`, `uploads/portfolios/`, and `uploads/offers/`.

**Database**: PostgreSQL via `DATABASE_URL` env var. Schema is in `prisma/schema.prisma`. Models: User, Job, Applicant, Review, Note, EmailTemplate, JobReviewer, JobNotificationSub, NotificationSub, Office, RecruitmentEvent, EventAttendee, EventReviewer, BlockedEmail, SiteSetting, ActivityLog, Notification, Interview, InterviewParticipant, Offer. One review per reviewer per applicant (upsert pattern).

**Dev proxy**: Vite proxies `/api` and `/uploads` to `localhost:3005`. In production, Express serves static files before API middleware, then handles SPA fallback for non-API routes.

## Deployment (Railway)

**Hosting**: Railway with Nixpacks builder. Config in `railway.json`. Start command: `npm run db:push && npm start`.

**Required env vars** (see `.env.example`):
- `DATABASE_URL` — PostgreSQL connection string (Railway Postgres plugin provides via `${{Postgres.DATABASE_URL}}`)
- `JWT_SECRET` — required, server crashes on startup if missing (`openssl rand -hex 32`)
- `NODE_ENV` — `production` on Railway
- `PORT` — `3005` (Railway needs explicit setting)
- `ALLOWED_ORIGINS` — comma-separated allowed CORS origins (e.g., `https://your-app.up.railway.app`)
- `PUBLIC_URL` — base URL for email links

**Optional env vars**: `SMTP_HOST/PORT/USER/PASS/FROM`, `CLAMAV_SOCKET`, `GOOGLE_SAFE_BROWSING_KEY`, `SEED_ADMIN_PASSWORD/SEED_MANAGER_PASSWORD/SEED_REVIEWER_PASSWORD`

**Production middleware order**: Helmet (CSP disabled) → static files → CORS (scoped to `/api` only) → rate limiting → request logger → API routes → SPA fallback → error handler.

**Seeding**: `db:seed` generates strong random passwords unless `SEED_*_PASSWORD` env vars are set. Passwords are logged once at seed time via `logger.warn`.

**File uploads**: Ephemeral on Railway redeploys. For production, attach a Railway volume at `/app/uploads` or migrate to Cloudflare R2.

## Roles & Auth

Three roles with cascading permissions:
- **admin**: Full access including user management and applicant deletion
- **hiring_manager**: Job/applicant CRUD, can manually add applicants. Can be **scoped** to specific departments and/or offices (see below).
- **reviewer**: Read-only jobs/applicants, can add reviews. Reviewers are scoped to assigned jobs via `JobReviewer` — unassigned reviewers see nothing. Assigned reviewers can also manually add applicants to their jobs.

Auth uses `authenticate`, `requireRole(...roles)`, `getAccessibleJobIds(user)`, `getAccessibleEventIds(user)`, and `getAccessibleApplicantFilter(user)` middleware. `getAccessibleJobIds` returns `null` for admin/global HM (no filter) or an array of job IDs for reviewers and scoped HMs. `getAccessibleApplicantFilter` returns a compound Prisma WHERE clause combining job + event access for applicant queries.

**Security hardening**: JWT_SECRET has no fallback (crashes if missing). Public registration endpoint disabled (returns 404). Seed passwords are randomly generated unless env var overrides are set. Auth audit logging tracks login success/failure and password changes with IP addresses via `logActivity()`.

**Scoped Hiring Managers**: User model has `scopedDepartments` (nullable JSON string of department names) and `scopedOffices` (nullable JSON string of office IDs). `null` = global access (default). When scoped, the HM only sees jobs matching their assigned departments OR offices. The `authenticate` middleware parses these JSON fields and attaches them to `req.user` for downstream use. Scope is managed via the Users page admin UI.

## Job Archiving & General Applicant Pool

Jobs are **archived** instead of deleted. `DELETE /jobs/:id` sets `archived: true`, `archivedAt`, and `publishToWebsite: false` — all applicant data is preserved. Admin can view archived jobs via a "Show Archived" toggle and unarchive them (`PATCH /jobs/:id/unarchive`). All list/public endpoints filter `archived: false` by default.

**General applicant pool**: `Applicant.jobId` is nullable. Applicants with no job appear as "General Application" in the UI. Public and manual creation endpoints accept optional `jobId`. Reviewers cannot see general pool applicants (null `jobId` is excluded from their accessible jobs filter).

**Reassignment**: Admin/hiring_manager can reassign applicants between jobs or to/from the general pool via `PATCH /applicants/:id/assign-job`. The applicant's current stage is preserved and a note is created documenting the change.

## Hiring Pipeline

Seven stages: `new` → `screening` → `interview` → `offer` → `hired` / `rejected` / `holding`. The rejection workflow includes a templated email (currently mock/console-logged) and records the rejection date. Moving an applicant out of `rejected` triggers an un-reject confirmation.

**Dashboard pipeline**: Interactive — clicking a stage expands to show top 5 applicants with name, job, review count, and link to detail. Chevron arrows indicate clickability. "View all" navigates to filtered applicants list.

## Interview Module

**Models**: `Interview` (scheduledAt, location, type, notes, notesUrl, status, feedback, outcome, applicantId, createdById) and `InterviewParticipant` (feedback, rating 1-5, interviewId, userId, `@@unique`).

**Interview types**: `in_person`, `video`, `phone`. **Statuses**: `scheduled`, `completed`, `cancelled`, `no_show`. **Outcomes**: `advance`, `hold`, `reject`.

**Routes** (`/api/interviews`): GET /applicant/:id, POST /applicant/:id, GET /:id (expanded applicant context + participant access fallback), PUT /:id, DELETE /:id, PATCH /:id/feedback.

**Live Interview Page** (`/interviews/:id/live`): 2-column layout for real-time interview note-taking. Left sidebar shows applicant info, document links, past reviews. Main area has meeting notes URL (editable by admin/HM), prep notes, and per-participant panels. Current user gets RichTextEditor + star rating with Save button; other participants' panels are read-only with 30s polling. Action bar for admin/HM: Mark Complete + Outcome dropdown.

**Notifications**: Participants notified on schedule/reschedule/cancel. Activity log tracks interview_scheduled, interview_status_changed, interview_cancelled, interview_feedback_added.

## Offer Module

**Model**: `Offer` (status, filePath, notes, salary, offerDate, acceptedDate, declinedDate, applicantId, createdById). **Statuses**: `draft`, `extended`, `accepted`, `declined`, `rescinded`.

**Access control**: User model has `offerAccess Boolean @default(false)`. Admins always have access. HMs only if `offerAccess === true`. Reviewers never.

**Routes** (`/api/offers`): GET /applicant/:id, POST /applicant/:id, GET /:id, PUT /:id, PATCH /:id/upload, DELETE /:id. File uploads: `uploads/offers/`, PDF/DOC/DOCX only, 10MB limit.

**Auto-advance**: extended → offer stage, accepted → hired stage. Notifications via `notifySubscribers()`.

## Key Patterns

- API client (`src/client/lib/api.ts`): typed `get<T>`, `post<T>`, `put<T>`, `patch<T>`, `delete<T>`, `upload<T>` methods
- Custom CSS badge classes for stages defined in `src/client/index.css` (e.g., `.badge-new`, `.badge-rejected`)
- Stage color mappings are duplicated in Dashboard.tsx, Applicants.tsx, JobDetail.tsx, and ApplicantDetail.tsx
- Email service (`src/server/services/email.ts`) uses SMTP env vars; currently configured with Mailtrap for dev, ready for Postmark in production
- Email templates (`EmailTemplate` model) are configurable via the Settings page (`/settings`); `getTemplate(type)` loads from DB with hardcoded fallbacks
- Template types: `thank_you`, `event_thank_you`, `review_request`, `rejection` — all editable via dropdown in Settings
- Template variable resolution: `{{firstName}}`, `{{lastName}}`, `{{jobTitle}}`, `{{eventName}}`, etc. via `resolveTemplate()`
- Activity logging: fire-and-forget `logActivity()` in `src/server/services/activityLog.ts` — tracks auth events, applicant changes, interviews, offers
- In-app notifications: `Notification` model with `NotificationBell.tsx` component, 30s polling, 90-day auto-cleanup

## Notifications & Email

**Email templates**: Four template types stored in `EmailTemplate`, all editable via the Settings page dropdown:
- `thank_you` — auto-sent on public application submission (`{{firstName}}`, `{{lastName}}`, `{{jobTitle}}`)
- `event_thank_you` — auto-sent on fair intake (`{{firstName}}`, `{{lastName}}`, `{{eventName}}`)
- `review_request` — sent when requesting a user review an applicant (`{{recipientName}}`, `{{applicantName}}`, `{{jobTitle}}`, `{{senderName}}`, `{{applicantUrl}}`)
- `rejection` — pre-fills rejection modal (`{{firstName}}`, `{{lastName}}`, `{{jobTitle}}`)

**In-app notifications**: `Notification` model (type, title, message, link, read, userId). Service at `src/server/services/notifications.ts`: `createNotification()`, `notifyJobSubscribers()`, `notifyUsers()`. Routes at `/api/notifications`. `NotificationBell.tsx` with bell icon, red unread badge, dropdown panel, 30s polling. Triggers: new_application, stage_changed, review_added, review_request, interview_scheduled, interview_cancelled, offer_extended, offer_accepted, offer_declined, offer_rescinded.

**Notification subscriptions** (`NotificationSub`): Per-user subscriptions supporting three types: `job` (specific job ID), `department` (department name), `office` (office ID). Managed by each user on the Settings Notifications tab via `GET/PUT /email-settings/notification-subs`. `notifySubscribers()` queries both `NotificationSub` and legacy `JobNotificationSub` tables. Legacy `JobNotificationSub` is preserved for backwards compatibility and admin per-job subscriber management.

**Reviewer job access** (`JobReviewer`): Controls which jobs reviewers can see. Purely access control — does not affect notifications. Managed at `/settings?tab=access`.

**Request Review**: Admin/hiring_manager can send a specific applicant to specific users for review via a modal on the applicant detail page. Sends template-driven email and creates a note on the applicant.

## Website Integration

Jobs have a `slug` (unique, auto-generated from title) and `publishToWebsite` flag. Public endpoints `GET /jobs/website` and `GET /jobs/website/:slug` serve published open jobs to the WHLC website. The WHLCddev project (`ats` branch) has Alpine.js components (`atsJobs`, `atsJobDetail`, `atsApplyForm`, `atsGeneralApplyForm`, `atsEvents`) that fetch from the ATS API. The general apply form (`atsGeneralApplyForm`) submits applicants without a `jobId` for the "Send us your Resume" page. The `ATS_API_URL` env var configures the API base URL.

## Recruitment Events

**Models**: `RecruitmentEvent` (name, type, location, date, notes, description, eventUrl, university, publishToWebsite, createdById), `EventAttendee` (userId + eventId unique), and `EventReviewer` (userId + eventId unique). `Applicant.eventId` is an optional foreign key linking applicants to events.

**Event types**: `job_fair`, `campus_visit`, `info_session`.

**Public events**: `GET /api/events/website` (no auth) returns events with `publishToWebsite: true` and `date >= now()`, ordered soonest first. Past events are automatically hidden. Displayed on WHLC careers page via `atsEvents` Alpine component with accordion fold-out for events with descriptions.

**Access control**: `getAccessibleEventIds(user)` returns `null` for admin/HM (with eventAccess), `[]` for HMs without eventAccess, event IDs for reviewers via `EventReviewer`. `getAccessibleApplicantFilter(user)` combines job + event access into a single compound Prisma WHERE clause using `OR` conditions.

**Fair Intake**: `POST /api/events/:id/intake` atomically creates an applicant + review + note in a single transaction. Sends `event_thank_you` auto-responder email (fire-and-forget). Used by the "Save & Add Another" flow in the EventDetail page. Any authenticated user with event access can use it.

**Event-scoped reviewer access**: Reviewers assigned as attendees to an event can see that event and its applicants, independently from their job assignments. A reviewer can be assigned to both jobs and events — the compound filter handles the union.

**Routes** (`src/server/routes/events.ts`): CRUD for events, `GET /website` (public), `PUT /:id/attendees` for managing attendees (delete-and-recreate pattern), `POST /:id/intake` for fair intake. Registered at `/api/events`.

**Client pages**: `Events.tsx` (list + create modal), `EventDetail.tsx` (detail + fair intake form + applicants table). Events nav item visible to all roles.

## Spam Protection & Blocklist

**Spam detection** (`src/server/services/spamDetection.ts`): `checkSpam()` is async and checks (in order): email/domain blocklist, honeypot field, URL-in-name, disposable email domains, all-caps names, spam phrases in cover letter. Public `POST /applicants` silently flags spam (Formie pattern — saves the record, shows success to the user, but suppresses notification emails).

**Blocklist** (`BlockedEmail` model): Stores blocked email addresses and domains (`type`: "email" or "domain", `value`: lowercased, `@@unique([type, value])`). When confirming spam via `PATCH /applicants/:id/confirm-spam`, the exact email is always blocked; optionally the entire domain can be blocked via `{ blockDomain: true }`. The `ConfirmSpamModal` in `ApplicantDetail.tsx` provides a checkbox for domain blocking.

**Spam management routes** (admin/hiring_manager only):
- `GET /applicants?spam=false` (default), `?spam=true`, `?spam=all` — filter by spam status
- `PATCH /applicants/:id/mark-not-spam` — clears spam flag, sends previously-suppressed emails, creates note
- `PATCH /applicants/:id/confirm-spam` — confirms spam, blocks email (+ optional domain), creates note
- `PATCH /applicants/:id/mark-spam` — manually flag a non-spam applicant as spam
- `POST /applicants/bulk-mark-spam` — bulk mark by IDs `{ ids: string[] }`
- `DELETE /applicants/spam` — delete ALL spam applicants + their uploaded files
- `POST /applicants/bulk-delete` — delete selected applicants by IDs `{ ids: string[] }` + files

**Client UI**: `Applicants.tsx` has checkboxes with select-all and bulk action bars. In spam view: "Delete Selected" and "Delete All Spam" buttons. In normal view: "Mark Selected as Spam" button. All bulk actions have confirmation modals. `ApplicantDetail.tsx` has a "Mark as Spam" button for non-spam applicants. Dashboard excludes spam from all stats; `spamCount` is returned in `/dashboard/stats`.

**Honeypot field**: `website2` on `ApplyPage.tsx` and the WHLCddev Alpine forms (`atsApplyForm`, `atsGeneralApplyForm`).

## Form Validation & Security

**Zod schemas** (`src/server/schemas/`): One file per domain (applicant, job, review, user, event, emailSettings, office, interview, offer, siteSettings, notificationSub) with a barrel `index.ts`. `validateBody(schema)` middleware in `src/server/middleware/validateBody.ts` parses and sanitizes `req.body`, returning 400 with `{ error, fields }` on failure.

**Sanitization** (`src/server/utils/sanitize.ts`): `stripHtml()` for plain text fields, `sanitizeRichText()` for formatted content (allows b/i/em/strong/p/br/ul/ol/li). All Zod string fields use `.trim().max(limit).transform(stripHtml)` or `.transform(sanitizeRichText)`.

**File security**: `validateUploadedFiles` middleware (`src/server/middleware/validateFiles.ts`) validates magic bytes via `file-type` after multer. `virusScan.ts` integrates ClamAV (graceful degradation if unavailable). `deleteUploadedFiles()` utility (`src/server/utils/deleteUploadedFiles.ts`) cleans up uploaded files when applicants are deleted.

**URL safety**: `urlSafety.ts` uses Google Safe Browsing API (fire-and-forget) on applicant create/update. Applicant model tracks `urlSafe`, `urlFlags`, `urlCheckedAt`.

**Security middleware**: Helmet for security headers (CSP disabled for Vite SPA compatibility). CORS restricted to `ALLOWED_ORIGINS` env var, scoped to `/api` routes only. Rate limiting: 200 req/15min global API, 10 failed logins/15min, 15 public form submissions/15min.

## Rich Text Editor & Content Formatting

**TipTap editor** (`src/client/components/RichTextEditor.tsx`): Headless rich text editor wrapping `@tiptap/react` with `StarterKit` + `Underline` extension. Toolbar: Bold, Italic, Underline, Bullet List, Ordered List. Used in job create/edit modals (description, requirements, benefits), email template editing, and live interview participant notes. Styled to match the existing `.input` class with black/white active states.

**Legacy text formatter** (`src/client/utils/formatText.ts`): `isHtml()` detects existing HTML content, `formatTextToHtml()` converts plain text with `- ` prefixed lines into `<ul><li>` HTML, `renderContent()` dispatches between the two. Used in display components to handle both old plain-text data and new TipTap HTML via `dangerouslySetInnerHTML`.

## Job Benefits

`Job.benefits` is an optional rich text field (nullable `String?`). Included in create/update routes and all public select clauses. Conditionally displayed on `JobDetail.tsx`, `ApplyPage.tsx`, and WHLC `jobDetail.twig`.

## Site Settings

**`SiteSetting` model**: Key-value store (`key` unique, `value` text, `updatedAt`). Routes at `/api/settings`: `GET /public/:key` (no auth, whitelisted keys: `about_whlc`, `positions_intro`, `events_intro`), `GET /:key` and `PUT /:key` (admin/HM, upsert). Schema in `src/server/schemas/siteSettings.ts`.

**Settings page** (`Settings.tsx`, route `/settings`): Tabbed layout with URL search params (`?tab=content`):
- **Site Content** — dropdown selector for `about_whlc`, `positions_intro`, `events_intro`. RichTextEditor per selection.
- **Email Templates** — dropdown selector for all four template types. Subject + body editor with variable hints.
- **Access Control** — reviewer job assignments (job selector + reviewer checkboxes).
- **Notifications** — two sections: (1) "My Notification Subscriptions" — per-user checkboxes for jobs, departments, offices via `NotificationSub`; (2) "Per-Job Email Notifications" — legacy admin per-job subscriber management via `JobNotificationSub`.

Old `/email-settings` route redirects to `/settings`. Nav link updated to `/settings`.
