import unittest
from unittest.mock import patch
from app import app, load_questions

class TestGetQuestion(unittest.TestCase):
    def setUp(self):
        self.app = app.test_client()
import app

class TestGetQuestion(unittest.TestCase):
    def setUp(self):
        self.app = app.app.test_client()

    @patch('app.load_questions')
    def test_get_question_success(self, mock_load):
        # Mocking load_questions to return a controlled list
        mock_load.return_value = [
            {'id': '1_A', 'question': 'Q1', 'answer': 'A1', 'used': False},
            {'id': '1_B', 'question': 'Q2', 'answer': 'A2', 'used': True}
        ]

        response = self.app.get('/api/question')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json['id'], '1_A')
        self.assertEqual(response.json['question'], 'Q1')
        self.assertIn('stats', response.json)
        self.assertEqual(response.json['stats']['total'], 2)
        self.assertEqual(response.json['stats']['used'], 1)
        self.assertEqual(response.json['stats']['remaining'], 1)

    @patch('app.load_questions')
    def test_get_question_no_unused(self, mock_load):
        # Mocking load_questions where all are used
        mock_load.return_value = [
            {'id': '1_A', 'question': 'Q1', 'answer': 'A1', 'used': True}
        ]

        response = self.app.get('/api/question')
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json['error'], 'No unused questions left!')

    @patch('app.load_questions')
    def test_get_question_empty_list(self, mock_load):
        # Mocking load_questions with no questions at all
        mock_load.return_value = []

        response = self.app.get('/api/question')
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json['error'], 'No unused questions left!')

    @patch('app.load_questions')
    @patch('app.random.choice')
    def test_get_question_multiple_unused(self, mock_choice, mock_load):
        # Mocking load_questions with multiple unused questions
        unused_q1 = {'id': '1_A', 'question': 'Q1', 'answer': 'A1', 'used': False}
        unused_q2 = {'id': '2_A', 'question': 'Q2', 'answer': 'A2', 'used': False}
        used_q = {'id': '1_B', 'question': 'Q3', 'answer': 'A3', 'used': True}

        mock_load.return_value = [unused_q1, unused_q2, used_q]

        # Make random.choice deterministic
        mock_choice.return_value = unused_q2

        response = self.app.get('/api/question')

        # Verify choice was called with the correct list of unused questions
        mock_choice.assert_called_once_with([unused_q1, unused_q2])

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json['id'], '2_A')
        self.assertEqual(response.json['question'], 'Q2')

if __name__ == '__main__':
    unittest.main()
