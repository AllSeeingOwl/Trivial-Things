// Sentry browser SDK for the Trivial Things static sites. Built per site by
// build.mjs, which fills in __SENTRY_DSN__ and __APP_NAME__.
import { init, setTag } from '@sentry/browser';

init({
  dsn: __SENTRY_DSN__,
  environment: 'production',
  // Sentry v11 collects user info (including IP addresses), cookies, headers,
  // query strings and request bodies by default. All of it stays out of Sentry.
  dataCollection: {
    userInfo: false,
    cookies: false,
    httpHeaders: false,
    httpBodies: [],
    urlQueryParams: false,
  },
});
// All Trivial Things apps share one Sentry project; this tags the site.
setTag('app', __APP_NAME__);
