import threading
import time
import requests
from playwright.sync_api import sync_playwright
import os

def run_server():
    os.system("cd pdf_grid_flashcards && python3 app.py")

def test_upload_invalid_pdf():
    # Start server in background
    server_thread = threading.Thread(target=run_server)
    server_thread.daemon = True
    server_thread.start()

    # Wait for server to start
    time.sleep(3)

    try:
        requests.get("http://localhost:5002/")
        print("Server is up!")
    except:
        print("Failed to connect to server!")
        return

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto('http://localhost:5002/')

        # We simulate uploading a text file
        with open('test_file.txt', 'w') as f:
            f.write('Not a PDF')

        page.set_input_files('#pdf-file', 'test_file.txt')
        page.click('button[type="submit"]')

        # Wait for error message to appear
        page.wait_for_selector('p[role="alert"]')

        # Check that the text is correct
        error_element = page.locator('p[role="alert"]')
        error_text = error_element.text_content()

        print(f"Error message displayed: '{error_text}'")

        if 'Error:' in error_text:
            print("Successfully verified the error message logic.")
        else:
            print("Failed to verify the error message logic.")

        browser.close()

if __name__ == "__main__":
    test_upload_invalid_pdf()
