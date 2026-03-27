## 2024-05-24 - [CRITICAL] Disable debug=True in where_in_the_world Flask app
**Vulnerability:** The `where_in_the_world` sub-application was running with `app.run(port=5004, debug=True)`. This exposes the interactive Werkzeug debugger on unhandled exceptions.
**Learning:** Leaving `debug=True` in production or globally exposed Flask apps allows remote code execution (RCE) and leaks sensitive stack traces, undermining the security of the application.
**Prevention:** Always verify `debug=False` for Flask applications. Implement automated checks (e.g., linters or security scanners) to detect `debug=True` in `app.run()` calls before merging code.
