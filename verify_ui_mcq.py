from playwright.sync_api import Page, sync_playwright

def test_mcq_color_accessibility(page: Page):
    """
    This test verifies that the MCQ Flashcards application appends a checkmark
    or cross icon to the selected answer button, fulfilling WCAG 1.4.1 (Use of Color).
    """
    page.goto("http://localhost:5000")

    # Wait for the choices to appear
    page.wait_for_selector("#mcq-choices button")
    choices = page.locator("#mcq-choices button")

    # Click the first choice
    first_choice = choices.first
    first_choice.click()

    # Wait for a short moment for the state change
    page.wait_for_timeout(500)

    # Take a screenshot to visually verify the text change ('✓' or '✗' appended)
    page.screenshot(path="/home/jules/verification/mcq-flashcards-answered.png")

    # We can also assert that the text content contains either ✓ or ✗
    text = first_choice.inner_text()
    assert "✓" in text or "✗" in text, f"Button text '{text}' does not contain ✓ or ✗"

    print(f"Verified button text: {text}")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            test_mcq_color_accessibility(page)
        finally:
            browser.close()