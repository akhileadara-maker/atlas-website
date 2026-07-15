import "server-only";
import crypto from "crypto";
import { getSupabase } from "@/lib/supabase";
import { sendEmail, isResendConfigured } from "@/lib/resend";
import { isTenantSessionConfigured } from "@/lib/tenantSession";

const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 60 * 1000; // min gap between codes for one email
const IP_WINDOW_MS = 60 * 60 * 1000; // per-IP rate-limit window
const IP_MAX_PER_WINDOW = 20; // max code requests per IP per window

// Sends a 6-digit one-time code. Anti-enumeration: a code is sent to ANY
// well-formed email — whether it's on a lease is only revealed after a correct
// code. Errors are limited to malformed email / unconfigured services / rate
// limits. `ip` (from x-forwarded-for) rate-limits abusive senders; a missing
// ip skips only the per-IP check, never the per-email cooldown.
export async function requestTenantCode(email, ip = null) {
  const e = (email || "").toString().trim().toLowerCase();
  if (!isEmail(e)) return { error: "Please enter a valid email address." };
  if (!isTenantSessionConfigured()) return { error: "Tenant sign-in isn't configured yet." };
  if (!isResendConfigured()) {
    return { error: "We couldn't send a code right now — try again in a moment." };
  }
  const supabase = getSupabase();
  if (!supabase) return { error: "Something went wrong — please try again later." };

  // Opportunistic cleanup so unverified emails and old IP windows don't
  // accumulate (no cron needed; every request sweeps the stale rows).
  const nowIso = new Date().toISOString();
  await supabase.from("tenant_otps").delete().lt("expires_at", nowIso);
  await supabase
    .from("tenant_otp_ips")
    .delete()
    .lt("window_start", new Date(Date.now() - 2 * IP_WINDOW_MS).toISOString());

  // Per-IP cap: fixed one-hour windows. Read-then-write races only let a
  // request or two extra through — fine for rate limiting.
  if (ip) {
    const { data: ipRow } = await supabase
      .from("tenant_otp_ips")
      .select("window_start, count")
      .eq("ip", ip)
      .maybeSingle();
    const inWindow =
      ipRow && Date.now() - new Date(ipRow.window_start).getTime() < IP_WINDOW_MS;
    if (inWindow && ipRow.count >= IP_MAX_PER_WINDOW) {
      return { error: "Too many code requests — try again later." };
    }
    if (inWindow) {
      await supabase
        .from("tenant_otp_ips")
        .update({ count: ipRow.count + 1 })
        .eq("ip", ip);
    } else {
      await supabase
        .from("tenant_otp_ips")
        .upsert({ ip, window_start: nowIso, count: 1 }, { onConflict: "ip" });
    }
  }

  // Per-email cooldown: one code per minute. The row exists for ANY email
  // that requested a code, so this reveals nothing about lease existence.
  const { data: existing } = await supabase
    .from("tenant_otps")
    .select("created_at")
    .eq("email", e)
    .maybeSingle();
  if (existing && Date.now() - new Date(existing.created_at).getTime() < RESEND_COOLDOWN_MS) {
    return { error: "We just sent a code — check your email, or wait a minute to request another." };
  }

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

  // ------------------------------------------------------------------------
  // DEV ONLY — REMOVE BEFORE PRODUCTION.
  // Logs the raw OTP and tolerates a failed email send so local smoke tests
  // can complete without a verified Resend domain (the free tier delivers
  // only to the account owner's address). Gated on NODE_ENV=development, so
  // production (Vercel sets NODE_ENV=production) never logs codes or skips
  // the send check even if this block were accidentally shipped.
  const isDev = process.env.NODE_ENV === "development";
  if (isDev) {
    console.log(`[dev-only] tenant OTP for ${e}: ${code}`);
  }
  // ------------------------------------------------------------------------

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
  // DEV ONLY (see block above): a failed send is non-fatal in development so
  // the code-entry step stays reachable for non-owner test emails.
  if (!sent && !isDev) return { error: "We couldn't send a code right now — try again in a moment." };

  return { sent: true, email: e };
}

// Verifies a code: expiry, attempt cap, hash compare. The attempt counter is
// incremented atomically in the DB BEFORE the compare, so even concurrent
// guesses get at most MAX_ATTEMPTS compares per code. The compare itself is
// constant-time. On success the row is deleted (single-use).
export async function verifyTenantCode(email, code) {
  const e = (email || "").toString().trim().toLowerCase();
  const c = (code || "").toString().trim();
  if (!isEmail(e) || !/^\d{6}$/.test(c)) return { error: "That code doesn't match." };
  const supabase = getSupabase();
  if (!supabase) return { error: "Something went wrong — please try again later." };

  const { data: row } = await supabase
    .from("tenant_otps")
    .select("code_hash, expires_at")
    .eq("email", e)
    .maybeSingle();
  if (!row) return { error: "That code has expired — request a new one." };
  if (new Date(row.expires_at).getTime() < Date.now()) {
    return { error: "That code has expired — request a new one." };
  }

  // Atomic increment-then-check (DB-side attempts = attempts + 1). Every
  // verify call spends an attempt up front; a success deletes the row anyway.
  const { data: attempts, error: incError } = await supabase.rpc(
    "increment_otp_attempts",
    { p_email: e }
  );
  if (incError || attempts == null) {
    console.error("otp attempt increment failed:", incError?.message || "no row");
    return { error: "That code has expired — request a new one." };
  }
  if (attempts > MAX_ATTEMPTS) {
    return { error: "Too many attempts — request a new code." };
  }

  const expected = Buffer.from(row.code_hash, "hex");
  const actual = Buffer.from(sha256(c), "hex");
  if (expected.length !== actual.length || !crypto.timingSafeEqual(actual, expected)) {
    return { error: "That code doesn't match." };
  }

  await supabase.from("tenant_otps").delete().eq("email", e);
  return { ok: true, email: e };
}
