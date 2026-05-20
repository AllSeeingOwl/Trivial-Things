import unittest
from unittest.mock import patch, mock_open, MagicMock
import sys
import os

# Ensure the app directory is in sys.path
sys.path.append(os.path.dirname(__file__))

import sliding_rows_flashcards_app as app

class TestAppEndpoints(unittest.TestCase):
    def setUp(self):
        app._chains_cache = None
        app._raw_csv_cache = None
        self.client = app.app.test_client()

    def test_index_endpoint(self):
        response = self.client.get('/')
        self.assertEqual(response.status_code, 200)
        self.assertIn(b'<title>Sliding Rows Flashcards</title>', response.data)

    @patch('sliding_rows_flashcards_app.load_chains')
    def test_get_random_chain_endpoint(self, mock_load):
        mock_load.return_value = {
            'Chain_1': {
                'chain_id': 'Chain_1',
                'used': False,
                'questions': [
                    {'order': 1, 'question': 'Q1', 'answer': 'A1', 'used': False}
                ]
            }
        }

        response = self.client.get('/api/get_chain')
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertEqual(data['chain_id'], 'Chain_1')
        self.assertEqual(data['stats']['total'], 1)
        self.assertEqual(data['stats']['remaining'], 1)

    @patch('sliding_rows_flashcards_app.load_chains')
    def test_get_random_chain_none_left_endpoint(self, mock_load):
        mock_load.return_value = {
            'Chain_1': {'chain_id': 'Chain_1', 'used': True}
        }

        response = self.client.get('/api/get_chain')
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.get_json()['error'], 'No unused chains left!')

    @patch('sliding_rows_flashcards_app.update_chain_used_status')
    @patch('sliding_rows_flashcards_app.load_chains')
    def test_mark_used_endpoint(self, mock_load, mock_update):
        mock_load.return_value = {'Chain_1': {'chain_id': 'Chain_1', 'used': True}}

        payload = {'chain_id': 'Chain_1'}
        response = self.client.post('/api/mark_used', json=payload)

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.get_json()['success'])
        mock_update.assert_called_once_with('Chain_1', True)

    @patch('sliding_rows_flashcards_app.reset_all_chains')
    @patch('sliding_rows_flashcards_app.load_chains')
    def test_reset_endpoint(self, mock_load, mock_reset):
        mock_load.return_value = {'Chain_1': {'chain_id': 'Chain_1', 'used': False}}

        response = self.client.post('/api/reset')
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.get_json()['success'])
        mock_reset.assert_called_once()

    @patch('sliding_rows_flashcards_app.load_chains')
    def test_stats_endpoint(self, mock_load):
        mock_load.return_value = {
            'Chain_1': {'chain_id': 'Chain_1', 'used': True},
            'Chain_2': {'chain_id': 'Chain_2', 'used': False}
        }

        response = self.client.get('/api/stats')
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertEqual(data['total'], 2)
        self.assertEqual(data['used'], 1)
        self.assertEqual(data['remaining'], 1)

    @patch('sliding_rows_flashcards_app.get_db_connection')
    def test_load_chains_logic(self, mock_db):
        mock_conn = MagicMock()
        mock_conn.__enter__.return_value = mock_conn
        mock_conn.execute.return_value.fetchall.return_value = []
        mock_db.return_value = mock_conn

        csv_content = "Chain_ID,Order,Question,Answer,USED\nC1,1,Q1,A1,FALSE\n"
        with patch('os.path.exists', return_value=True):
            with patch('builtins.open', mock_open(read_data=csv_content)):
                chains = app.load_chains()
                self.assertIn('C1', chains)
                self.assertFalse(chains['C1']['used'])
                self.assertEqual(chains['C1']['questions'][0]['question'], 'Q1')

    @patch('sliding_rows_flashcards_app.get_db_connection')
    def test_load_chains_sorting(self, mock_db):
        mock_conn = MagicMock()
        mock_conn.__enter__.return_value = mock_conn
        mock_conn.execute.return_value.fetchall.return_value = []
        mock_db.return_value = mock_conn

        csv_content = "Chain_ID,Order,Question,Answer,USED\nC1,2,Q2,A2,FALSE\nC1,1,Q1,A1,FALSE\n"
        with patch('os.path.exists', return_value=True):
            with patch('builtins.open', mock_open(read_data=csv_content)):
                chains = app.load_chains()
                questions = chains['C1']['questions']
                self.assertEqual(questions[0]['order'], 1)
                self.assertEqual(questions[1]['order'], 2)

if __name__ == '__main__':
    unittest.main()
