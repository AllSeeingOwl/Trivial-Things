import unittest
from unittest.mock import patch, mock_open, MagicMock
import sys
import os
import json
import re

# Ensure the app directory is in sys.path
sys.path.append(os.path.dirname(__file__))

# Generic Mock Flask and related classes to allow testing without the flask package
class MockFlask:
    def __init__(self, name):
        self.config = {}
        self.routes = []
        self.after_request_funcs = []

    def after_request(self, f):
        self.after_request_funcs.append(f)
        return f

    def route(self, rule, **options):
        def decorator(f):
            # Convert Flask route rule to regex
            # e.g., /api/grid/<int:grid_idx> -> ^/api/grid/(?P<grid_idx>\d+)$
            regex_rule = rule
            # Replace <int:var> with (?P<var>\d+)
            regex_rule = re.sub(r'<int:(\w+)>', r'@@@\1@@@', regex_rule)
            # Replace <var> with (?P<var>[^/]+)
            regex_rule = re.sub(r'<(\w+)>', r'###\1###', regex_rule)

            # Final conversion to regex
            regex_rule = regex_rule.replace('.', '\\.')
            regex_rule = re.sub(r'@@@(\w+)@@@', r'(?P<\1>\\d+)', regex_rule)
            regex_rule = re.sub(r'###(\w+)###', r'(?P<\1>[^/]+)', regex_rule)
            regex_rule = '^' + regex_rule + '$'

            self.routes.append({
                'rule': rule,
                'regex': re.compile(regex_rule),
                'handler': f,
                'methods': options.get('methods', ['GET'])
            })
            return f
        return decorator

    def test_client(self):
        return MockClient(self)

class MockClient:
    def __init__(self, app):
        self.app = app

    def _simulate_request(self, path, method, json_data=None):
        for route in self.app.routes:
            match = route['regex'].match(path)
            if match:
                if method not in route['methods']:
                    return MockResponse({'error': 'Method Not Allowed'}, 405)

                # Extract URL parameters and convert to appropriate types
                kwargs = match.groupdict()
                # Attempt to convert digits to ints (basic Flask behavior simulation)
                for key, value in kwargs.items():
                    if value.isdigit():
                        kwargs[key] = int(value)

                result = route['handler'](**kwargs)

                if isinstance(result, tuple):
                    body, status = result
                    response = MockResponse(body, status)
                else:
                    response = MockResponse(result, 200)

                for func in self.app.after_request_funcs:
                    response = func(response)
                return response

        return MockResponse({'error': 'Not Found'}, 404)

    def get(self, path):
        return self._simulate_request(path, 'GET')

class MockResponse:
    def __init__(self, data, status_code):
        self.status_code = status_code
        self._data = data
        self.headers = {}

    def get_json(self):
        return self._data

    @property
    def data(self):
        if isinstance(self._data, str):
            return self._data.encode()
        return json.dumps(self._data).encode()

# Setup the mocks BEFORE importing app
mock_flask_module = MagicMock()
mock_flask_module.Flask = MockFlask
mock_flask_module.jsonify = lambda x: x
mock_flask_module.render_template = lambda name, **kwargs: f"Rendered {name} with {kwargs}"
sys.modules['flask'] = mock_flask_module

# Test regex conversion before importing app
def test_regex():
    rule = '/api/grid/<int:grid_idx>'
    regex_rule = rule
    regex_rule = re.sub(r'<int:(\w+)>', r'@@@\1@@@', regex_rule)
    regex_rule = re.sub(r'<(\w+)>', r'###\1###', regex_rule)
    regex_rule = regex_rule.replace('.', '\\.')
    regex_rule = re.sub(r'@@@(\w+)@@@', r'(?P<\1>\\d+)', regex_rule)
    regex_rule = re.sub(r'###(\w+)###', r'(?P<\1>[^/]+)', regex_rule)
    regex_rule = '^' + regex_rule + '$'
    print(f"Rule: {rule} -> Regex: {regex_rule}")
    pattern = re.compile(regex_rule)
    match = pattern.match('/api/grid/123')
    assert match is not None
    assert match.group('grid_idx') == '123'

if __name__ == '__main__':
    try:
        test_regex()
        print("Regex test passed")
    except Exception as e:
        print(f"Regex test failed: {e}")
        sys.exit(1)

import app

class TestWhatTheSpell(unittest.TestCase):
    def setUp(self):
        self.client = app.app.test_client()
        app._cache_grids = None
        app._cache_pool = None

    def test_load_data_no_file(self):
        with patch('os.path.exists', return_value=False):
            grids, pool = app.load_data()
            self.assertEqual(grids, [])
            self.assertEqual(pool, [])

    def test_load_data_parsing(self):
        csv_content = "1,2,3,4,5,6,\n"
        for i in range(1, 11):
            csv_content += f"w{i}1,w{i}2,w{i}3,w{i}4,w{i}5,w{i}6,{i}\n"
        csv_content += "pool1,,,,\n"
        csv_content += "pool2,,,,\n"

        with patch('os.path.exists', return_value=True):
            with patch('builtins.open', mock_open(read_data=csv_content)):
                grids, pool = app.load_data()
                self.assertEqual(len(grids), 1)
                self.assertEqual(len(grids[0]), 10)
                self.assertEqual(grids[0][0], ['w11', 'w12', 'w13', 'w14', 'w15', 'w16'])
                self.assertEqual(pool, ['pool1', 'pool2'])

    def test_index_route(self):
        csv_content = "1,2,3,4,5,6,\n"
        for i in range(1, 11):
            csv_content += f"w{i}1,w{i}2,w{i}3,w{i}4,w{i}5,w{i}6,{i}\n"

        with patch('os.path.exists', return_value=True):
            with patch('builtins.open', mock_open(read_data=csv_content)):
                response = self.client.get('/')
                self.assertEqual(response.status_code, 200)
                self.assertIn("Rendered index.html with {'num_grids': 1}", response.data.decode())

    def test_get_grid_api(self):
        csv_content = "1,2,3,4,5,6,\n"
        for i in range(1, 11):
            csv_content += f"w{i}1,w{i}2,w{i}3,w{i}4,w{i}5,w{i}6,{i}\n"

        with patch('os.path.exists', return_value=True):
            with patch('builtins.open', mock_open(read_data=csv_content)):
                # Valid grid
                response = self.client.get('/api/grid/0')
                self.assertEqual(response.status_code, 200)
                data = response.get_json()
                self.assertIn('grid', data)
                self.assertEqual(len(data['grid']), 10)
                self.assertEqual(data['grid'][0], ['w11', 'w12', 'w13', 'w14', 'w15', 'w16'])

                # Invalid grid
                response = self.client.get('/api/grid/999')
                self.assertEqual(response.status_code, 404)
                self.assertEqual(response.get_json(), {'error': 'Grid not found'})

    def test_security_headers(self):
        response = self.client.get('/')
        self.assertEqual(response.headers['X-Content-Type-Options'], 'nosniff')
        self.assertEqual(response.headers['X-Frame-Options'], 'SAMEORIGIN')
        self.assertIn('Strict-Transport-Security', response.headers)
        self.assertIn('Content-Security-Policy', response.headers)

if __name__ == '__main__':
    unittest.main()
