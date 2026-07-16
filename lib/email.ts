import { Resend } from 'resend';
import type { StoredReport } from '@/lib/reports-store';

/**
 * Best-effort responder notification email, sent via Resend whenever a new
 * emergency report is recorded. Never throws into the caller — a failed or
 * unconfigured email send should never block/undo a report that's already
 * been paid for and stored; failures are just logged server-side.
 */
export async function notifyResponders(report: StoredReport, responderEmails: string[]): Promise<void> {
  if (responderEmails.length === 0) return;

  if (!process.env.RESEND_API_KEY) {
    console.error('RESEND_API_KEY is not configured — skipping responder notification email');
    return;
  }

  const from = process.env.RESEND_FROM_EMAIL || 'Whizpr Alerts <alerts@whizpr.vercel.app>';
  const mapsUrl = `https://maps.google.com/?q=${report.lat},${report.lng}`;
  const location = report.countryName ?? 'an unspecified location';

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from,
      to: responderEmails,
      subject: `New emergency report in ${location}`,
      html: `
        <p><strong>A new emergency has been reported in ${escapeHtml(location)}.</strong></p>
        <ul>
          <li>Location: <a href="${mapsUrl}">${report.lat}, ${report.lng}</a></li>
          <li>People affected: ${report.casualties}</li>
          ${report.description ? `<li>Description: ${escapeHtml(report.description)}</li>` : ''}
          <li>Reported at: ${new Date(report.createdAt).toISOString()}</li>
        </ul>
        <p>Report ID: ${report.id}</p>
      `,
    });
  } catch (err) {
    console.error('Failed to send responder notification email', err);
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
