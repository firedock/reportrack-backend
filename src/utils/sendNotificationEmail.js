'use strict';

/**
 * Email abstraction for the Notifications feature.
 *
 * Provider selection (env-driven):
 *   EMAIL_PROVIDER=resend  → Resend HTTP API (uses RESEND_API_KEY)
 *   anything else          → Strapi's existing email plugin (the SMTP
 *                            wired up via @strapi/provider-email-nodemailer)
 *
 * Sender selection:
 *   NOTIFICATION_EMAIL_FROM if set; otherwise falls back to
 *     - 'onboarding@resend.dev' for Resend (Resend safeguard: only delivers
 *       to the account owner's verified email — perfect for staging)
 *     - 'noreply@reportrack.com' for SMTP
 */
async function sendNotificationEmail({ strapi, to, subject, html, text }) {
  const provider = (process.env.EMAIL_PROVIDER || '').toLowerCase();
  const recipients = Array.isArray(to) ? to : [to];

  if (provider === 'resend') {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error('EMAIL_PROVIDER=resend but RESEND_API_KEY is not set');
    }
    const from =
      process.env.NOTIFICATION_EMAIL_FROM ||
      'Reportrack <onboarding@resend.dev>';
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: recipients,
        subject,
        html,
        text,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Resend error ${res.status}: ${body}`);
    }
    return res.json();
  }

  // Fallback: Strapi's email plugin (existing SMTP)
  const from =
    process.env.NOTIFICATION_EMAIL_FROM || 'noreply@reportrack.com';
  const results = [];
  for (const recipient of recipients) {
    const out = await strapi.plugins['email'].services.email.send({
      to: recipient,
      from,
      subject,
      html,
      text,
    });
    results.push(out);
  }
  return results;
}

module.exports = { sendNotificationEmail };
