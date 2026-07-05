import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Only /dashboard requires auth; the marketing pages stay public.
const isProtected = createRouteMatcher(["/dashboard(.*)"]);
// The mobile API is auth-required too, but API clients get a JSON 401 —
// never a sign-in redirect.
const isMobileApi = createRouteMatcher(["/api/mobile(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (isMobileApi(req)) {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
    }
    return;
  }
  if (isProtected(req)) {
    // Send signed-out visitors to sign-in instead of showing a 404.
    const { userId, redirectToSignIn } = await auth();
    if (!userId) return redirectToSignIn();
  }
});

export const config = {
  matcher: [
    // Skip Next internals and static files; run on everything else.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
