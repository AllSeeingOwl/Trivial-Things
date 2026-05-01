import unittest
from unittest.mock import patch
from mcq_flashcards.mcq_flashcards_app import app

class TestReset(unittest.TestCase):
    def setUp(self):
        app._raw_csv_cache = None
        app._questions_cache = None
        self.app = app.test_client()

    @patch('mcq_flashcards.mcq_flashcards_app.reset_all_questions')
    def test_reset_success(self, mock_reset):
        response = self.app.post('/api/reset')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json, {'success': True})
        mock_reset.assert_called_once()

if __name__ == '__main__':
    unittest.main()
