import os
import unittest
import tempfile
from quarterly_calendar_app import app, db

class QuarterlyCalendarTestCase(unittest.TestCase):
    def setUp(self):
        self.db_fd, self.db_path = tempfile.mkstemp()
        app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{self.db_path}'
        app.config['TESTING'] = True
        self.client = app.test_client()

        with app.app_context():
            db.create_all()

    def tearDown(self):
        os.close(self.db_fd)
        os.unlink(self.db_path)

    def test_security_headers(self):
        response = self.client.get('/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers.get('X-Content-Type-Options'), 'nosniff')
        self.assertEqual(response.headers.get('X-Frame-Options'), 'SAMEORIGIN')
        self.assertIn('Content-Security-Policy', response.headers)
        self.assertIn("default-src 'self'", response.headers['Content-Security-Policy'])

    def test_create_event_valid(self):
        payload = {
            'title': 'Team Offsite',
            'start_date': '2026-05-01',
            'end_date': '2026-05-03',
            'category': 'Corporate',
            'is_tentative': False
        }
        response = self.client.post('/api/events', json=payload)
        self.assertEqual(response.status_code, 201)
        data = response.get_json()
        self.assertEqual(data['title'], 'Team Offsite')

    def test_create_event_invalid_json(self):
        response = self.client.post('/api/events', data="not json", content_type='application/json')
        self.assertEqual(response.status_code, 400)

    def test_create_event_non_dict_json(self):
        response = self.client.post('/api/events', json=[1, 2, 3])
        self.assertEqual(response.status_code, 400)

    def test_create_event_title_length_exceeded(self):
        payload = {
            'title': 'A' * 101,
            'start_date': '2026-05-01',
            'end_date': '2026-05-03',
            'category': 'Corporate'
        }
        response = self.client.post('/api/events', json=payload)
        self.assertEqual(response.status_code, 400)

    def test_create_event_date_length_exceeded(self):
        payload = {
            'title': 'Team Offsite',
            'start_date': '2026-05-01' + '0' * 20,
            'end_date': '2026-05-03',
            'category': 'Corporate'
        }
        response = self.client.post('/api/events', json=payload)
        self.assertEqual(response.status_code, 400)

if __name__ == '__main__':
    unittest.main()
