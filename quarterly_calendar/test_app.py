import os
import unittest
import tempfile

# Set DB_FILE environment variable before importing app to ensure
# SQLAlchemy initializes using the temporary test database path.
test_db_dir = tempfile.mkdtemp()
db_path = os.path.join(test_db_dir, 'test.db')
os.environ['DB_FILE'] = db_path

from quarterly_calendar_app import app, db

class QuarterlyCalendarTestCase(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        app.config['TESTING'] = True
        with app.app_context():
            db.create_all()

    @classmethod
    def tearDownClass(cls):
        with app.app_context():
            db.session.remove()
            db.drop_all()
        if os.path.exists(db_path):
            os.unlink(db_path)
        if os.path.exists(test_db_dir):
            os.rmdir(test_db_dir)

    def setUp(self):
        self.client = app.test_client()

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
