import json
import unittest
from unittest.mock import patch
from sliding_rows_flashcards.app import app

class TestMarkUsed(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()

    @patch('sliding_rows_flashcards.app.update_chain_used_status')
    def test_mark_used_exception(self, mock_update):
        # Mock the function to raise an exception, simulating an internal error
        mock_update.side_effect = Exception("Super secret internal database error")

        # Send a valid payload to reach the try/except block
        response = self.client.post('/api/mark_used',
                                    data=json.dumps({'chain_id': 'CHAIN_123'}),
                                    content_type='application/json')

        # Check that we get a 500 error
        self.assertEqual(response.status_code, 500)

        # Parse the response data
        data = json.loads(response.data.decode('utf-8'))

        # Check that the error message is generic
        self.assertEqual(data.get('error'), 'Failed to process request')

        # IMPORTANT: Check that details are NOT present
        self.assertNotIn('details', data)
        self.assertNotIn("Super secret internal database error", response.data.decode('utf-8'))

if __name__ == '__main__':
    unittest.main()
