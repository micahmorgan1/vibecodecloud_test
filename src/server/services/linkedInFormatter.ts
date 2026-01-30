interface Job {
  title: string;
  department: string;
  location: string;
  type: string;
  description: string;
  requirements: string;
  salary?: string | null;
}

interface LinkedInJobPost {
  title: string;
  body: string;
  hashtags: string[];
  applyUrl: string;
}

export function formatJobForLinkedIn(job: Job, jobId: string): LinkedInJobPost {
  // Generate LinkedIn-optimized post body
  const body = `
We're hiring: ${job.title}

${job.description}

Location: ${job.location}
Type: ${formatJobType(job.type)}
${job.salary ? `Salary: ${job.salary}` : ''}

What we're looking for:
${formatRequirements(job.requirements)}

Ready to join our team? Apply now:
${getApplyUrl(jobId)}

#architecture #hiring #${job.department.toLowerCase().replace(/\s+/g, '')} #${job.location.toLowerCase().replace(/[,\s]+/g, '')}
  `.trim();

  return {
    title: `${job.title} - ${job.location}`,
    body,
    hashtags: generateHashtags(job),
    applyUrl: getApplyUrl(jobId),
  };
}

function formatJobType(type: string): string {
  const typeMap: Record<string, string> = {
    'full-time': 'Full-Time',
    'part-time': 'Part-Time',
    'contract': 'Contract',
    'internship': 'Internship',
  };
  return typeMap[type] || type;
}

function formatRequirements(requirements: string): string {
  // Convert requirements text to bullet points
  const bullets = requirements
    .split(/\n|\./)
    .filter(r => r.trim().length > 0)
    .map(r => `• ${r.trim()}`)
    .join('\n');
  return bullets;
}

function generateHashtags(job: Job): string[] {
  const baseHashtags = ['architecture', 'hiring', 'jobs'];
  const deptHashtag = job.department.toLowerCase().replace(/\s+/g, '');
  const locationHashtag = job.location.toLowerCase().replace(/[,\s]+/g, '');

  return [...baseHashtags, deptHashtag, locationHashtag];
}

function getApplyUrl(jobId: string): string {
  const baseUrl = process.env.PUBLIC_URL || 'http://localhost:3000';
  return `${baseUrl}/apply/${jobId}?utm_source=linkedin&utm_medium=social&utm_campaign=linkedin_post&source=LinkedIn`;
}
