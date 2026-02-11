import nodemailer from 'nodemailer';
import prisma from '../db.js';
import logger from '../lib/logger.js';

// SMTP transport — uses Mailtrap/Postmark/any SMTP when configured, falls back to console.log
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM || 'WHLC ATS <noreply@whlc.com>';

let transporter: nodemailer.Transporter | null = null;

if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });
  logger.info(`Email: SMTP configured (${SMTP_HOST}:${SMTP_PORT})`);
} else {
  logger.info('Email: No SMTP configured, using mock');
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Send an email via SMTP if configured, otherwise log to console.
 * Retries with exponential backoff on rate-limit errors (Mailtrap free tier: ~1 email/sec).
 */
async function sendEmail(params: { to: string; subject: string; text: string; html?: string }): Promise<void> {
  const { to, subject, text, html } = params;

  if (transporter) {
    const mailOptions = { from: SMTP_FROM, to, subject, text, html: html || text };
    const MAX_RETRIES = 3;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        await transporter.sendMail(mailOptions);
        return;
      } catch (err: any) {
        const isRateLimit = err.responseCode === 550 && err.response?.includes('Too many emails');
        if (isRateLimit && attempt < MAX_RETRIES) {
          const delay = (attempt + 1) * 3000; // 3s, 6s, 9s
          logger.warn(`Email rate limited, retry ${attempt + 1}/${MAX_RETRIES} after ${delay / 1000}s`);
          await sleep(delay);
        } else {
          throw err;
        }
      }
    }
  } else {
    logger.info({ to, subject }, 'Email sent (mock)');
  }
}

// --- Interfaces ---

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
  applicantId: string;
  jobTitle: string;
}

interface ReviewRequestParams {
  to: string;
  recipientName: string;
  applicantName: string;
  applicantId: string;
  jobTitle: string;
  senderName: string;
  message?: string;
}

// --- Template helpers ---

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
  event_thank_you: {
    subject: 'Great meeting you at {{eventName}}',
    body: `Dear {{firstName}},

Thank you for stopping by to meet us at {{eventName}}. It was a pleasure learning about your background and interests.

Our team will review the information you shared with us. If your experience aligns with our current needs, we will be in touch to discuss next steps.

In the meantime, feel free to explore our open positions at whlc.com/careers.

Best regards,
The Hiring Team
WHLC Architecture`,
  },
  review_request: {
    subject: 'Review requested: {{applicantName}} for {{jobTitle}}',
    body: `Hi {{recipientName}},

{{senderName}} has requested your review of {{applicantName}} for the {{jobTitle}} position.

View Applicant: {{applicantUrl}}

Best,
WHLC ATS`,
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

// --- Email senders ---

export async function sendRejectionEmail(params: RejectionEmailParams): Promise<{ success: boolean }> {
  const { to, applicantName, jobTitle, emailBody } = params;

  await sendEmail({
    to,
    subject: `Update on your application for ${jobTitle}`,
    text: emailBody,
  });

  return { success: true };
}

export async function sendThankYouEmail(params: ThankYouEmailParams): Promise<{ success: boolean }> {
  const { to, subject, body } = params;

  await sendEmail({
    to,
    subject,
    text: body,
  });

  return { success: true };
}

export async function sendReviewerNotification(params: ReviewerNotificationParams): Promise<{ success: boolean }> {
  const { to, reviewerName, applicantName, applicantId, jobTitle } = params;
  const baseUrl = process.env.PUBLIC_URL || 'http://localhost:3004';
  const applicantUrl = `${baseUrl}/applicants/${applicantId}`;

  await sendEmail({
    to,
    subject: `New application for ${jobTitle}`,
    text: `Hi ${reviewerName},\n\n${applicantName} has submitted an application for ${jobTitle}.\n\nView Applicant: ${applicantUrl}\n\nBest,\nWHLC ATS`,
    html: `<p>Hi ${reviewerName},</p><p>${applicantName} has submitted an application for ${jobTitle}.</p><p><a href="${applicantUrl}">View Applicant</a></p><p>Best,<br>WHLC ATS</p>`,
  });

  return { success: true };
}

export async function sendReviewRequest(params: ReviewRequestParams): Promise<{ success: boolean }> {
  const { to, recipientName, applicantName, applicantId, jobTitle, senderName, message } = params;
  const baseUrl = process.env.PUBLIC_URL || 'http://localhost:3004';
  const applicantUrl = `${baseUrl}/applicants/${applicantId}`;

  const template = await getTemplate('review_request');
  const variables = { recipientName, applicantName, jobTitle, senderName, applicantUrl };
  let subject = resolveTemplate(template.subject, variables);
  let body = resolveTemplate(template.body, variables);

  // Append optional message if provided
  if (message) {
    body += `\n\nMessage from ${senderName}:\n${message}`;
  }

  await sendEmail({ to, subject, text: body });

  return { success: true };
}
