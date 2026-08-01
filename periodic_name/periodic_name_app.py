import os
from flask import Flask, request, render_template

from periodic_name.elements_dict import ELEMENTS

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 1 * 1024 * 1024  # 1MB limit

@app.after_request
def add_security_headers(response):
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'DENY'
    response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
    response.headers['Content-Security-Policy'] = "default-src 'self'; script-src 'self' https://cdn.tailwindcss.com; style-src 'self' 'unsafe-inline';"
    return response

def find_elements_in_name(name):
    """
    Finds which element symbols appear as substrings in the provided name.
    Matches are case-insensitive.
    Returns a list of matched element dictionaries, sorted by their first appearance in the name.
    """
    if not name:
        return []

    name_lower = name.lower()
    matches = []

    for element in ELEMENTS:
        symbol = element['symbol']
        symbol_lower = symbol.lower()

        index = name_lower.find(symbol_lower)
        if index != -1:
            matches.append({
                'element': element,
                'index': index,
                'symbol_length': len(symbol)
            })

    # Sort matches by the index they appear in the name, and then by symbol length descending
    # so we prioritize longer matches if they start at the same place
    matches.sort(key=lambda x: (x['index'], -x['symbol_length']))

    return [match['element'] for match in matches]

@app.route('/', methods=['GET', 'POST'])
def index():
    name = ''
    matched_elements = None

    if request.method == 'POST':
        name = request.form.get('name', '').strip()
        # Restrict name length to prevent abuse
        if len(name) > 100:
            name = name[:100]

        matched_elements = find_elements_in_name(name)

    return render_template('index.html', name=name, matched_elements=matched_elements)

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    host = os.environ.get('HOST', '127.0.0.1')
    app.run(host=host, port=port)
