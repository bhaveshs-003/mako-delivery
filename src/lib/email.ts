/**
 * Email delivery (spec §1, §8). Uses Resend when RESEND_API_KEY is set;
 * otherwise falls back to logging the email to the server console so the app
 * is fully functional in dev with zero configuration.
 *
 * To go live: set RESEND_API_KEY and EMAIL_FROM in .env (see README).
 */
import { Resend } from "resend";

const FROM = process.env.EMAIL_FROM || "noreply@mako-platform.com";
const APP_URL = process.env.NEXTAUTH_URL || "http://localhost:3000";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

export function isEmailConfigured(): boolean {
  return resend !== null;
}

/** Branded HTML wrapper for every notification email (spec §8). */
export function renderEmail(opts: {
  title: string;
  body: string;
  deepLinkPath?: string;
  ctaLabel?: string;
}): string {
  const href = opts.deepLinkPath ? `${APP_URL}${opts.deepLinkPath}` : APP_URL;
  const cta = opts.ctaLabel ?? "View in Mako";
  return `<!doctype html>
<html><body style="margin:0;background:#F7F8FA;font-family:Inter,Arial,sans-serif;color:#1A1A1A;">
  <div style="max-width:560px;margin:0 auto;padding:24px;">
    <div style="font-size:20px;font-weight:700;color:#1F2A44;margin-bottom:24px;">
      Mako <span style="font-weight:500;color:#5B6774;">Governance</span>
    </div>
    <div style="background:#FFFFFF;border:1px solid #E2E6EB;border-radius:8px;padding:24px;">
      <h1 style="margin:0 0 12px;font-size:18px;color:#1F2A44;">${escapeHtml(opts.title)}</h1>
      <p style="margin:0 0 20px;font-size:14px;line-height:1.5;color:#5B6774;">${escapeHtml(opts.body)}</p>
      <a href="${href}" style="display:inline-block;background:#1F2A44;color:#FFFFFF;text-decoration:none;font-size:14px;font-weight:500;padding:10px 20px;border-radius:6px;">${escapeHtml(cta)}</a>
    </div>
    <p style="margin:20px 0 0;font-size:12px;color:#5B6774;">
      This is an automated notification from the Mako Project Governance Platform.
    </p>
  </div>
</body></html>`;
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ sent: boolean }> {
  if (!resend) {
    console.log(
      `\n📧 [email:dev-fallback] to=${opts.to}\n   subject=${opts.subject}\n   (set RESEND_API_KEY to send for real)\n`
    );
    return { sent: false };
  }
  try {
    await resend.emails.send({
      from: FROM,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    });
    return { sent: true };
  } catch (e) {
    console.error("[email] send failed:", e);
    return { sent: false };
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
