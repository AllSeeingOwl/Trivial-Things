import unittest
from unittest.mock import patch
from mcq_flashcards.mcq_flashcards_app import app, load_questions

class TestGetQuestion(unittest.TestCase):
    def setUp(self):
        app._raw_csv_cache = None
        app._questions_cache = None
        self.app = app.test_client()

    @patch('mcq_flashcards.mcq_flashcards_app.load_questions')
    def test_get_question_success(self, mock_load):
        # Mocking load_questions to return a controlled list
        mock_load.return_value = {
            '1': {'id': '1', 'question': 'Q1', 'answer': 'A1', 'choices': ['A1', 'W1', 'W2', 'W3'], 'used': False},
            '2': {'id': '2', 'question': 'Q2', 'answer': 'A2', 'choices': ['A2', 'W4', 'W5', 'W6'], 'used': True}
        }

        response = self.app.get('/api/question')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json['id'], '1')
        self.assertEqual(response.json['question'], 'Q1')
        self.assertTrue('A1' in response.json['choices'])
        self.assertIn('stats', response.json)
        self.assertEqual(response.json['stats']['total'], 2)
        self.assertEqual(response.json['stats']['used'], 1)
        self.assertEqual(response.json['stats']['remaining'], 1)

    @patch('mcq_flashcards.mcq_flashcards_app.load_questions')
    def test_get_question_no_unused(self, mock_load):
        # Mocking load_questions where all are used
        mock_load.return_value = {
            '1': {'id': '1_A', 'question': 'Q1', 'answer': 'A1', 'used': True}
        }

        response = self.app.get('/api/question')
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json['error'], 'No unused questions left!')

    @patch('mcq_flashcards.mcq_flashcards_app.load_questions')
    def test_get_question_empty_list(self, mock_load):
        # Mocking load_questions with no questions at all
        mock_load.return_value = {}

        response = self.app.get('/api/question')
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json['error'], 'No unused questions left!')

if __name__ == '__main__':
    unittest.main()
