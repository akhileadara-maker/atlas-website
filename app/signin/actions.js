"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { requestTenantCode, verifyTenantCode } from "@/lib/services/tenantAuth";
import { mintTenantSession, setTenantSessionCookie } from "@/lib/tenantSession";

// Step 1: send a code. Neutral response regardless of lease existence.
// The caller's IP (first x-forwarded-for hop, set by Vercel) feeds the
// per-IP rate limit; absent locally, the per-email cooldown still applies.
export async function requestCode(prevState, formData) {
  const email = (formData.get("email") || "").toString();
  const h = await headers();
  const ip = (h.get("x-forwarded-for") || "").split(",")[0].trim() || null;
  const res = await requestTenantCode(email, ip);
  if (res.error) return { error: res.error };
  return { sent: true, email: res.email };
}

// Step 2: verify the code; on success mint the session and go to /tenant.
export async function verifyCode(prevState, formData) {
  const email = (formData.get("email") || "").toString();
  const code = (formData.get("code") || "").toString().replace(/[^0-9]/g, "");
  const res = await verifyTenantCode(email, code);
  if (res.error) return { error: res.error };

  await setTenantSessionCookie(mintTenantSession(res.email));
  redirect("/tenant"); // throws — must be outside try/catch
}
