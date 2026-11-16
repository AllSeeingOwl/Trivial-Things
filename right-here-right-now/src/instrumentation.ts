// Sentry error reporting for the server (see node_modules/next/dist/docs/
// 01-app/03-api-reference/03-file-conventions/instrumentation.md).
// Sentry stays off unless SENTRY_DSN is set, so local runs and tests send nothing.
import type { Instrumentation } from 'next';

// Sentry v11 ignores sendDefaultPii and by default collects request headers,
// cookies, query strings, bodies, user info (including IP addresses) and local
// variables. Every category is switched off; errors keep their stack traces.
const PRIVATE_DATA_COLLECTION = {
  userInfo: false,
  cookies: false,
  httpHeaders: false,
  httpBodies: [],
  urlQueryParams: false,
  stackFrameVariables: false,
} as const;

let sentry: typeof import('@sentry/node') | null = null;

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs' || !process.env.SENTRY_DSN) return;

  sentry = await import('@sentry/node');
  sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.SENTRY_ENVIRONMENT || 'production',
    // Render sets RENDER_GIT_COMMIT on every deploy.
    release: process.env.RENDER_GIT_COMMIT || undefined,
    tracesSampleRate: 0,
    dataCollection: { ...PRIVATE_DATA_COLLECTION, httpBodies: [] },
  });
  // All Trivial Things apps share one Sentry project; this tags the app.
  sentry.setTag('app', 'right-here-right-now');
}

// Called by Next.js for errors in Server Components, Route Handlers, Server
// Actions and Proxy. Only the route pattern is sent, never the request's
// headers or query string.
export const onRequestError: Instrumentation.onRequestError = async (err, _request, context) => {
  if (!sentry) return;
  sentry.captureException(err, {
    tags: { routeType: context.routeType, routePath: context.routePath },
  });
  await sentry.flush(2000);
};
