# WHLC Architecture - Applicant Tracking System

A modern applicant tracking system built for WHLC Architecture to manage job postings, applicants, and the hiring workflow.

## Quick Start (Local Development)

```bash
# Install dependencies
npm install

# Initialize database
npm run db:push

# Seed with sample data (optional)
npm run db:seed

# Start development server
npm run dev
```

The app will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001

### Demo Credentials
- **Admin**: admin@archfirm.com / admin123
- **Manager**: manager@archfirm.com / manager123
- **Reviewer**: reviewer@archfirm.com / reviewer123

---

## Deployment Options

### Option 1: Railway (Recommended for Staging)

Railway offers easy deployment with a generous free tier.

1. **Create Railway Account**: https://railway.app

2. **Deploy via GitHub**:
   - Connect your GitHub repository
   - Railway auto-detects the Node.js project
   - Add environment variables in the dashboard

3. **Set Environment Variables**:
   ```
   NODE_ENV=production
   JWT_SECRET=your-secure-secret-here
   DATABASE_URL=file:./prod.db
   ```

4. **Initialize Database** (after first deploy):
   - Go to Railway dashboard → your service → Settings → Run Command
   - Run: `npm run db:push && npm run db:seed`

### Option 2: Render

1. **Create Render Account**: https://render.com

2. **Create a New Web Service**:
   - Connect your GitHub repo
   - Build Command: `npm install && npm run build && npm run db:push`
   - Start Command: `npm start`

3. **Add Environment Variables**:
   ```
   NODE_ENV=production
   JWT_SECRET=your-secure-secret-here
   ```

4. **Add Disk** (for SQLite persistence):
   - Mount path: `/opt/render/project/src/prisma`

### Option 3: Docker (Self-Hosted / VPS)

```bash
# Build and run with Docker Compose
docker-compose up -d

# Initialize database
docker-compose exec app npx prisma db push
docker-compose exec app npm run db:seed
```

Access at: http://your-server-ip:3001

### Option 4: Fly.io

1. **Install Fly CLI**: https://fly.io/docs/getting-started/installing-flyctl/

2. **Deploy**:
   ```bash
   fly launch
   fly secrets set JWT_SECRET=your-secure-secret-here
   fly deploy
   ```

3. **Create persistent volume** for database:
   ```bash
   fly volumes create data --size 1
   ```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NODE_ENV` | Yes | Set to `production` for deployment |
| `JWT_SECRET` | Yes | Secret key for JWT tokens (use a strong random string) |
| `PORT` | No | Server port (default: 3001) |
| `DATABASE_URL` | No | Prisma database URL (default: file:./dev.db) |

---

## Features

- **Job Management**: Create and manage job postings
- **Applicant Tracking**: Resume/portfolio uploads, stage workflow
- **Review System**: Ratings for technical skills, design ability, portfolio quality
- **Dashboard**: Pipeline overview, activity tracking
- **Role-Based Access**: Admin, Hiring Manager, Reviewer roles

---

## Tech Stack

- **Backend**: Node.js, Express, TypeScript
- **Frontend**: React, Vite, TailwindCSS
- **Database**: SQLite with Prisma ORM
- **Auth**: JWT with bcrypt

---

## Support

For questions about this ATS, contact your development team.

Built for WHLC Architecture - Baton Rouge, LA | Fairhope, AL | Biloxi, MS
