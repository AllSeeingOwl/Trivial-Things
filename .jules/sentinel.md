## 2026-03-21 - [Debug Mode in Production]
**Vulnerability:** Flask was running with `debug=True` bound to a public interface (`0.0.0.0`), allowing potential interactive debugger RCE and information disclosure via stack traces on unhandled exceptions (e.g., malformed `q_id` inputs).
**Learning:** Hardcoded development configurations in the main application entry point pose a severe risk if deployed without environment-specific overrides.
**Prevention:** Always default to `debug=False` and use environment variables (e.g., `FLASK_DEBUG`) to toggle debug features only in local development environments.
