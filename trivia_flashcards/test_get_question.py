import unittest
from unittest.mock import patch
from trivia_flashcards.trivia_flashcards_app import app

class TestGetQuestion(unittest.TestCase):
    def setUp(self):
        app._raw_csv_cache = None
        app._questions_cache = None
        self.app = app.test_client()

    @patch('trivia_flashcards.trivia_flashcards_app.load_questions')
    def test_get_question_success(self, mock_load):
        # Mocking load_questions to return a controlled list
        mock_load.return_value = {
            '1_A': {'id': '1_A', 'question': 'Q1', 'answer': 'A1', 'used': False},
            '1_B': {'id': '1_B', 'question': 'Q2', 'answer': 'A2', 'used': True}
        }

        response = self.app.get('/api/question')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json['id'], '1_A')
        self.assertEqual(response.json['question'], 'Q1')
        self.assertEqual(response.json['answer'], 'A1')
        self.assertIn('stats', response.json)
        self.assertEqual(response.json['stats']['total'], 2)
        self.assertEqual(response.json['stats']['used'], 1)
        self.assertEqual(response.json['stats']['remaining'], 1)

    @patch('trivia_flashcards.trivia_flashcards_app.load_questions')
    def test_get_question_multiple_unused(self, mock_load):
        # Mocking load_questions to return multiple unused questions
        mock_load.return_value = {
            '1_A': {'id': '1_A', 'question': 'Q1', 'answer': 'A1', 'used': False},
            '1_B': {'id': '1_B', 'question': 'Q2', 'answer': 'A2', 'used': False}
        }

        # Ensure random choice works
        response = self.app.get('/api/question')
        self.assertEqual(response.status_code, 200)
        self.assertIn(response.json['id'], ['1_A', '1_B'])

    @patch('trivia_flashcards.trivia_flashcards_app.load_questions')
    def test_get_question_no_unused(self, mock_load):
        # Mocking load_questions where all are used
        mock_load.return_value = {
            '1_A': {'id': '1_A', 'question': 'Q1', 'answer': 'A1', 'used': True},
            '1_B': {'id': '1_B', 'question': 'Q2', 'answer': 'A2', 'used': True}
        }

        response = self.app.get('/api/question')
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json['error'], 'No unused questions left!')

    @patch('trivia_flashcards.trivia_flashcards_app.load_questions')
    def test_get_question_empty_list(self, mock_load):
        # Mocking load_questions with no questions at all
        mock_load.return_value = {}

        response = self.app.get('/api/question')
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json['error'], 'No unused questions left!')

if __name__ == '__main__':
    unittest.main()
