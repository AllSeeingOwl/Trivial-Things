import unittest
import io
from unittest.mock import patch, MagicMock

import pdf_grid_flashcards_app as app

class TestApp(unittest.TestCase):
    def setUp(self):
        self.client = app.app.test_client()

    def test_upload_no_file_part(self):
        response = self.client.post('/api/upload', data={})
        self.assertEqual(response.status_code, 400)
        self.assertIn('No file part', response.json['error'])

    def test_upload_empty_filename(self):
        data = {'file': (io.BytesIO(b''), '')}
        response = self.client.post('/api/upload', data=data, content_type='multipart/form-data')
        self.assertEqual(response.status_code, 400)
        self.assertIn('No selected file', response.json['error'])

    def test_upload_non_pdf(self):
        data = {'file': (io.BytesIO(b'dummy content'), 'test.txt')}
        response = self.client.post('/api/upload', data=data, content_type='multipart/form-data')
        self.assertEqual(response.status_code, 400)

    def test_upload_non_pdf_png(self):
        data = {'file': (io.BytesIO(b'dummy content'), 'image.png')}
        response = self.client.post('/api/upload', data=data, content_type='multipart/form-data')
        self.assertEqual(response.status_code, 400)

    @patch('pdf_grid_flashcards_app.parse_pdf')
    @patch('os.path.exists', return_value=True)
    @patch('os.remove')
    def test_upload_pdf_success(self, mock_remove, mock_exists, mock_parse):
        mock_parse.return_value = [[{'text': 'test', 'status': 'correct'}]]
        data = {'file': (io.BytesIO(b'%PDF-1.4 dummy content'), 'test.pdf')}
        response = self.client.post('/api/upload', data=data, content_type='multipart/form-data')
        self.assertEqual(response.status_code, 200)

    @patch('pdf_grid_flashcards_app.parse_pdf')
    @patch('os.path.exists', return_value=True)
    @patch('os.remove')
    def test_upload_pdf_processing_error(self, mock_remove, mock_exists, mock_parse):
        mock_parse.side_effect = Exception("Parsing failed")
        data = {'file': (io.BytesIO(b'%PDF-1.4 dummy content'), 'test.pdf')}
        response = self.client.post('/api/upload', data=data, content_type='multipart/form-data')
        self.assertEqual(response.status_code, 500)

if __name__ == '__main__':
    unittest.main()
