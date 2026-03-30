import unittest
from unittest.mock import patch
from app import app, load_questions

class TestGetStats(unittest.TestCase):
    def setUp(self):
        self.app = app.test_client()

    @patch('app.load_questions')
    def test_get_stats_success(self, mock_load):
        # Mocking load_questions to return a controlled list
        mock_load.return_value = {
            '1_A': {'id': '1_A', 'question': 'Q1', 'answer': 'A1', 'used': False},
            '1_B': {'id': '1_B', 'question': 'Q2', 'answer': 'A2', 'used': True},
            '2_A': {'id': '2_A', 'question': 'Q3', 'answer': 'A3', 'used': True}
        }

        response = self.app.get('/api/stats')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json['total'], 3)
        self.assertEqual(response.json['used'], 2)
        self.assertEqual(response.json['remaining'], 1)

    @patch('app.load_questions')
    def test_get_stats_empty(self, mock_load):
        # Mocking load_questions with no questions at all
        mock_load.return_value = {}

        response = self.app.get('/api/stats')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json['total'], 0)
        self.assertEqual(response.json['used'], 0)
        self.assertEqual(response.json['remaining'], 0)

    @patch('app.load_questions')
    def test_get_stats_all_used(self, mock_load):
        # Mocking load_questions where all are used
        mock_load.return_value = {
            '1_A': {'id': '1_A', 'question': 'Q1', 'answer': 'A1', 'used': True},
            '1_B': {'id': '1_B', 'question': 'Q2', 'answer': 'A2', 'used': True}
        }

        response = self.app.get('/api/stats')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json['total'], 2)
        self.assertEqual(response.json['used'], 2)
        self.assertEqual(response.json['remaining'], 0)

    @patch('app.load_questions')
    def test_get_stats_none_used(self, mock_load):
        # Mocking load_questions where none are used
        mock_load.return_value = {
            '1_A': {'id': '1_A', 'question': 'Q1', 'answer': 'A1', 'used': False},
            '1_B': {'id': '1_B', 'question': 'Q2', 'answer': 'A2', 'used': False}
        }

        response = self.app.get('/api/stats')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json['total'], 2)
        self.assertEqual(response.json['used'], 0)
        self.assertEqual(response.json['remaining'], 2)

if __name__ == '__main__':
    unittest.main()
