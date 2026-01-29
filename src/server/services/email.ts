interface RejectionEmailParams {
  to: string;
  applicantName: string;
  jobTitle: string;
  emailBody: string;
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

  // In staging/dev mode: log the email to console instead of sending
  // To switch to Postmark, replace this block with:
  //   import postmark from 'postmark';
  //   const client = new postmark.ServerClient(process.env.POSTMARK_API_TOKEN!);
  //   await client.sendEmail({
  //     From: process.env.EMAIL_FROM!,
  //     To: to,
  //     Subject: `Update on your application for ${jobTitle}`,
  //     TextBody: emailBody,
  //   });

  console.log('=== REJECTION EMAIL (mock) ===');
  console.log(`To: ${to}`);
  console.log(`Applicant: ${applicantName}`);
  console.log(`Subject: Update on your application for ${jobTitle}`);
  console.log(`Body:\n${emailBody}`);
  console.log('=== END EMAIL ===');

  return { success: true };
}
