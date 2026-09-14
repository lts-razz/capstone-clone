import type { APIRoute } from "astro";
import { parseBody } from "../../../lib/parseBody";
import { error, ok } from "../../../lib/response";
import { supabase } from "../../../lib/supabase";
import { forgotPasswordSchema } from "../../../validation/user";

export const prerender = false;

const NEUTRAL_SUCCESS_MESSAGE =
  "If an account exists for this email, a password reset link has been sent.";

function getPublicOrigin(request: Request, requestUrl: URL): string {
  const configuredSiteUrl = (
    import.meta.env.PUBLIC_SITE_URL ||
    import.meta.env.SITE_URL ||
    ""
  ).trim();

  if (configuredSiteUrl) {
    try {
      const configuredUrl = new URL(configuredSiteUrl);
      if (configuredUrl.protocol === "http:" || configuredUrl.protocol === "https:") {
        return configuredUrl.origin;
      }
    } catch {
      // Fall through to the request-derived origin.
    }
  }

  const forwardedHost = (
    request.headers.get("x-forwarded-host") ||
    request.headers.get("host") ||
    ""
  ).split(",")[0].trim();
  const forwardedProtocol = (
    request.headers.get("x-forwarded-proto") ||
    ""
  ).split(",")[0].trim().toLowerCase();
  const protocol = forwardedProtocol === "http" || forwardedProtocol === "https"
    ? forwardedProtocol
    : requestUrl.protocol === "http:"
      ? "http"
      : "https";

  if (forwardedHost) {
    try {
      const forwardedUrl = new URL(`${protocol}://${forwardedHost}`);
      if (
        !forwardedUrl.username &&
        !forwardedUrl.password &&
        forwardedUrl.host.toLowerCase() === forwardedHost.toLowerCase()
      ) {
        return forwardedUrl.origin;
      }
    } catch {
      // Fall through to Astro's parsed request origin.
    }
  }

  return requestUrl.origin;
}

export const POST: APIRoute = async ({ request, url }) => {
  const body = await parseBody(request);
  if (!body.ok) return body.response;

  const parsed = forgotPasswordSchema.safeParse(body.data);
  if (!parsed.success) return error(parsed.error.errors[0].message, 400);

  const redirectTo = new URL("/reset-password", getPublicOrigin(request, url)).toString();

  try {
    await supabase.auth.resetPasswordForEmail(parsed.data.email, { redirectTo });
  } catch {
    // Keep the response neutral so account existence and provider errors are not exposed.
  }

  return ok({ message: NEUTRAL_SUCCESS_MESSAGE });
};
