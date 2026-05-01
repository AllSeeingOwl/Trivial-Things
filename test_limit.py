from mcq_flashcards.mcq_flashcards_app import app as mcq_app
from trivia_flashcards.trivia_flashcards_app import app as trivia_app
from sliding_rows_flashcards.sliding_rows_flashcards_app import app as sliding_app
from where_in_the_world.where_in_the_world_app import app as world_app
import json
import unittest
import sys

# Mock Flask for testing without the actual flask package


from mcq_flashcards.mcq_flashcards_app import mark_used as mark_used_mcq
from trivia_flashcards.trivia_flashcards_app import mark_used as mark_used_trivia
from sliding_rows_flashcards.sliding_rows_flashcards_app import mark_used as mark_used_sliding
from where_in_the_world.where_in_the_world_app import calculate_score

class TestLimits(unittest.TestCase):
    def test_mcq_limit(self):
        client = mcq_app.test_client()
        response = client.post('/api/mark_used', json={'id': 'a'*51})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json['error'], 'Invalid question ID format')

    def test_trivia_limit(self):
        client = trivia_app.test_client()
        response = client.post('/api/mark_used', json={'id': 'a'*51})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json['error'], 'Invalid question ID format')

    def test_sliding_limit(self):
        client = sliding_app.test_client()
        response = client.post('/api/mark_used', json={'chain_id': 'a'*101})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json['error'], 'Invalid chain_id format')

    def test_where_limit(self):
        client = world_app.test_client()
        response = client.post('/api/score', json={'id': 'a'*101, 'lat': 0, 'lng': 0})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json['error'], 'Invalid target ID format')

if __name__ == '__main__':
    unittest.main()
