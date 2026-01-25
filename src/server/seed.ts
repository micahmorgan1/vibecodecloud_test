import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create users
  const adminPassword = await bcrypt.hash('admin123', 10);
  const managerPassword = await bcrypt.hash('manager123', 10);
  const reviewerPassword = await bcrypt.hash('reviewer123', 10);

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

  console.log('Created users:', { admin: admin.email, manager: manager.email, reviewer: reviewer.email });

  // Create jobs
  const jobs = await Promise.all([
    prisma.job.create({
      data: {
        title: 'Senior Architect',
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

  console.log(`Created ${jobs.length} jobs`);

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
        yearsExperience: 10,
        currentCompany: 'Foster + Partners',
        currentTitle: 'Project Architect',
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
        yearsExperience: 2,
        currentCompany: 'Gensler',
        currentTitle: 'Designer',
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
        yearsExperience: 5,
        currentCompany: 'HKS Architects',
        currentTitle: 'Interior Designer',
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
        yearsExperience: 7,
        currentCompany: 'Perkins&Will',
        currentTitle: 'BIM Specialist',
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
        currentCompany: 'MIT',
        currentTitle: 'Architecture Student',
        stage: 'new',
        source: 'University Career Fair',
        jobId: jobs[4].id,
      },
    }),
  ]);

  console.log(`Created ${applicants.length} applicants`);

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

  console.log('Created reviews');

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

  console.log('Created notes');
  console.log('Seeding complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
