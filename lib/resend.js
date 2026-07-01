import "server-only";
import { Resend } from "resend";

// SERVER-ONLY Resend client using the secret RESEND_API_KEY. Lazily created so a
// missing env var during build never throws. Returns null when not configured.
let client = null;

export function getResend() {
  if (client) return client;
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  client = new Resend(key);
  return client;
}

export function isResendConfigured() {
  return Boolean(process.env.RESEND_API_KEY);
}

// From address — override with EMAIL_FROM once you've verified a domain in
// Resend. The default shared sender works on the free tier with no setup.
const FROM = process.env.EMAIL_FROM || "Atlas <onboarding@resend.dev>";

// Best-effort send. Never throws — returns { sent } so callers can decide
// whether to record that a notification actually went out.
export async function sendEmail({ to, subject, html }) {
  const resend = getResend();
  if (!resend || !to) return { sent: false };

  try {
    const { error } = await resend.emails.send({ from: FROM, to, subject, html });
    if (error) {
      console.error("Resend send failed:", error.message || error);
      return { sent: false };
    }
    return { sent: true };
  } catch (e) {
    console.error("Resend send threw:", e.message);
    return { sent: false };
  }
}
