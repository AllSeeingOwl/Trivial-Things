import unittest
from unittest.mock import patch
from app import app, load_questions

class TestGetQuestion(unittest.TestCase):
    def setUp(self):
        self.app = app.test_client()

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

if __name__ == '__main__':
    unittest.main()
