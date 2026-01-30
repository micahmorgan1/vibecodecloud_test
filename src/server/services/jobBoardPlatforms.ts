export interface JobBoardPlatform {
  id: string;
  name: string;
  description: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  color: string; // Tailwind color class for UI
  postedField: string; // Database field name for posted status
  postDateField: string; // Database field name for post date
  postUrlField: string; // Database field name for post URL
  externalUrl?: string; // URL to the job board posting page
}

export const JOB_BOARD_PLATFORMS: JobBoardPlatform[] = [
  {
    id: 'linkedin',
    name: 'LinkedIn',
    description: 'Professional social network',
    utmSource: 'linkedin',
    utmMedium: 'social',
    utmCampaign: 'linkedin_post',
    color: 'blue',
    postedField: 'postedToLinkedIn',
    postDateField: 'linkedInPostDate',
    postUrlField: 'linkedInPostUrl',
  },
  {
    id: 'handshake',
    name: 'Handshake',
    description: 'University recruiting platform',
    utmSource: 'handshake',
    utmMedium: 'job_board',
    utmCampaign: 'university_recruiting',
    color: 'green',
    postedField: 'postedToHandshake',
    postDateField: 'handshakePostDate',
    postUrlField: 'handshakePostUrl',
  },
  {
    id: 'aiala',
    name: 'AIALA',
    description: 'American Institute of Architects Louisiana',
    utmSource: 'aiala',
    utmMedium: 'job_board',
    utmCampaign: 'aiala_listing',
    color: 'purple',
    postedField: 'postedToAIALA',
    postDateField: 'aialaPostDate',
    postUrlField: 'aialaPostUrl',
    externalUrl: 'https://www.aiala.com/products/online-job-board-listing',
  },
  {
    id: 'aiabr',
    name: 'AIA Baton Rouge',
    description: 'AIA Baton Rouge job board',
    utmSource: 'aiabr',
    utmMedium: 'job_board',
    utmCampaign: 'aiabr_listing',
    color: 'orange',
    postedField: 'postedToAIABR',
    postDateField: 'aiabrPostDate',
    postUrlField: 'aiabrPostUrl',
    externalUrl: 'https://www.aiabr.com/new-page',
  },
];

export function getPlatformById(id: string): JobBoardPlatform | undefined {
  return JOB_BOARD_PLATFORMS.find(p => p.id === id);
}

export function generateTrackingUrl(platform: JobBoardPlatform, jobId: string): string {
  const baseUrl = process.env.PUBLIC_URL || 'http://localhost:3000';
  const params = new URLSearchParams({
    utm_source: platform.utmSource,
    utm_medium: platform.utmMedium,
    utm_campaign: platform.utmCampaign,
    source: platform.name,
  });

  return `${baseUrl}/apply/${jobId}?${params.toString()}`;
}
