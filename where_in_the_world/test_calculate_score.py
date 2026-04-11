import unittest
from unittest.mock import patch, MagicMock
import sys
import os
import json

# Ensure the app directory is in sys.path
sys.path.append(os.path.dirname(__file__))

# Define a mock Flask and other necessary classes
class MockFlask:
    def __init__(self, name):
        self.config = {}
        self.routes = {}

    def after_request(self, f):
        return f

    def route(self, rule, **options):
        def decorator(f):
            self.routes[rule] = (f, options.get('methods', ['GET']))
            return f
        return decorator

    def test_client(self):
        return MockClient(self)

class MockClient:
    def __init__(self, app):
        self.app = app

    def _simulate_request(self, path, method, json_data=None):
        if path not in self.app.routes:
            return MockResponse({'error': 'Not Found'}, 404)

        handler, methods = self.app.routes[path]
        if method not in methods:
            return MockResponse({'error': 'Method Not Allowed'}, 405)

        # Mocking the global request object behavior if needed
        with patch('app.request') as mock_req:
            mock_req.json = json_data

            # Call the handler
            result = handler()

            # Handle Flask return types (tuple or response object)
            if isinstance(result, tuple):
                body, status = result
                return MockResponse(body, status)
            return MockResponse(result, 200)

    def get(self, path):
        return self._simulate_request(path, 'GET')

    def post(self, path, json=None):
        return self._simulate_request(path, 'POST', json_data=json)

class MockResponse:
    def __init__(self, data, status_code):
        self.status_code = status_code
        self._data = data

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
mock_flask_module.render_template = lambda x: f"Rendered {x}"
mock_flask_module.request = MagicMock()
sys.modules['flask'] = mock_flask_module

import app

class TestCalculateScore(unittest.TestCase):
    def setUp(self):
        self.client = app.app.test_client()

    def test_missing_body(self):
        # Test for missing request body (None)
        response = self.client.post('/api/score', json=None)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.get_json(), {'error': 'Invalid or missing request body'})

    def test_non_dict_body(self):
        # Test for non-dict request body (e.g., a list)
        response = self.client.post('/api/score', json=["not", "a", "dict"])
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.get_json(), {'error': 'Invalid or missing request body'})

    def test_invalid_target_id_type(self):
        # Test for non-string id (e.g., an integer)
        payload = {'lat': 51.605582, 'lng': -0.068164, 'id': 0}
        response = self.client.post('/api/score', json=payload)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.get_json(), {'error': 'Invalid target ID format'})

    def test_non_numeric_coordinates(self):
        # Test for non-numeric coordinates (e.g., strings)
        payload = {'lat': "51.605582", 'lng': -0.068164, 'id': "0"}
        response = self.client.post('/api/score', json=payload)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.get_json(), {'error': 'Coordinates must be numbers'})

    def test_target_not_found(self):
        # Test for non-existent id
        payload = {'lat': 51.605582, 'lng': -0.068164, 'id': "non-existent"}
        response = self.client.post('/api/score', json=payload)
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.get_json(), {'error': 'Target not found'})

    def test_successful_calculation(self):
        # Test for successful score calculation using ID "0"
        # From CSV head: 51.605582, -0.068164
        payload = {'lat': 51.605582, 'lng': -0.068164, 'id': "0"}
        response = self.client.post('/api/score', json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertIn('distance_miles', data)
        self.assertIn('score', data)
        self.assertEqual(data['score'], 10) # Exact match should be 10

if __name__ == '__main__':
    unittest.main()
