# LinkedIn Integration - Implementation Summary

This document summarizes the LinkedIn integration features that have been implemented in the WHLC ATS.

## Overview

Since the organization uses basic LinkedIn accounts (no API access), this implementation focuses on **semi-automated workflows** that make LinkedIn job posting easier while driving applications to the ATS careers page where they're automatically captured.

## What Was Implemented

### Phase 1: LinkedIn Job Posting Helpers

#### 1. Database Schema Updates
- Added LinkedIn tracking fields to `Job` model:
  - `postedToLinkedIn` (Boolean) - tracks if job was posted to LinkedIn
  - `linkedInPostDate` (DateTime) - when it was posted
  - `linkedInPostUrl` (String) - optional URL to the LinkedIn post

- Added source tracking fields to `Applicant` model:
  - `source` - high-level source (e.g., "LinkedIn", "Direct Application")
  - `sourceDetails` - full query string from URL
  - `referrer` - HTTP referrer URL
  - `utmSource`, `utmMedium`, `utmCampaign`, `utmContent` - UTM parameters

#### 2. LinkedIn Formatter Service
- Created `/src/server/services/linkedInFormatter.ts`
- Formats job postings for LinkedIn with:
  - Optimized post body with emojis and formatting
  - Auto-generated hashtags based on department and location
  - UTM-tagged apply URL for tracking

#### 3. API Endpoints
- `GET /api/jobs/:id/linkedin-preview` - generates LinkedIn post preview
- `PATCH /api/jobs/:id/linkedin-status` - marks job as posted/unposted
- `GET /api/jobs/public` - public job listings (no auth required)
- `GET /api/dashboard/sources` - source analytics

#### 4. LinkedIn Post Modal
- Created `/src/client/components/LinkedInPostModal.tsx`
- Features:
  - Preview of LinkedIn-formatted post
  - One-click copy to clipboard
  - Opens LinkedIn in new tab
  - Tracks post URL (optional)
  - Marks job as posted in ATS

#### 5. Job Detail Page Updates
- Added "Post to LinkedIn" button for admins and hiring managers
- Shows checkmark badge when job is posted
- Integrates LinkedInPostModal component

#### 6. Jobs Listing Updates
- Added LinkedIn badge to job cards showing which jobs are posted

### Phase 2: Source Tracking

#### 7. Application Source Capture
- Updated `/src/server/routes/applicants.ts` to capture:
  - URL parameters (source, UTM tags)
  - Referrer
  - Full query string details

#### 8. ApplyPage Updates
- Automatically captures source tracking from URL
- Extracts UTM parameters
- Records referrer
- Submits all tracking data with application

#### 9. Dashboard Source Analytics
- Added source breakdown card showing:
  - Total applicants by source
  - Hired/rejected counts per source
  - Conversion rates

### Phase 3: Public Job Board & Sharing

#### 10. Public Jobs Listing
- Created `/src/client/pages/PublicJobs.tsx`
- Public-facing job board at `/jobs-public`
- Features:
  - Filter by department, type, location
  - No authentication required
  - Clean, professional design

#### 11. Social Sharing
- Added ShareButtons component to ApplyPage
- Share to:
  - LinkedIn (with UTM tracking)
  - Twitter
  - Copy link to clipboard

#### 12. Environment Configuration
- Added `PUBLIC_URL` to `.env` for production URLs

## How to Use

### Posting a Job to LinkedIn

1. Navigate to a job detail page (as admin or hiring manager)
2. Click the "Post to LinkedIn" button
3. Review the LinkedIn-formatted post in the modal
4. Click "Copy Post Text" to copy to clipboard
5. Click "Open LinkedIn & Mark as Posted" to:
   - Open LinkedIn in a new tab
   - Mark the job as posted in ATS
6. On LinkedIn, create a new post and paste the text
7. After posting, optionally copy the LinkedIn post URL and paste it in the modal

### Tracking Applications from LinkedIn

The LinkedIn post includes a UTM-tagged URL like:
```
https://your-domain.com/apply/{jobId}?utm_source=linkedin&utm_medium=social&utm_campaign=linkedin_post&source=LinkedIn
```

When candidates apply through this link:
- Their application is automatically tagged with `source: "LinkedIn"`
- UTM parameters are captured
- Source analytics are updated in real-time

### Viewing Source Analytics

1. Go to the Dashboard
2. Scroll to the "Application Sources" section
3. View breakdown by source showing:
   - Total applicants
   - Hired count
   - Rejected count
   - Conversion rate

## File Structure

### New Files
- `src/server/services/linkedInFormatter.ts` - LinkedIn post formatting
- `src/client/components/LinkedInPostModal.tsx` - LinkedIn posting UI
- `src/client/pages/PublicJobs.tsx` - Public job board

### Modified Files
- `prisma/schema.prisma` - Added tracking fields
- `src/server/routes/jobs.ts` - Added LinkedIn endpoints
- `src/server/routes/applicants.ts` - Source tracking
- `src/server/routes/dashboard.ts` - Source analytics endpoint
- `src/client/pages/JobDetail.tsx` - LinkedIn button
- `src/client/pages/Jobs.tsx` - LinkedIn badge
- `src/client/pages/ApplyPage.tsx` - Source capture & sharing
- `src/client/pages/Dashboard.tsx` - Source analytics display
- `src/client/App.tsx` - Public jobs route
- `.env` - PUBLIC_URL variable

## Production Deployment

Before deploying to production:

1. Update `.env` with your production URL:
   ```
   PUBLIC_URL=https://your-ats-domain.com
   ```

2. Run database migration:
   ```bash
   npm run db:push
   ```

3. Build the application:
   ```bash
   npm run build
   ```

4. Deploy to your hosting platform

## Testing Checklist

- [ ] Create a test job
- [ ] Click "Post to LinkedIn" button
- [ ] Verify post preview looks good
- [ ] Copy post text and paste on LinkedIn
- [ ] Mark as posted and verify badge appears
- [ ] Open apply page with UTM parameters
- [ ] Submit test application
- [ ] Verify source is captured correctly
- [ ] Check Dashboard shows LinkedIn in source analytics
- [ ] Test public jobs page at `/jobs-public`
- [ ] Test social sharing buttons

## Future Enhancements

If LinkedIn Recruiter is added later:
1. Third-party automation via Zapier/Make.com
2. Automated job posting
3. Automated application ingestion
4. LinkedIn Apply integration

## Support

For issues or questions about the LinkedIn integration:
1. Check the CLAUDE.md file for project guidance
2. Review the plan document at `/home/micah/.claude/projects/-home-micah-projects-vibecodecloud-test/35a91e73-054f-4315-83d2-a0b0d194b364.jsonl`
3. Test in development mode first before deploying changes
