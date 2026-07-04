"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { createProperty } from "@/lib/services/properties";

// Server Action: thin wrapper — parses the form, delegates to the properties
// service (which owns the Supabase insert + best-effort Retell agent setup),
// then revalidates. user_id comes from the trusted Clerk session, never the form.
export async function addProperty(prevState, formData) {
  const { userId } = await auth();

  const result = await createProperty(userId, {
    name: formData.get("name"),
    address: formData.get("address"),
    units: formData.get("units"),
  });
  if (result.error) return { error: result.error };

  revalidatePath("/dashboard");
  return { success: true };
}
