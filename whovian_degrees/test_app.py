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
        response = client.post('/api/connect', json={'startActor': 'A', 'targetDoctor': 'B'})
        self.assertEqual(response.status_code, 500)
        self.assertIn('error', response.json)

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
                response = client.post('/api/connect', json={'startActor': 'Actor A', 'targetDoctor': 'Actor B'})
                self.assertEqual(response.status_code, 200)
                self.assertNotIn('error', response.json)

            response = client.post('/api/connect', json={'startActor': 'Actor A', 'targetDoctor': 'Actor B'})
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
                    'parts': [{'text': 'Tom Hanks was in Cloud Atlas with Jim Broadbent.'}]
                }
            }]
        }).encode('utf-8')
        mock_response.__enter__.return_value = mock_response
        mock_urlopen.return_value = mock_response

        client = whovian_app.app.test_client()
        response = client.post('/api/connect', json={
            'startActor': 'Tom Hanks',
            'targetDoctor': 'Jim Broadbent'
        })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json['connectionPath'], 'Tom Hanks was in Cloud Atlas with Jim Broadbent.')

    def test_connect_actors_too_long(self):
        whovian_app.IP_REQUESTS.clear()
        client = whovian_app.app.test_client()
        response = client.post('/api/connect', json={
            'startActor': 'A' * 101,
            'targetDoctor': 'David Tennant'
        })
        self.assertEqual(response.status_code, 400)
        self.assertIn('error', response.json)

if __name__ == '__main__':
    unittest.main()
