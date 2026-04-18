import unittest
from unittest.mock import patch, MagicMock
import sys
import os
import json

# Define a mock Flask and other necessary classes to simulate the environment
# since flask and pymupdf are not installed.
class MockFile:
    def __init__(self, filename):
        self.filename = filename
    def save(self, path):
        pass

class MockFlask:
    def __init__(self, name):
        self.config = {
            'UPLOAD_FOLDER': 'uploads',
            'MAX_CONTENT_LENGTH': 16 * 1024 * 1024
        }
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

    def run(self, **kwargs):
        pass

class MockClient:
    def __init__(self, app):
        self.app = app

    def _simulate_request(self, path, method, files=None):
        if path not in self.app.routes:
            return MockResponse({'error': 'Not Found'}, 404)

        handler, methods = self.app.routes[path]
        if method not in methods:
            return MockResponse({'error': 'Method Not Allowed'}, 405)

        with patch('app.request') as mock_req:
            mock_req.files = files or {}

            # Call the handler
            result = handler()

            if isinstance(result, tuple):
                body, status = result
                return MockResponse(body, status)
            return MockResponse(result, 200)

    def get(self, path):
        return self._simulate_request(path, 'GET')

    def post(self, path, files=None):
        return self._simulate_request(path, 'POST', files=files)

class MockResponse:
    def __init__(self, data, status_code):
        self.status_code = status_code
        self._data = data

    def get_json(self):
        return self._data

    @property
    def json(self):
        """Matches Flask's response.json property behavior."""
        return self._data

    @property
    def data(self):
        if isinstance(self._data, str):
            return self._data.encode()
        return json.dumps(self._data).encode()

# Setup mocks in sys.modules BEFORE importing the app
mock_flask = MagicMock()
mock_flask.Flask = MockFlask
mock_flask.jsonify = lambda x: x
mock_flask.render_template = lambda x: f"Rendered {x}"
sys.modules['flask'] = mock_flask

mock_fitz = MagicMock()
sys.modules['fitz'] = mock_fitz

mock_werkzeug = MagicMock()
mock_werkzeug.utils.secure_filename = lambda x: x
sys.modules['werkzeug'] = mock_werkzeug
sys.modules['werkzeug.utils'] = mock_werkzeug.utils

# Import app from the local directory
sys.path.append(os.path.dirname(__file__))
import app

class TestApp(unittest.TestCase):
    def setUp(self):
        self.client = app.app.test_client()

    def test_upload_no_file_part(self):
        response = self.client.post('/api/upload', files={})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json['error'], 'No file part')

    def test_upload_empty_filename(self):
        files = {'file': MockFile('')}
        response = self.client.post('/api/upload', files=files)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json['error'], 'No selected file')

    def test_upload_non_pdf(self):
        """Verify that uploading a non-PDF file (.txt) returns a 400 error."""
        files = {'file': MockFile('test.txt')}
        response = self.client.post('/api/upload', files=files)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json['error'], 'Invalid file type. Please upload a PDF.')

    def test_upload_non_pdf_png(self):
        """Verify that uploading a non-PDF file (.png) returns a 400 error."""
        files = {'file': MockFile('image.png')}
        response = self.client.post('/api/upload', files=files)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json['error'], 'Invalid file type. Please upload a PDF.')

    @patch('app.parse_pdf')
    @patch('os.path.exists', return_value=True)
    @patch('os.remove')
    def test_upload_pdf_success(self, mock_remove, mock_exists, mock_parse):
        """Verify successful PDF upload path with mocked PDF parsing."""
        mock_parse.return_value = [[{'text': 'test', 'status': 'correct'}]]
        files = {'file': MockFile('test.pdf')}
        response = self.client.post('/api/upload', files=files)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json['grid'], mock_parse.return_value)

    @patch('app.parse_pdf')
    @patch('os.path.exists', return_value=True)
    @patch('os.remove')
    def test_upload_pdf_processing_error(self, mock_remove, mock_exists, mock_parse):
        """Verify that an exception during PDF processing returns a 500 error."""
        mock_parse.side_effect = Exception("Parsing failed")
        files = {'file': MockFile('test.pdf')}
        response = self.client.post('/api/upload', files=files)
        self.assertEqual(response.status_code, 500)
        self.assertEqual(response.json['error'], 'An error occurred while processing the file.')

if __name__ == '__main__':
    unittest.main()
