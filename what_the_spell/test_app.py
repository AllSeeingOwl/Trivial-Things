import unittest
from unittest.mock import patch, mock_open, MagicMock
import sys
import os
import json
import re

# Ensure the app directory is in sys.path
sys.path.append(os.path.dirname(__file__))

# Generic Mock Flask and related classes to allow testing without the flask package

# Test regex conversion before importing app
def test_regex():
    rule = '/api/grid/<int:grid_idx>'
    regex_rule = rule
    regex_rule = re.sub(r'<int:(\w+)>', r'@@@\1@@@', regex_rule)
    regex_rule = re.sub(r'<(\w+)>', r'###\1###', regex_rule)
    regex_rule = regex_rule.replace('.', '\\.')
    regex_rule = re.sub(r'@@@(\w+)@@@', r'(?P<\1>\\d+)', regex_rule)
    regex_rule = re.sub(r'###(\w+)###', r'(?P<\1>[^/]+)', regex_rule)
    regex_rule = '^' + regex_rule + '$'
    print(f"Rule: {rule} -> Regex: {regex_rule}")
    pattern = re.compile(regex_rule)
    match = pattern.match('/api/grid/123')
    assert match is not None
    assert match.group('grid_idx') == '123'

if __name__ == '__main__':
    try:
        test_regex()
        print("Regex test passed")
    except Exception as e:
        print(f"Regex test failed: {e}")
        sys.exit(1)

import what_the_spell_app as app

class TestWhatTheSpell(unittest.TestCase):
    def setUp(self):
        self.client = app.app.test_client()
        app._cache_grids = None
        app._cache_pool = None

    def test_load_data_no_file(self):
        with patch('os.path.exists', return_value=False):
            grids, pool = app.load_data()
            self.assertEqual(grids, [])
            self.assertEqual(pool, [])

    def test_load_data_parsing(self):
        csv_content = "1,2,3,4,5,6,\n"
        for i in range(1, 11):
            csv_content += f"w{i}1,w{i}2,w{i}3,w{i}4,w{i}5,w{i}6,{i}\n"
        csv_content += "pool1,,,,\n"
        csv_content += "pool2,,,,\n"

        with patch('os.path.exists', return_value=True):
            with patch('builtins.open', mock_open(read_data=csv_content)):
                grids, pool = app.load_data()
                self.assertEqual(len(grids), 1)
                self.assertEqual(len(grids[0]), 10)
                self.assertEqual(grids[0][0], ['w11', 'w12', 'w13', 'w14', 'w15', 'w16'])
                self.assertEqual(pool, ['pool1', 'pool2'])

    def test_index_route(self):
        csv_content = "1,2,3,4,5,6,\n"
        for i in range(1, 11):
            csv_content += f"w{i}1,w{i}2,w{i}3,w{i}4,w{i}5,w{i}6,{i}\n"

        with patch('os.path.exists', return_value=True):
            with patch('builtins.open', mock_open(read_data=csv_content)):
                response = self.client.get('/')
                self.assertEqual(response.status_code, 200)
                self.assertIn('w11', response.data.decode())

    def test_get_grid_api(self):
        csv_content = "1,2,3,4,5,6,\n"
        for i in range(1, 11):
            csv_content += f"w{i}1,w{i}2,w{i}3,w{i}4,w{i}5,w{i}6,{i}\n"

        with patch('os.path.exists', return_value=True):
            with patch('builtins.open', mock_open(read_data=csv_content)):
                # Valid grid
                response = self.client.get('/api/grid/0')
                self.assertEqual(response.status_code, 200)
                data = response.get_json()
                self.assertIn('grid', data)
                self.assertEqual(len(data['grid']), 10)
                self.assertEqual(data['grid'][0], ['w11', 'w12', 'w13', 'w14', 'w15', 'w16'])

                # Invalid grid
                response = self.client.get('/api/grid/999')
                self.assertEqual(response.status_code, 404)
                self.assertEqual(response.get_json(), {'error': 'Grid not found'})

    def test_security_headers(self):
        response = self.client.get('/')
        self.assertEqual(response.headers['X-Content-Type-Options'], 'nosniff')
        self.assertEqual(response.headers['X-Frame-Options'], 'SAMEORIGIN')
        self.assertIn('Strict-Transport-Security', response.headers)
        self.assertIn('Content-Security-Policy', response.headers)

if __name__ == '__main__':
    unittest.main()
