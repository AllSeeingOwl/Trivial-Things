import os
import json
import urllib.request
import urllib.error
from flask import Flask, jsonify, request, render_template

app = Flask(__name__)
# Sentinel: Explicitly disable debug mode to prevent RCE vulnerabilities
app.config['DEBUG'] = False
# Sentinel: Limit request size to 1MB to prevent DoS attacks
app.config['MAX_CONTENT_LENGTH'] = 1 * 1024 * 1024

DOCTOR_ACTORS = [
    "William Hartnell", "Patrick Troughton", "Jon Pertwee", "Tom Baker",
    "Peter Davison", "Colin Baker", "Sylvester McCoy", "Paul McGann",
    "Christopher Eccleston", "David Tennant", "Matt Smith", "Peter Capaldi",
    "Jodie Whittaker", "Ncuti Gatwa"
]

@app.after_request
def add_security_headers(response):
    # Sentinel: Add essential security headers
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'SAMEORIGIN'
    response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
    # Allow CDN for React and Tailwind in index.html
    csp = (
        "default-src 'self' https://cdn.jsdelivr.net; "
        "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://unpkg.com; "
        "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
        "img-src 'self' data:; "
        "connect-src 'self';"
    )
    response.headers['Content-Security-Policy'] = csp
    return response

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/connect', methods=['POST'])
def connect_actors():
    data = request.json
    if not data or not isinstance(data, dict):
        return jsonify({'error': 'Invalid or missing request body'}), 400

    start_actor = data.get('startActor', '')
    target_doctor = data.get('targetDoctor', '')

    # Sentinel: Type validation to prevent unhandled AttributeErrors (e.g., .strip() on lists)
    # Sentinel: Length validation to prevent DoS via excessive processing and Gemini payload size
    if not isinstance(start_actor, str) or not isinstance(target_doctor, str) or \
       len(start_actor) > 100 or len(target_doctor) > 100:
        return jsonify({'error': 'Invalid input format or length exceeded'}), 400

    start_actor = start_actor.strip()
    target_doctor = target_doctor.strip()

    if not start_actor or not target_doctor:
        return jsonify({'error': 'Missing startActor or targetDoctor'}), 400

    # API key should be provided by environment
    api_key = os.environ.get('GEMINI_API_KEY')
    if not api_key:
        return jsonify({'error': 'Server configuration error: API key missing'}), 500

    prompt = (
        f"Find a connection path between two actors, \"{start_actor}\" and \"{target_doctor}\", "
        f"through shared film or television projects. The path should be no more than 6 steps "
        f"(where a step is a shared project leading to a co-star).\n"
        f"For each step in the path, provide the actor, the project they were in, and the co-star "
        f"they shared that project with.\n"
        f"Format each step as:\n"
        f"\"[Actor Name 1] was in \"[Project Title]\" with [Actor Name 2].\"\n"
        f"If no direct path within 6 steps is easily found, state that clearly (e.g., \"No direct path found within 6 steps.\").\n"
        f"The target actor, \"{target_doctor}\", is one of the actors who played Doctor Who. "
        f"Here is a list of the main actors who played Doctor Who for your reference: {', '.join(DOCTOR_ACTORS)}.\n\n"
        f"Please provide the shortest possible path you can find."
    )

    payload = {
        "contents": [
            {
                "parts": [{"text": prompt}]
            }
        ]
    }

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={api_key}"

    try:
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode('utf-8'),
            headers={'Content-Type': 'application/json'},
            method='POST'
        )
        # Sentinel: Add timeout to prevent DoS from hanging external API calls
        with urllib.request.urlopen(req, timeout=10) as response:
            result = json.loads(response.read().decode('utf-8'))

            if 'candidates' in result and len(result['candidates']) > 0:
                content = result['candidates'][0].get('content', {})
                parts = content.get('parts', [])
                if parts:
                    return jsonify({'connectionPath': parts[0].get('text', '')})

            return jsonify({'error': 'Unexpected response from AI service'}), 502

    except urllib.error.HTTPError as e:
        error_body = e.read().decode('utf-8')
        try:
            error_json = json.loads(error_body)
            msg = error_json.get('error', {}).get('message', 'AI service error')
        except Exception:
            msg = f"HTTP error {e.code}"
        return jsonify({'error': msg}), e.code
    except Exception as e:
        # Sentinel: Log actual error but return generic message to avoid leaking internals
        print(f"Security/Error connecting to external API: {e}")
        return jsonify({'error': 'An internal error occurred'}), 500

if __name__ == '__main__':
    # Sentinel: Disabled debug=True to prevent RCE and info disclosure
    app.run(port=5005, debug=False)
