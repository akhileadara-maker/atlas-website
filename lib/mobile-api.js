import "server-only";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Resolve the caller's Clerk userId (from the Authorization: Bearer token the
// mobile app sends). Returns a ready-to-return 401 response when missing.
export async function requireUserId() {
  const { userId } = await auth();
  if (!userId) {
    return {
      userId: null,
      response: NextResponse.json({ error: "You must be signed in." }, { status: 401 }),
    };
  }
  return { userId, response: null };
}

// Map a service-layer error message to an HTTP status. Services return the
// exact message strings the web Server Actions show, so this keys on those
// phrasings (see design doc "Error / status conventions").
function statusForError(message) {
  if (/not found/i.test(message)) return 404;
  if (/isn't configured/i.test(message)) return 503;
  if (/signed in/i.test(message)) return 401;
  if (/required|invalid|valid email|empty|unknown plan|doesn't have an agent/i.test(message)) return 400;
  return 502; // upstream (Retell/Stripe) or unexpected failure
}

// Turn a service result ({ error } or a success payload) into a JSON response.
export function serviceResponse(result) {
  if (result?.error) {
    return NextResponse.json({ error: result.error }, { status: statusForError(result.error) });
  }
  return NextResponse.json(result);
}

// Wrap a route handler so an unexpected throw still returns the JSON error
// shape mobile clients parse, instead of Next's default 500 response.
export function withMobileRoute(handler) {
  return async (...args) => {
    try {
      return await handler(...args);
    } catch (e) {
      console.error("mobile api route failed:", e);
      return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
    }
  };
}
