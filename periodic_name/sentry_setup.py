"""Sentry error reporting for a Trivial Things app.

This file is copied identically into every Flask app folder, because each app
is built as its own Docker image from its own folder. Keep the copies in sync
(tests/test_sentry_setup.py checks they match).

Sentry stays off unless SENTRY_DSN is set, and sentry_sdk is only imported
then, so local runs and tests need nothing extra.
"""
import os

# Recent sentry-sdk versions decide what they collect from data_collection, and
# by default send request bodies, headers, cookies, query strings, user info
# (including IP addresses) and local variables. Every category is switched off;
# errors keep their stack traces.
PRIVATE_DATA_COLLECTION = {
    "user_info": False,
    "cookies": {"mode": "off"},
    "http_headers": {"request": {"mode": "off"}},
    "http_bodies": [],
    "url_query_params": {"mode": "off"},
    "stack_frame_variables": False,
    "gen_ai": {"inputs": False, "outputs": False},
    "database_query_data": False,
    "queues": False,
}


def init_sentry(app_name: str) -> bool:
    """Start Sentry if SENTRY_DSN is set. Call before creating the Flask app.

    Every app shares one Sentry project; app_name tags each error with the app
    it came from. Returns True when Sentry was started.
    """
    dsn = os.getenv("SENTRY_DSN")
    if not dsn:
        return False

    import sentry_sdk

    sentry_sdk.init(
        dsn=dsn,
        environment=os.getenv("SENTRY_ENVIRONMENT", "production"),
        # Render sets RENDER_GIT_COMMIT on every deploy.
        release=os.getenv("RENDER_GIT_COMMIT"),
        # Tracing is off by default; set SENTRY_TRACES_SAMPLE_RATE (0 to 1) to turn it on.
        traces_sample_rate=float(os.getenv("SENTRY_TRACES_SAMPLE_RATE", "0")),
        data_collection=PRIVATE_DATA_COLLECTION,
    )
    sentry_sdk.set_tag("app", app_name)
    return True
