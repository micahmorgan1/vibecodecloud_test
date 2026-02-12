import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import logger from './lib/logger.js';

const prisma = new PrismaClient();

function generateStrongPassword(): string {
  return crypto.randomBytes(24).toString('base64url'); // 32-char random password
}

async function main() {
  logger.info('Seeding database...');

  // Wipe all tables in dependency order (children first)
  await prisma.review.deleteMany();
  await prisma.note.deleteMany();
  await prisma.jobReviewer.deleteMany();
  await prisma.jobNotificationSub.deleteMany();
  await prisma.eventAttendee.deleteMany();
  await prisma.applicant.deleteMany();
  await prisma.recruitmentEvent.deleteMany();
  await prisma.job.deleteMany();
  await prisma.emailTemplate.deleteMany();
  await prisma.office.deleteMany();
  await prisma.user.deleteMany();
  logger.info('Cleared existing data');

  // Create users — read passwords from env vars, or generate strong random ones
  const adminPw = process.env.SEED_ADMIN_PASSWORD || generateStrongPassword();
  const managerPw = process.env.SEED_MANAGER_PASSWORD || generateStrongPassword();
  const reviewerPw = process.env.SEED_REVIEWER_PASSWORD || generateStrongPassword();

  // Log generated passwords so the admin can record them (only shown once at seed time)
  if (!process.env.SEED_ADMIN_PASSWORD) {
    logger.warn({ email: 'admin@archfirm.com', password: adminPw }, 'Generated admin password — save this now!');
  }
  if (!process.env.SEED_MANAGER_PASSWORD) {
    logger.warn({ email: 'manager@archfirm.com', password: managerPw }, 'Generated manager password — save this now!');
  }
  if (!process.env.SEED_REVIEWER_PASSWORD) {
    logger.warn({ email: 'reviewer@archfirm.com', password: reviewerPw }, 'Generated reviewer password — save this now!');
  }

  const adminPassword = await bcrypt.hash(adminPw, 10);
  const managerPassword = await bcrypt.hash(managerPw, 10);
  const reviewerPassword = await bcrypt.hash(reviewerPw, 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@archfirm.com' },
    update: {},
    create: {
      email: 'admin@archfirm.com',
      password: adminPassword,
      name: 'Sarah Admin',
      role: 'admin',
    },
  });

  const manager = await prisma.user.upsert({
    where: { email: 'manager@archfirm.com' },
    update: {},
    create: {
      email: 'manager@archfirm.com',
      password: managerPassword,
      name: 'Michael Chen',
      role: 'hiring_manager',
    },
  });

  const reviewer = await prisma.user.upsert({
    where: { email: 'reviewer@archfirm.com' },
    update: {},
    create: {
      email: 'reviewer@archfirm.com',
      password: reviewerPassword,
      name: 'Emily Johnson',
      role: 'reviewer',
    },
  });

  logger.info({ admin: admin.email, manager: manager.email, reviewer: reviewer.email }, 'Created users');

  // Create offices
  const officeBR = await prisma.office.upsert({
    where: { id: 'office-baton-rouge' },
    update: {},
    create: {
      id: 'office-baton-rouge',
      name: 'Baton Rouge',
      address: '10 Cl Way',
      city: 'Baton Rouge',
      state: 'LA',
      zip: '70808',
      phone: '(225) 767-1530',
    },
  });

  const officeFairhope = await prisma.office.upsert({
    where: { id: 'office-fairhope' },
    update: {},
    create: {
      id: 'office-fairhope',
      name: 'Fairhope',
      address: '401 Fairhope Ave',
      city: 'Fairhope',
      state: 'AL',
      zip: '36532',
      phone: '(251) 990-6200',
    },
  });

  const officeBiloxi = await prisma.office.upsert({
    where: { id: 'office-biloxi' },
    update: {},
    create: {
      id: 'office-biloxi',
      name: 'Biloxi',
      address: '2350 Beach Blvd, Suite 102',
      city: 'Biloxi',
      state: 'MS',
      zip: '39531',
      phone: '(228) 385-8564',
    },
  });

  logger.info({ br: officeBR.name, fairhope: officeFairhope.name, biloxi: officeBiloxi.name }, 'Created offices');

  // Create jobs
  const jobs = await Promise.all([
    prisma.job.create({
      data: {
        title: 'Senior Architect',
        slug: 'senior-architect',
        department: 'Design',
        location: 'New York, NY',
        type: 'full-time',
        description: `We are seeking an experienced Senior Architect to join our award-winning design team. You will lead complex architectural projects from concept through construction, working with high-profile clients on innovative commercial and residential developments.

Key Responsibilities:
- Lead design teams on major projects
- Develop and present design concepts to clients
- Oversee project documentation and coordination
- Mentor junior architects and designers
- Ensure projects meet quality, budget, and timeline requirements`,
        requirements: `- Licensed Architect (RA) required
- 8+ years of professional experience
- Strong portfolio demonstrating design excellence
- Proficiency in Revit, AutoCAD, and Adobe Creative Suite
- Experience with sustainable design (LEED AP preferred)
- Excellent communication and leadership skills
- Master's degree in Architecture preferred`,
        salary: '$120,000 - $160,000',
        status: 'open',
        createdById: manager.id,
      },
    }),
    prisma.job.create({
      data: {
        title: 'Junior Architect',
        slug: 'junior-architect',
        department: 'Design',
        location: 'New York, NY',
        type: 'full-time',
        description: `Join our dynamic team as a Junior Architect. This is an excellent opportunity for recent graduates to work on exciting projects while developing their skills under the mentorship of experienced professionals.

Key Responsibilities:
- Support senior architects in design development
- Create detailed drawings and 3D models
- Assist with client presentations
- Coordinate with consultants and contractors
- Participate in site visits and construction observation`,
        requirements: `- Bachelor's or Master's degree in Architecture
- 0-3 years of professional experience
- Strong design portfolio
- Proficiency in Revit, SketchUp, and Adobe Creative Suite
- Knowledge of building codes and construction methods
- Excellent attention to detail
- Strong work ethic and eagerness to learn`,
        salary: '$55,000 - $75,000',
        status: 'open',
        createdById: manager.id,
      },
    }),
    prisma.job.create({
      data: {
        title: 'Interior Designer',
        slug: 'interior-designer',
        department: 'Interiors',
        location: 'Los Angeles, CA',
        type: 'full-time',
        description: `We are looking for a creative Interior Designer to join our interiors studio. You will work on high-end residential and hospitality projects, creating beautiful spaces that enhance the lives of our clients.

Key Responsibilities:
- Develop interior design concepts and space planning
- Select materials, finishes, furniture, and fixtures
- Create presentation materials and mood boards
- Coordinate with architects and contractors
- Manage FF&E specifications and procurement`,
        requirements: `- Bachelor's degree in Interior Design or related field
- 3-5 years of professional experience
- Strong portfolio of completed projects
- Proficiency in AutoCAD, SketchUp, and Adobe Creative Suite
- Knowledge of furniture, fabrics, and materials
- NCIDQ certification preferred
- Excellent client relationship skills`,
        salary: '$70,000 - $95,000',
        status: 'open',
        createdById: admin.id,
      },
    }),
    prisma.job.create({
      data: {
        title: 'BIM Manager',
        slug: 'bim-manager',
        department: 'Technology',
        location: 'Chicago, IL',
        type: 'full-time',
        description: `We are seeking a BIM Manager to lead our digital design initiatives. You will develop and maintain BIM standards, train staff, and ensure efficient workflows across all projects.

Key Responsibilities:
- Develop and maintain BIM standards and protocols
- Train and support staff in BIM software
- Manage Revit families and content libraries
- Coordinate with IT on software and hardware
- Troubleshoot technical issues and optimize workflows`,
        requirements: `- Bachelor's degree in Architecture or related field
- 5+ years of BIM experience
- Expert-level Revit proficiency
- Experience with Dynamo and other automation tools
- Strong understanding of architectural documentation
- Excellent problem-solving and communication skills
- Autodesk certifications preferred`,
        salary: '$90,000 - $120,000',
        status: 'open',
        createdById: manager.id,
      },
    }),
    prisma.job.create({
      data: {
        title: 'Architecture Intern',
        slug: 'architecture-intern',
        department: 'Design',
        location: 'New York, NY',
        type: 'internship',
        description: `Summer internship opportunity for architecture students. Gain hands-on experience working alongside our talented team on real projects.

Key Responsibilities:
- Assist with design studies and research
- Create physical and digital models
- Support documentation efforts
- Attend project meetings and site visits
- Participate in office events and reviews`,
        requirements: `- Currently enrolled in accredited Architecture program
- Strong design portfolio
- Proficiency in Rhino, SketchUp, or similar
- Basic knowledge of Revit preferred
- Strong model-making skills
- Enthusiastic and self-motivated`,
        salary: '$20 - $25/hour',
        status: 'open',
        createdById: manager.id,
      },
    }),
  ]);

  logger.info(`Created ${jobs.length} jobs`);

  // Create sample applicants
  const applicants = await Promise.all([
    prisma.applicant.create({
      data: {
        firstName: 'James',
        lastName: 'Wilson',
        email: 'james.wilson@email.com',
        phone: '212-555-0101',
        linkedIn: 'linkedin.com/in/jameswilson',
        website: 'jameswilsonarchitect.com',
        coverLetter: 'I am excited to apply for the Senior Architect position at your firm. With over 10 years of experience...',
        stage: 'interview',
        source: 'LinkedIn',
        jobId: jobs[0].id,
      },
    }),
    prisma.applicant.create({
      data: {
        firstName: 'Sofia',
        lastName: 'Martinez',
        email: 'sofia.martinez@email.com',
        phone: '323-555-0102',
        linkedIn: 'linkedin.com/in/sofiamartinez',
        portfolioUrl: 'behance.net/sofiamartinez',
        stage: 'screening',
        source: 'Website',
        jobId: jobs[1].id,
      },
    }),
    prisma.applicant.create({
      data: {
        firstName: 'David',
        lastName: 'Kim',
        email: 'david.kim@email.com',
        phone: '415-555-0103',
        stage: 'new',
        source: 'Referral',
        jobId: jobs[2].id,
      },
    }),
    prisma.applicant.create({
      data: {
        firstName: 'Rachel',
        lastName: 'Thompson',
        email: 'rachel.t@email.com',
        phone: '312-555-0104',
        linkedIn: 'linkedin.com/in/rachelthompson',
        stage: 'offer',
        source: 'Indeed',
        jobId: jobs[3].id,
      },
    }),
    prisma.applicant.create({
      data: {
        firstName: 'Alex',
        lastName: 'Chen',
        email: 'alex.chen@university.edu',
        phone: '617-555-0105',
        website: 'alexchenportfolio.com',
        stage: 'new',
        source: 'University Career Fair',
        jobId: jobs[4].id,
      },
    }),
  ]);

  logger.info(`Created ${applicants.length} applicants`);

  // Create reviews
  await Promise.all([
    prisma.review.create({
      data: {
        reviewerId: manager.id,
        applicantId: applicants[0].id,
        rating: 5,
        technicalSkills: 5,
        designAbility: 4,
        portfolioQuality: 5,
        communication: 4,
        cultureFit: 5,
        recommendation: 'strong_yes',
        comments: 'Exceptional candidate with impressive portfolio. Strong leadership experience.',
      },
    }),
    prisma.review.create({
      data: {
        reviewerId: reviewer.id,
        applicantId: applicants[0].id,
        rating: 4,
        technicalSkills: 4,
        designAbility: 5,
        portfolioQuality: 5,
        communication: 4,
        cultureFit: 4,
        recommendation: 'yes',
        comments: 'Great design skills and relevant experience. Would be a strong addition to the team.',
      },
    }),
    prisma.review.create({
      data: {
        reviewerId: manager.id,
        applicantId: applicants[1].id,
        rating: 4,
        technicalSkills: 3,
        designAbility: 4,
        portfolioQuality: 4,
        communication: 5,
        cultureFit: 4,
        recommendation: 'yes',
        comments: 'Promising young designer. Shows great potential and enthusiasm.',
      },
    }),
    prisma.review.create({
      data: {
        reviewerId: admin.id,
        applicantId: applicants[3].id,
        rating: 5,
        technicalSkills: 5,
        designAbility: 3,
        portfolioQuality: 4,
        communication: 5,
        cultureFit: 5,
        recommendation: 'strong_yes',
        comments: 'Perfect fit for the BIM Manager role. Extensive technical expertise.',
      },
    }),
  ]);

  logger.info('Created reviews');

  // Create notes
  await Promise.all([
    prisma.note.create({
      data: {
        applicantId: applicants[0].id,
        content: 'Called to schedule interview for next Tuesday at 2pm.',
      },
    }),
    prisma.note.create({
      data: {
        applicantId: applicants[3].id,
        content: 'Sent offer letter on 1/20. Waiting for response.',
      },
    }),
  ]);

  logger.info('Created notes');

  // Seed default email templates
  await prisma.emailTemplate.upsert({
    where: { type: 'thank_you' },
    update: {},
    create: {
      type: 'thank_you',
      subject: 'Thank you for applying — {{jobTitle}}',
      body: `Dear {{firstName}},

Thank you for your interest in the {{jobTitle}} position at WHLC Architecture. We have received your application and appreciate the time you invested.

Our team will carefully review your qualifications and experience. If your background aligns with our needs, we will reach out to schedule next steps.

We appreciate your patience during this process.

Best regards,
The Hiring Team
WHLC Architecture`,
    },
  });

  await prisma.emailTemplate.upsert({
    where: { type: 'rejection' },
    update: {},
    create: {
      type: 'rejection',
      subject: 'Update on your application for {{jobTitle}}',
      body: `Dear {{firstName}},

Thank you for your interest in the {{jobTitle}} position and for taking the time to apply. We appreciate the effort you put into your application.

After careful consideration, we have decided to move forward with other candidates whose qualifications more closely align with our current needs.

We encourage you to apply for future openings that match your skills and experience. We wish you all the best in your career search.

Sincerely,
The Hiring Team`,
    },
  });

  logger.info('Created email templates');

  // Seed reviewer-to-job access assignments
  await prisma.jobReviewer.upsert({
    where: {
      userId_jobId: {
        userId: reviewer.id,
        jobId: jobs[0].id,
      },
    },
    update: {},
    create: {
      userId: reviewer.id,
      jobId: jobs[0].id,
    },
  });

  await prisma.jobReviewer.upsert({
    where: {
      userId_jobId: {
        userId: reviewer.id,
        jobId: jobs[1].id,
      },
    },
    update: {},
    create: {
      userId: reviewer.id,
      jobId: jobs[1].id,
    },
  });

  logger.info('Created reviewer assignments');

  // Seed notification subscriptions (manager gets notified for Senior Architect)
  await prisma.jobNotificationSub.upsert({
    where: {
      userId_jobId: {
        userId: manager.id,
        jobId: jobs[0].id,
      },
    },
    update: {},
    create: {
      userId: manager.id,
      jobId: jobs[0].id,
    },
  });

  await prisma.jobNotificationSub.upsert({
    where: {
      userId_jobId: {
        userId: admin.id,
        jobId: jobs[0].id,
      },
    },
    update: {},
    create: {
      userId: admin.id,
      jobId: jobs[0].id,
    },
  });

  logger.info('Created notification subscriptions');

  // Create recruitment events
  const lsuEvent = await prisma.recruitmentEvent.create({
    data: {
      name: 'LSU College of Design Job Fair 2026',
      type: 'job_fair',
      location: 'LSU Student Union',
      date: new Date('2026-03-15'),
      notes: 'Annual spring job fair. Bring portfolio review station and firm brochures.',
      createdById: manager.id,
    },
  });

  const ullEvent = await prisma.recruitmentEvent.create({
    data: {
      name: 'ULL Architecture Career Day 2026',
      type: 'campus_visit',
      location: 'ULL Fletcher Hall',
      date: new Date('2026-04-10'),
      notes: 'Invited to give firm presentation + portfolio reviews.',
      createdById: admin.id,
    },
  });

  logger.info('Created recruitment events');

  // Assign attendees
  await prisma.eventAttendee.create({
    data: { userId: reviewer.id, eventId: lsuEvent.id },
  });
  await prisma.eventAttendee.create({
    data: { userId: manager.id, eventId: lsuEvent.id },
  });
  await prisma.eventAttendee.create({
    data: { userId: admin.id, eventId: ullEvent.id },
  });

  logger.info('Created event attendees');

  // Create fair applicants for LSU event
  const fairApplicant1 = await prisma.applicant.create({
    data: {
      firstName: 'Marcus',
      lastName: 'Reed',
      email: 'marcus.reed@lsu.edu',
      phone: '225-555-0201',
      stage: 'new',
      source: 'LSU College of Design Job Fair 2026',
      jobId: jobs[1].id, // Junior Architect
      eventId: lsuEvent.id,
    },
  });

  const fairApplicant2 = await prisma.applicant.create({
    data: {
      firstName: 'Priya',
      lastName: 'Patel',
      email: 'priya.patel@lsu.edu',
      stage: 'new',
      source: 'LSU College of Design Job Fair 2026',
      eventId: lsuEvent.id, // General interest
    },
  });

  const fairApplicant3 = await prisma.applicant.create({
    data: {
      firstName: 'Jake',
      lastName: 'Fontenot',
      email: 'jake.fontenot@lsu.edu',
      phone: '337-555-0202',
      stage: 'screening',
      source: 'LSU College of Design Job Fair 2026',
      jobId: jobs[4].id, // Architecture Intern
      eventId: lsuEvent.id,
    },
  });

  logger.info('Created fair applicants');

  // Create inline reviews for fair applicants
  await prisma.review.create({
    data: {
      reviewerId: reviewer.id,
      applicantId: fairApplicant1.id,
      rating: 4,
      recommendation: 'yes',
      comments: 'Strong Revit skills, good portfolio. Interested in healthcare design.',
    },
  });

  await prisma.review.create({
    data: {
      reviewerId: reviewer.id,
      applicantId: fairApplicant2.id,
      rating: 3,
      recommendation: 'maybe',
      comments: 'Enthusiastic but early in studies. Follow up next year.',
    },
  });

  await prisma.review.create({
    data: {
      reviewerId: reviewer.id,
      applicantId: fairApplicant3.id,
      rating: 5,
      recommendation: 'strong_yes',
      comments: 'Exceptional model-making skills. Great personality, would fit in well.',
    },
  });

  logger.info('Created fair applicant reviews');

  // Add notes for fair applicants
  await prisma.note.create({
    data: {
      applicantId: fairApplicant1.id,
      content: `Added at LSU College of Design Job Fair 2026 by ${reviewer.email}`,
    },
  });
  await prisma.note.create({
    data: {
      applicantId: fairApplicant2.id,
      content: `Added at LSU College of Design Job Fair 2026 by ${reviewer.email}`,
    },
  });
  await prisma.note.create({
    data: {
      applicantId: fairApplicant3.id,
      content: `Added at LSU College of Design Job Fair 2026 by ${reviewer.email}`,
    },
  });

  logger.info('Created fair applicant notes');
  logger.info('Seeding complete!');
}

main()
  .catch((e) => {
    logger.error({ err: e }, 'Seed failed');
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
