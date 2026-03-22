import unittest
from unittest.mock import patch
from app import app

class TestGetStats(unittest.TestCase):
    def setUp(self):
        self.app = app.test_client()

    @patch('app.load_questions')
    def test_get_stats_success(self, mock_load):
        # Mocking load_questions to return a controlled list
        mock_load.return_value = [
            {'id': '1', 'question': 'Q1', 'answer': 'A1', 'choices': ['A1', 'W1', 'W2', 'W3'], 'used': False},
            {'id': '2', 'question': 'Q2', 'answer': 'A2', 'choices': ['A2', 'W4', 'W5', 'W6'], 'used': True},
            {'id': '3', 'question': 'Q3', 'answer': 'A3', 'choices': ['A3', 'W7', 'W8', 'W9'], 'used': True}
        ]

        response = self.app.get('/api/stats')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json['total'], 3)
        self.assertEqual(response.json['used'], 2)
        self.assertEqual(response.json['remaining'], 1)

    @patch('app.load_questions')
    def test_get_stats_empty(self, mock_load):
        # Mocking load_questions with no questions at all
        mock_load.return_value = []

        response = self.app.get('/api/stats')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json['total'], 0)
        self.assertEqual(response.json['used'], 0)
        self.assertEqual(response.json['remaining'], 0)

    @patch('app.load_questions')
    def test_get_stats_all_used(self, mock_load):
        # Mocking load_questions where all are used
        mock_load.return_value = [
            {'id': '1', 'question': 'Q1', 'answer': 'A1', 'choices': ['A1', 'W1', 'W2', 'W3'], 'used': True},
            {'id': '2', 'question': 'Q2', 'answer': 'A2', 'choices': ['A2', 'W4', 'W5', 'W6'], 'used': True}
        ]

        response = self.app.get('/api/stats')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json['total'], 2)
        self.assertEqual(response.json['used'], 2)
        self.assertEqual(response.json['remaining'], 0)

    @patch('app.load_questions')
    def test_get_stats_none_used(self, mock_load):
        # Mocking load_questions where none are used
        mock_load.return_value = [
            {'id': '1', 'question': 'Q1', 'answer': 'A1', 'choices': ['A1', 'W1', 'W2', 'W3'], 'used': False},
            {'id': '2', 'question': 'Q2', 'answer': 'A2', 'choices': ['A2', 'W4', 'W5', 'W6'], 'used': False}
        ]

        response = self.app.get('/api/stats')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json['total'], 2)
        self.assertEqual(response.json['used'], 0)
        self.assertEqual(response.json['remaining'], 2)

if __name__ == '__main__':
    unittest.main()
