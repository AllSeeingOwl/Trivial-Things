## 2026-03-21 - [Debug Mode in Production]
**Vulnerability:** Flask was running with `debug=True` bound to a public interface (`0.0.0.0`), allowing potential interactive debugger RCE and information disclosure via stack traces on unhandled exceptions (e.g., malformed `q_id` inputs).
**Learning:** Hardcoded development configurations in the main application entry point pose a severe risk if deployed without environment-specific overrides.
**Prevention:** Always default to `debug=False` and use environment variables (e.g., `FLASK_DEBUG`) to toggle debug features only in local development environments.

## 2026-03-21 - [Missing Null/Type Check for JSON Payload]
**Vulnerability:** The `/api/mark_used` endpoint did not check if `request.json` was `None` or not a dictionary before calling `.get()`. This could lead to a server crash (Internal Server Error) if a request was sent with an invalid or empty JSON payload.
**Learning:** Flask's `request.json` can return `None` if the payload is missing, malformed, or has the wrong `Content-Type`. Directly accessing methods on it without validation is unsafe.
**Prevention:** Always validate that JSON payloads are present and of the expected type (usually `dict`) before attempting to access their fields.

## 2026-03-22 - [Exposed Werkzeug Debugger in Sub-Application]
**Vulnerability:** The Flask application in `what_the_spell/app.py` was configured with `debug=True` and `host='0.0.0.0'`, exposing the Werkzeug interactive debugger to all network interfaces. This allows arbitrary remote code execution (RCE).
**Learning:** Sub-applications or micro-apps within a repository might have different configurations than the main application. It is crucial to verify the security configurations (like debug mode) across all applications in a monorepo or project with multiple entry points.
**Prevention:** Ensure `debug=False` is the default in all production or externally accessible Flask applications. Implement automated checks (e.g., linters or security scanners) to detect `debug=True` in `app.run()` calls before merging code.
