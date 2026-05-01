import unittest
from unittest.mock import patch
from trivia_flashcards.trivia_flashcards_app import app

class TestApp(unittest.TestCase):
    def setUp(self):
        app._raw_csv_cache = None
        app._questions_cache = None
        self.app = app.test_client()

    def test_mark_used_invalid_id(self):
        response = self.app.post('/api/mark_used', json={"id": "invalid"})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json, {'error': 'Invalid question ID format'})

    def test_mark_used_missing_id(self):
        response = self.app.post('/api/mark_used', json={})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json, {'error': 'Missing question ID'})

    @patch('trivia_flashcards.trivia_flashcards_app.update_used_status')
    def test_mark_used_exception(self, mock_update_used_status):
        mock_update_used_status.side_effect = Exception("Mocked exception")
        response = self.app.post('/api/mark_used', json={"id": "valid_id"})
        self.assertEqual(response.status_code, 500)
        self.assertEqual(response.json, {'error': 'Failed to process request'})

if __name__ == '__main__':
    unittest.main()
