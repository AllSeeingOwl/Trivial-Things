import unittest
from flask import json
from periodic_name.periodic_name_app import app, find_elements_in_name

class PeriodicNameTestCase(unittest.TestCase):
    def setUp(self):
        self.app = app.test_client()
        self.app.testing = True

    def test_find_elements_in_name_empty(self):
        self.assertEqual(find_elements_in_name(""), [])
        self.assertEqual(find_elements_in_name(None), [])

    def test_find_elements_in_name_no_match(self):
        # 'J' is not an element, 'Q' is not an element. "Jqq" should have no matches.
        self.assertEqual(find_elements_in_name("Jqq"), [])

    def test_find_elements_in_name_match(self):
        # Alice should contain Al, Li, I, C, Ce
        # Let's just check that 'Al' and 'Ce' are in there
        elements = find_elements_in_name("Alice")
        symbols = [el['symbol'] for el in elements]

        self.assertIn("Al", symbols)
        self.assertIn("Li", symbols)
        self.assertIn("I", symbols)
        self.assertIn("C", symbols)
        self.assertIn("Ce", symbols)

    def test_find_elements_in_name_sorting(self):
        # Name: "Bacon"
        # B (Boron) - index 0, length 1
        # Ba (Barium) - index 0, length 2
        # C (Carbon) - index 2, length 1
        # Co (Cobalt) - index 2, length 2
        # O (Oxygen) - index 3, length 1
        # N (Nitrogen) - index 4, length 1
        elements = find_elements_in_name("Bacon")
        symbols = [el['symbol'] for el in elements]

        # Verify Ba comes before B because it's longer but starts at same index
        self.assertTrue(symbols.index("Ba") < symbols.index("B"))
        # Verify Co comes before C because it's longer but starts at same index
        self.assertTrue(symbols.index("Co") < symbols.index("C"))

    def test_index_get(self):
        response = self.app.get('/')
        self.assertEqual(response.status_code, 200)
        self.assertIn(b"What's in Your Name?", response.data)

    def test_index_post(self):
        response = self.app.post('/', data=dict(name='Jules'))
        self.assertEqual(response.status_code, 200)
        # Should match S (Sulfur) and U (Uranium) for sure maybe more
        self.assertIn(b"U", response.data)
        self.assertIn(b"S", response.data)

    def test_security_headers(self):
        response = self.app.get('/')
        self.assertEqual(response.headers.get('X-Content-Type-Options'), 'nosniff')
        self.assertEqual(response.headers.get('X-Frame-Options'), 'DENY')

if __name__ == '__main__':
    unittest.main()
