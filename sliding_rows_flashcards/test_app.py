import unittest
from unittest.mock import patch, mock_open, MagicMock
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

    def _simulate_request(self, path, method, data=None, content_type=None):
        if path not in self.app.routes:
            return MockResponse({'error': 'Not Found'}, 404)

        handler, methods = self.app.routes[path]
        if method not in methods:
            return MockResponse({'error': 'Method Not Allowed'}, 405)

        # Mocking the global request object behavior if needed
        with patch('app.request') as mock_req:
            if data:
                mock_req.json = json.loads(data) if isinstance(data, str) else data
            else:
                mock_req.json = None

            # Call the handler
            result = handler()

            # Handle Flask return types (tuple or response object)
            if isinstance(result, tuple):
                body, status = result
                return MockResponse(body, status)
            return MockResponse(result, 200)

    def get(self, path):
        return self._simulate_request(path, 'GET')

    def post(self, path, data=None, content_type=None):
        return self._simulate_request(path, 'POST', data, content_type)

class MockResponse:
    def __init__(self, data, status_code):
        self.status_code = status_code
        self._data = data

    def get_json(self):
        return self._data

    @property
    def data(self):
        # To simulate response.data.decode()
        if isinstance(self._data, str):
            return self._data.encode()
        return json.dumps(self._data).encode()

# Setup the mocks BEFORE importing app
mock_flask_module = MagicMock()
mock_flask_module.Flask = MockFlask
mock_flask_module.jsonify = lambda x: x
mock_flask_module.render_template = lambda x: f"Rendered {x}"
sys.modules['flask'] = mock_flask_module

import app

class TestAppEndpoints(unittest.TestCase):
    def setUp(self):
        app._chains_cache = None
        app._raw_csv_cache = None
        self.client = app.app.test_client()

    def test_index_endpoint(self):
        response = self.client.get('/')
        self.assertEqual(response.status_code, 200)
        self.assertIn(b"Rendered index.html", response.data)

    @patch('app.load_chains')
    def test_get_random_chain_endpoint(self, mock_load):
        mock_load.return_value = {
            'Chain_1': {
                'chain_id': 'Chain_1',
                'used': False,
                'questions': [
                    {'order': 1, 'question': 'Q1', 'answer': 'A1', 'used': False}
                ]
            }
        }

        response = self.client.get('/api/get_chain')
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertEqual(data['chain_id'], 'Chain_1')
        self.assertEqual(data['stats']['total'], 1)
        self.assertEqual(data['stats']['remaining'], 1)

    @patch('app.load_chains')
    def test_get_random_chain_none_left_endpoint(self, mock_load):
        mock_load.return_value = {
            'Chain_1': {'chain_id': 'Chain_1', 'used': True}
        }

        response = self.client.get('/api/get_chain')
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.get_json()['error'], 'No unused chains left!')

    @patch('app.update_chain_used_status')
    @patch('app.load_chains')
    def test_mark_used_endpoint(self, mock_load, mock_update):
        mock_load.return_value = {'Chain_1': {'chain_id': 'Chain_1', 'used': True}}

        payload = {'chain_id': 'Chain_1'}
        response = self.client.post('/api/mark_used', data=json.dumps(payload))

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.get_json()['success'])
        mock_update.assert_called_once_with('Chain_1', True)

    @patch('app.reset_all_chains')
    @patch('app.load_chains')
    def test_reset_endpoint(self, mock_load, mock_reset):
        mock_load.return_value = {'Chain_1': {'chain_id': 'Chain_1', 'used': False}}

        response = self.client.post('/api/reset')
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.get_json()['success'])
        mock_reset.assert_called_once()

    @patch('app.load_chains')
    def test_stats_endpoint(self, mock_load):
        mock_load.return_value = {
            'Chain_1': {'chain_id': 'Chain_1', 'used': True},
            'Chain_2': {'chain_id': 'Chain_2', 'used': False}
        }

        response = self.client.get('/api/stats')
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertEqual(data['total'], 2)
        self.assertEqual(data['used'], 1)
        self.assertEqual(data['remaining'], 1)

    def test_load_chains_logic(self):
        csv_content = "Chain_ID,Order,Question,Answer,USED\nC1,1,Q1,A1,FALSE\n"
        with patch('os.path.exists', return_value=True):
            with patch('builtins.open', mock_open(read_data=csv_content)):
                chains = app.load_chains()
                self.assertIn('C1', chains)
                self.assertFalse(chains['C1']['used'])
                self.assertEqual(chains['C1']['questions'][0]['question'], 'Q1')

    def test_load_chains_sorting(self):
        csv_content = "Chain_ID,Order,Question,Answer,USED\nC1,2,Q2,A2,FALSE\nC1,1,Q1,A1,FALSE\n"
        with patch('os.path.exists', return_value=True):
            with patch('builtins.open', mock_open(read_data=csv_content)):
                chains = app.load_chains()
                questions = chains['C1']['questions']
                self.assertEqual(questions[0]['order'], 1)
                self.assertEqual(questions[1]['order'], 2)

if __name__ == '__main__':
    unittest.main()
