import json
import unittest
import sys

# Mock Flask for testing without the actual flask package
class MockRequest:
    def __init__(self, data):
        self.json = data

class MockResponse:
    def __init__(self, data, status_code):
        self.data = data
        self.status_code = status_code
        self._json_data = data

    @property
    def json(self):
        return self._json_data

class MockFlask:
    def __init__(self, name):
        self.name = name
        self.routes = {}
        self.config = {}

    def route(self, path, methods=None):
        def decorator(func):
            self.routes[path] = func
            return func
        return decorator

    def after_request(self, func):
        return func

    def run(self, **kwargs):
        pass

def mock_jsonify(*args, **kwargs):
    if args:
        return MockResponse(args[0], 200)
    return MockResponse(kwargs, 200)

class RequestMock:
    def __init__(self):
        self.json = {}

mock_flask = type('module', (), {})()
mock_flask.Flask = MockFlask
mock_flask.jsonify = mock_jsonify
mock_flask.request = RequestMock()
mock_flask.render_template = lambda *a, **k: ""

sys.modules['flask'] = mock_flask

from mcq_flashcards.app import mark_used as mark_used_mcq
from trivia_flashcards.app import mark_used as mark_used_trivia
from sliding_rows_flashcards.app import mark_used as mark_used_sliding
from where_in_the_world.app import calculate_score

class TestLimits(unittest.TestCase):
    def test_mcq_limit(self):
        mock_flask.request.json = {'id': 'a' * 51}
        response, status = mark_used_mcq()
        self.assertEqual(status, 400)
        self.assertEqual(response.json['error'], 'Invalid question ID format')

    def test_trivia_limit(self):
        mock_flask.request.json = {'id': '1_A' + 'a' * 50}
        response, status = mark_used_trivia()
        self.assertEqual(status, 400)
        self.assertEqual(response.json['error'], 'Invalid question ID format')

    def test_sliding_limit(self):
        mock_flask.request.json = {'chain_id': 'a' * 101}
        response, status = mark_used_sliding()
        self.assertEqual(status, 400)
        self.assertEqual(response.json['error'], 'Invalid chain_id format')

    def test_where_limit(self):
        mock_flask.request.json = {'lat': 1.0, 'lng': 1.0, 'id': 'a' * 101}
        response, status = calculate_score()
        self.assertEqual(status, 400)
        self.assertEqual(response.json['error'], 'Invalid target ID format')

if __name__ == '__main__':
    unittest.main()
