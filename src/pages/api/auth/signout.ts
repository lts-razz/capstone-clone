// POST /api/auth/signout — clear cookies and redirect to /signin
import type { APIRoute } from "astro";
import { signOutSession } from "../../../lib/auth";

export const prerender = false;

// POST is correct — GET signout is a CSRF logout vulnerability
export const POST: APIRoute = async ({ cookies, redirect }) => {
  await signOutSession(cookies);
  return redirect("/signin");
};

// Keep GET as a safe fallback redirect only (no signout logic)
export const GET: APIRoute = async ({ redirect }) => {
  return redirect("/signin");
};
