from playwright.sync_api import sync_playwright
import os

def verify_feature():
    # Make dir
    os.makedirs("/home/jules/verification/video", exist_ok=True)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(record_video_dir="/home/jules/verification/video")
        page = context.new_page()

        try:
            # 1. Load the page
            print("Loading page...")
            page.goto("http://localhost:5003")
            page.wait_for_timeout(1000)

            # Check that initial load has "Click to reveal question"
            print("Revealing first question...")
            row1 = page.locator('.sliding-row').nth(0)
            row1.click()
            page.wait_for_timeout(1000)

            # 2. Click again to reveal answer
            print("Revealing first answer...")
            row1.click()
            page.wait_for_timeout(1000)

            # 3. Reveal next question
            print("Revealing second question...")
            row2 = page.locator('.sliding-row').nth(1)
            row2.click()
            page.wait_for_timeout(1000)

            # 4. Take final screenshot
            print("Taking screenshot...")
            page.screenshot(path="/home/jules/verification/verification.png")
            page.wait_for_timeout(1000)

            print("Verification complete.")
        finally:
            context.close()
            browser.close()

if __name__ == "__main__":
    verify_feature()