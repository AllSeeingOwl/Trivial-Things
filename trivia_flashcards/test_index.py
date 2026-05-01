import unittest
from trivia_flashcards.trivia_flashcards_app import app

class TestIndex(unittest.TestCase):
    def setUp(self):
        app._raw_csv_cache = None
        app._questions_cache = None
        self.app = app.test_client()
        self.app.testing = True

    def test_index_route(self):
        """Test the index route to ensure it returns a 200 OK status code."""
        response = self.app.get('/')
        self.assertEqual(response.status_code, 200)

if __name__ == '__main__':
    unittest.main()
