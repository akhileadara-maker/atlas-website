"use server";

import { redirect } from "next/navigation";
import { requestTenantCode, verifyTenantCode } from "@/lib/services/tenantAuth";
import { mintTenantSession, setTenantSessionCookie } from "@/lib/tenantSession";

// Step 1: send a code. Neutral response regardless of lease existence.
export async function requestCode(prevState, formData) {
  const email = (formData.get("email") || "").toString();
  const res = await requestTenantCode(email);
  if (res.error) return { error: res.error };
  return { sent: true, email: res.email };
}

// Step 2: verify the code; on success mint the session and go to /tenant.
export async function verifyCode(prevState, formData) {
  const email = (formData.get("email") || "").toString();
  const code = (formData.get("code") || "").toString();
  const res = await verifyTenantCode(email, code);
  if (res.error) return { error: res.error };

  await setTenantSessionCookie(mintTenantSession(res.email));
  redirect("/tenant"); // throws — must be outside try/catch
}
