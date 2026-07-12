import "server-only";
import crypto from "crypto";
import { getSupabase } from "@/lib/supabase";
import { sendEmail, isResendConfigured } from "@/lib/resend";
import { isTenantSessionConfigured } from "@/lib/tenantSession";

const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS = 5;

// Sends a 6-digit one-time code. Anti-enumeration: a code is sent to ANY
// well-formed email — whether it's on a lease is only revealed after a correct
// code. Errors are limited to malformed email / unconfigured services.
export async function requestTenantCode(email) {
  const e = (email || "").toString().trim().toLowerCase();
  if (!isEmail(e)) return { error: "Please enter a valid email address." };
  if (!isTenantSessionConfigured()) return { error: "Tenant sign-in isn't configured yet." };
  if (!isResendConfigured()) {
    return { error: "We couldn't send a code right now — try again in a moment." };
  }
  const supabase = getSupabase();
  if (!supabase) return { error: "Something went wrong — please try again later." };

  const code = crypto.randomInt(0, 1000000).toString().padStart(6, "0");
  const { error } = await supabase.from("tenant_otps").upsert(
    {
      email: e,
      code_hash: sha256(code),
      expires_at: new Date(Date.now() + OTP_TTL_MS).toISOString(),
      attempts: 0,
      created_at: new Date().toISOString(),
    },
    { onConflict: "email" }
  );
  if (error) {
    console.error("otp store failed:", error.message);
    return { error: "We couldn't send a code right now — try again in a moment." };
  }

  const { sent } = await sendEmail({
    to: e,
    subject: "Your Atlas sign-in code",
    html: `
      <div style="font-family:Georgia,serif;background:#fafaf8;padding:32px;color:#1a2a41">
        <h2 style="margin:0 0 8px">Your Atlas sign-in code</h2>
        <p style="margin:0 0 20px;color:#4a5568">Enter this code to sign in. It expires in 10 minutes.</p>
        <p style="font-size:36px;letter-spacing:10px;font-weight:bold;margin:0;color:#2a9d8e">${code}</p>
        <p style="margin:24px 0 0;font-size:13px;color:#718096">If you didn't request this, you can ignore this email.</p>
      </div>`,
  });
  if (!sent) return { error: "We couldn't send a code right now — try again in a moment." };

  return { sent: true, email: e };
}

// Verifies a code: expiry, attempt cap (each miss increments; the cap kills
// the code), hash compare. On success the row is deleted (single-use).
export async function verifyTenantCode(email, code) {
  const e = (email || "").toString().trim().toLowerCase();
  const c = (code || "").toString().trim();
  if (!isEmail(e) || !/^\d{6}$/.test(c)) return { error: "That code doesn't match." };
  const supabase = getSupabase();
  if (!supabase) return { error: "Something went wrong — please try again later." };

  const { data: row } = await supabase
    .from("tenant_otps")
    .select("code_hash, expires_at, attempts")
    .eq("email", e)
    .maybeSingle();
  if (!row) return { error: "That code has expired — request a new one." };
  if (new Date(row.expires_at).getTime() < Date.now()) {
    return { error: "That code has expired — request a new one." };
  }
  if (row.attempts >= MAX_ATTEMPTS) {
    return { error: "Too many attempts — request a new code." };
  }

  if (sha256(c) !== row.code_hash) {
    await supabase
      .from("tenant_otps")
      .update({ attempts: row.attempts + 1 })
      .eq("email", e);
    return { error: "That code doesn't match." };
  }

  await supabase.from("tenant_otps").delete().eq("email", e);
  return { ok: true, email: e };
}
