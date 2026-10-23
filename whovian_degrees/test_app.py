import unittest
import json
from unittest.mock import patch, MagicMock

import whovian_degrees_app as whovian_app

class TestWhovianBackend(unittest.TestCase):
    def test_connect_actors_invalid_type(self):
        whovian_app.IP_REQUESTS.clear()
        client = whovian_app.app.test_client()
        response = client.post('/api/connect', json={
            'startActor': ['Not', 'A', 'String'],
            'targetDoctor': 'David Tennant'
        })
        self.assertEqual(response.status_code, 400)
        self.assertIn('error', response.json)

    @patch('os.environ.get')
    def test_connect_actors_missing_key(self, mock_env_get):
        mock_env_get.return_value = None
        whovian_app.IP_REQUESTS.clear()
        client = whovian_app.app.test_client()
        response = client.post('/api/connect', json={'startActor': 'Tom Hanks', 'targetDoctor': 'David Tennant'})
        self.assertEqual(response.status_code, 500)
        self.assertIn('error', response.json)

    def test_connect_actors_invalid_target_doctor(self):
        whovian_app.IP_REQUESTS.clear()
        client = whovian_app.app.test_client()
        response = client.post('/api/connect', json={
            'startActor': 'Tom Hanks',
            'targetDoctor': 'Not A Real Doctor'
        })
        self.assertEqual(response.status_code, 400)
        self.assertIn('error', response.json)
        self.assertEqual(response.json['error'], 'Invalid targetDoctor. Must be a valid Doctor Who actor')

    @patch('os.environ.get')
    def test_connect_actors_rate_limit(self, mock_env_get):
        mock_env_get.return_value = 'fake_api_key'
        whovian_app.IP_REQUESTS.clear()
        client = whovian_app.app.test_client()

        with patch('urllib.request.urlopen') as mock_urlopen:
            mock_response = MagicMock()
            mock_response.read.return_value = json.dumps({'candidates': [{'content': {'parts': [{'text': 'Path'}]}}]}).encode('utf-8')
            mock_response.__enter__.return_value = mock_response
            mock_urlopen.return_value = mock_response

            for _ in range(5):
                response = client.post('/api/connect', json={'startActor': 'Tom Hanks', 'targetDoctor': 'David Tennant'})
                self.assertEqual(response.status_code, 200)
                self.assertNotIn('error', response.json)

            response = client.post('/api/connect', json={'startActor': 'Tom Hanks', 'targetDoctor': 'David Tennant'})
            self.assertEqual(response.status_code, 429)
            self.assertEqual(response.json['error'], 'Rate limit exceeded. Please try again later.')

    @patch('os.environ.get')
    @patch('urllib.request.urlopen')
    def test_connect_actors_success(self, mock_urlopen, mock_env_get):
        mock_env_get.return_value = 'fake_api_key'
        whovian_app.IP_REQUESTS.clear()

        mock_response = MagicMock()
        mock_response.read.return_value = json.dumps({
            'candidates': [{
                'content': {
                    'parts': [{'text': 'Tom Hanks was in Cloud Atlas with David Tennant.'}]
                }
            }]
        }).encode('utf-8')
        mock_response.__enter__.return_value = mock_response
        mock_urlopen.return_value = mock_response

        client = whovian_app.app.test_client()
        response = client.post('/api/connect', json={
            'startActor': 'Tom Hanks',
            'targetDoctor': 'David Tennant'
        })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json['connectionPath'], 'Tom Hanks was in Cloud Atlas with David Tennant.')

        # Verify that API key is passed securely via x-goog-api-key header and not in query parameters
        req = mock_urlopen.call_args[0][0]
        self.assertEqual(req.get_header('X-goog-api-key'), 'fake_api_key')
        self.assertNotIn('key=', req.full_url)

    def test_connect_actors_too_long(self):
        whovian_app.IP_REQUESTS.clear()
        client = whovian_app.app.test_client()
        response = client.post('/api/connect', json={
            'startActor': 'A' * 101,
            'targetDoctor': 'David Tennant'
        })
        self.assertEqual(response.status_code, 400)
        self.assertIn('error', response.json)

    def test_security_headers(self):
        client = whovian_app.app.test_client()
        response = client.get('/')
        csp = response.headers.get('Content-Security-Policy', '')
        self.assertTrue(csp)
        self.assertNotIn("'unsafe-eval'", csp)
        self.assertIn("script-src 'self'", csp)

if __name__ == '__main__':
    unittest.main()
