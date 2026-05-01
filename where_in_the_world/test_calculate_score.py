import unittest
from unittest.mock import patch, MagicMock
import sys
import os
import json

sys.path.append(os.path.dirname(__file__))

import where_in_the_world_app as app

class TestCalculateScore(unittest.TestCase):
    def setUp(self):
        self.client = app.app.test_client()

    def test_missing_body(self):
        response = self.client.post('/api/score', json={})
        self.assertEqual(response.status_code, 400)

    def test_non_dict_body(self):
        response = self.client.post('/api/score', json=["not", "a", "dict"])
        self.assertEqual(response.status_code, 400)

    def test_invalid_target_id_type(self):
        payload = {'lat': 51.605582, 'lng': -0.068164, 'id': 0}
        response = self.client.post('/api/score', json=payload)
        self.assertEqual(response.status_code, 400)

    def test_non_numeric_coordinates(self):
        payload = {'lat': "51.605582", 'lng': -0.068164, 'id': "0"}
        response = self.client.post('/api/score', json=payload)
        self.assertEqual(response.status_code, 400)

    def test_successful_calculation(self):
        original_questions = app.QUESTIONS
        original_questions_by_id = app.QUESTIONS_BY_ID
        app.QUESTIONS = [
            {
                'id': "0",
                'prompt': 'A specific location',
                'lat': 51.605582,
                'lng': -0.068164,
                'target': 'Some Place', 'place': 'L1'
            }
        ]
        app.QUESTIONS_BY_ID = {"0": app.QUESTIONS[0]}

        payload = {'lat': 51.605582, 'lng': -0.068164, 'id': "0"}
        response = self.client.post('/api/score', json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertIn('score', data)
        self.assertIn('distance_miles', data)


        app.QUESTIONS = original_questions
        app.QUESTIONS_BY_ID = original_questions_by_id

    def test_target_not_found(self):
        original_questions = app.QUESTIONS
        original_questions_by_id = app.QUESTIONS_BY_ID
        app.QUESTIONS = []
        app.QUESTIONS_BY_ID = {}
        payload = {'lat': 51.605582, 'lng': -0.068164, 'id': "999"}
        response = self.client.post('/api/score', json=payload)
        self.assertEqual(response.status_code, 404)
        app.QUESTIONS = original_questions
        app.QUESTIONS_BY_ID = original_questions_by_id

if __name__ == '__main__':
    unittest.main()
