import os
import unittest
import sqlite3
import tempfile
import sys
from unittest.mock import MagicMock

# Mock flask before importing app code
mock_flask = MagicMock()
app = mock_flask.Flask.return_value
app.route = lambda *a, **k: lambda f: f
app.after_request = lambda f: f
sys.modules['flask'] = mock_flask

# Pre-set environment variable
db_fd, db_path = tempfile.mkstemp()
os.close(db_fd)
os.environ['DB_FILE'] = db_path

# Import after setting DB_FILE and mocking flask
from mcq_flashcards.mcq_flashcards_app import init_db

class TestDBInit(unittest.TestCase):
    def setUp(self):
        if os.path.exists(db_path):
            os.remove(db_path)

    def tearDown(self):
        if os.path.exists(db_path):
            os.remove(db_path)

    def test_init_db_creates_table(self):
        init_db()

        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        # Check if table exists
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='question_state'")
        table = cursor.fetchone()
        self.assertIsNotNone(table, "Table 'question_state' should exist")

        # Check columns
        cursor.execute("PRAGMA table_info(question_state)")
        columns = cursor.fetchall()

        column_info = {col[1]: {'type': col[2], 'notnull': col[3], 'pk': col[5]} for col in columns}

        self.assertIn('id', column_info)
        self.assertEqual(column_info['id']['type'], 'TEXT')
        self.assertEqual(column_info['id']['pk'], 1)

        self.assertIn('used', column_info)
        self.assertEqual(column_info['used']['type'], 'BOOLEAN')
        self.assertEqual(column_info['used']['notnull'], 1)

        conn.close()

if __name__ == '__main__':
    unittest.main()
