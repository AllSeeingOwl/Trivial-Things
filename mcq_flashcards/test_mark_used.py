import unittest
from app import app
import json

class TestApp(unittest.TestCase):
    def setUp(self):
        self.app = app.test_client()

    def test_mark_used_invalid_id(self):
        response = self.app.post('/api/mark_used', json={"id": "invalid"})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json, {'error': 'Invalid question ID format'})

    def test_mark_used_missing_id(self):
        response = self.app.post('/api/mark_used', json={})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json, {'error': 'Missing question ID'})

if __name__ == '__main__':
    unittest.main()
