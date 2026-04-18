import unittest
from unittest.mock import patch, MagicMock
import json
import sys
import os

# Mock Flask because it's not installed in the environment
class MockFlask:
    def __init__(self, name):
        self.config = {}
        self.after_request_funcs = []

    def after_request(self, f):
        self.after_request_funcs.append(f)
        return f

    def route(self, rule, **options):
        def decorator(f):
            return f
        return decorator

    def run(self, **kwargs):
        pass

mock_flask_module = MagicMock()
mock_flask_module.Flask = MockFlask
mock_flask_module.jsonify = lambda d: d
mock_flask_module.request = MagicMock()
mock_flask_module.render_template = lambda t: t

sys.modules['flask'] = mock_flask_module

# Now import the app
import app as whovian_app

class TestWhovianBackend(unittest.TestCase):
    def setUp(self):
        whovian_app.app.config['DEBUG'] = True

    @patch('os.environ.get')
    @patch('urllib.request.urlopen')
    def test_connect_actors_success(self, mock_urlopen, mock_env_get):
        # Setup mocks
        mock_env_get.return_value = 'fake_api_key'

        mock_response = MagicMock()
        mock_response.read.return_value = json.dumps({
            'candidates': [{
                'content': {
                    'parts': [{'text': 'Tom Hanks was in Cloud Atlas with Jim Broadbent.'}]
                }
            }]
        }).encode('utf-8')
        mock_response.__enter__.return_value = mock_response
        mock_urlopen.return_value = mock_response

        # Mock request data
        whovian_app.request.json = {
            'startActor': 'Tom Hanks',
            'targetDoctor': 'Jim Broadbent'
        }

        # Call the function
        result = whovian_app.connect_actors()

        # Verify
        self.assertEqual(result['connectionPath'], 'Tom Hanks was in Cloud Atlas with Jim Broadbent.')
        mock_urlopen.assert_called_once()

        # Verify prompt includes the actors
        args, kwargs = mock_urlopen.call_args
        sent_data = json.loads(kwargs.get('data', args[0].data).decode('utf-8'))
        prompt = sent_data['contents'][0]['parts'][0]['text']
        self.assertIn('Tom Hanks', prompt)
        self.assertIn('Jim Broadbent', prompt)

    @patch('os.environ.get')
    def test_connect_actors_missing_key(self, mock_env_get):
        mock_env_get.return_value = None
        whovian_app.request.json = {'startActor': 'A', 'targetDoctor': 'B'}

        result = whovian_app.connect_actors()
        # In our implementation it returns (jsonify_dict, status_code) if it's an error
        # but since we mocked jsonify to just return the dict, let's see how it behaves
        # Actually our implementation returns: return jsonify({'error': ...}), 500
        # which becomes (dict, 500)
        self.assertIn('error', result[0])
        self.assertEqual(result[1], 500)

if __name__ == '__main__':
    unittest.main()
