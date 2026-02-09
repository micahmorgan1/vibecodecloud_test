import prisma from '../db.js';

interface RejectionEmailParams {
  to: string;
  applicantName: string;
  jobTitle: string;
  emailBody: string;
}

interface ThankYouEmailParams {
  to: string;
  applicantName: string;
  subject: string;
  body: string;
}

interface ReviewerNotificationParams {
  to: string;
  reviewerName: string;
  applicantName: string;
  jobTitle: string;
}

const DEFAULT_TEMPLATES: Record<string, { subject: string; body: string }> = {
  thank_you: {
    subject: 'Thank you for applying — {{jobTitle}}',
    body: `Dear {{firstName}},

Thank you for your interest in the {{jobTitle}} position at WHLC Architecture. We have received your application and appreciate the time you invested.

Our team will carefully review your qualifications and experience. If your background aligns with our needs, we will reach out to schedule next steps.

We appreciate your patience during this process.

Best regards,
The Hiring Team
WHLC Architecture`,
  },
  rejection: {
    subject: 'Update on your application for {{jobTitle}}',
    body: `Dear {{firstName}},

Thank you for your interest in the {{jobTitle}} position and for taking the time to apply. We appreciate the effort you put into your application.

After careful consideration, we have decided to move forward with other candidates whose qualifications more closely align with our current needs.

We encourage you to apply for future openings that match your skills and experience. We wish you all the best in your career search.

Sincerely,
The Hiring Team`,
  },
};

export async function getTemplate(type: string): Promise<{ subject: string; body: string }> {
  const template = await prisma.emailTemplate.findUnique({ where: { type } });
  if (template) {
    return { subject: template.subject, body: template.body };
  }
  return DEFAULT_TEMPLATES[type] || { subject: '', body: '' };
}

export function resolveTemplate(text: string, variables: Record<string, string>): string {
  let resolved = text;
  for (const [key, value] of Object.entries(variables)) {
    resolved = resolved.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }
  return resolved;
}

export function getRejectionTemplate(firstName: string, jobTitle: string): string {
  return `Dear ${firstName},

Thank you for your interest in the ${jobTitle} position and for taking the time to apply. We appreciate the effort you put into your application.

After careful consideration, we have decided to move forward with other candidates whose qualifications more closely align with our current needs.

We encourage you to apply for future openings that match your skills and experience. We wish you all the best in your career search.

Sincerely,
The Hiring Team`;
}

export async function sendRejectionEmail(params: RejectionEmailParams): Promise<{ success: boolean }> {
  const { to, applicantName, jobTitle, emailBody } = params;

  console.log('=== REJECTION EMAIL (mock) ===');
  console.log(`To: ${to}`);
  console.log(`Applicant: ${applicantName}`);
  console.log(`Subject: Update on your application for ${jobTitle}`);
  console.log(`Body:\n${emailBody}`);
  console.log('=== END EMAIL ===');

  return { success: true };
}

export async function sendThankYouEmail(params: ThankYouEmailParams): Promise<{ success: boolean }> {
  const { to, applicantName, subject, body } = params;

  console.log('=== THANK YOU EMAIL (mock) ===');
  console.log(`To: ${to}`);
  console.log(`Applicant: ${applicantName}`);
  console.log(`Subject: ${subject}`);
  console.log(`Body:\n${body}`);
  console.log('=== END EMAIL ===');

  return { success: true };
}

export async function sendReviewerNotification(params: ReviewerNotificationParams): Promise<{ success: boolean }> {
  const { to, reviewerName, applicantName, jobTitle } = params;

  console.log('=== REVIEWER NOTIFICATION (mock) ===');
  console.log(`To: ${to}`);
  console.log(`Reviewer: ${reviewerName}`);
  console.log(`Subject: New application for ${jobTitle}`);
  console.log(`Body: ${applicantName} has submitted an application for ${jobTitle}. Please review their profile in the ATS.`);
  console.log('=== END EMAIL ===');

  return { success: true };
}

interface ReviewRequestParams {
  to: string;
  recipientName: string;
  applicantName: string;
  jobTitle: string;
  senderName: string;
  message?: string;
}

export async function sendReviewRequest(params: ReviewRequestParams): Promise<{ success: boolean }> {
  const { to, recipientName, applicantName, jobTitle, senderName, message } = params;

  console.log('=== REVIEW REQUEST (mock) ===');
  console.log(`To: ${to}`);
  console.log(`Recipient: ${recipientName}`);
  console.log(`Subject: Review requested: ${applicantName} for ${jobTitle}`);
  console.log(`Body: ${senderName} has requested your review of ${applicantName} for the ${jobTitle} position.${message ? `\n\nMessage: ${message}` : ''}\n\nPlease log in to the ATS to submit your review.`);
  console.log('=== END EMAIL ===');

  return { success: true };
}
