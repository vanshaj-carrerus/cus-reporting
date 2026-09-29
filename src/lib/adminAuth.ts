import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "./adminSession";

/** For server components: is the current request signed in as admin? */
export async function isAdmin(): Promise<boolean> {
  const store = await cookies();
  return verifySessionToken(store.get(SESSION_COOKIE)?.value);
}

/** Call at the top of every admin page — proxy.ts alone is not enough. */
export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) {
    redirect("/admin/login");
  }
}

/** For route handlers: returns a 401 response to send back, or null if allowed. */
export function adminApiGuard(request: NextRequest): NextResponse | null {
  if (verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value)) {
    return null;
  }
  return NextResponse.json(
    { error: "Admin sign-in required." },
    { status: 401 }
  );
}
