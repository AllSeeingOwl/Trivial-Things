from playwright.sync_api import Page, expect, sync_playwright

def test_what_the_spell_accessibility(page: Page):
    """
    This test verifies that the What the Spell application correctly
    has focus styles on grid elements and proper ARIA states on the
    modes toggle buttons.
    """
    page.goto("http://localhost:5001")

    # Verify the ARIA pressed state updates correctly
    # 'normal' should be pressed by default
    normal_btn = page.get_by_role("button", name="Normal")
    expect(normal_btn).to_have_attribute("aria-pressed", "true")

    no_vowels_btn = page.get_by_role("button", name="No Vowels", exact=True)
    expect(no_vowels_btn).to_have_attribute("aria-pressed", "false")

    # Click a different mode button
    no_vowels_btn.click()

    # Wait for JS to update attributes and verify
    expect(normal_btn).to_have_attribute("aria-pressed", "false")
    expect(no_vowels_btn).to_have_attribute("aria-pressed", "true")

    # Let's test keyboard accessibility on a cell
    # Press Tab repeatedly to cycle through to a word cell
    page.keyboard.press("Tab") # dropdown
    page.keyboard.press("Tab") # Load Grid button
    page.keyboard.press("Tab") # Reset Board button
    page.keyboard.press("Tab") # the 'Normal' mode button
    page.keyboard.press("Tab") # 'No Vowels' button
    page.keyboard.press("Tab") # 'Backwards'
    page.keyboard.press("Tab") # 'Both'
    # The next tabbable elements should be our cells, assuming default mode buttons are inside form vs not

    # Instead of counting tabs, we'll wait for cells to load, focus on the first one, then press Space
    # Wait for cell elements to load
    page.wait_for_selector(".cell.word-cell")
    cells = page.locator(".cell.word-cell")

    # Focus the first cell
    first_cell = cells.first
    first_cell.focus()

    # Take screenshot showing focus ring
    page.screenshot(path="/home/jules/verification/what-the-spell-focused.png")

    # trigger Space, which should click it
    page.keyboard.press("Space")

    # It should have the .revealed class now
    expect(first_cell).to_have_class("cell word-cell revealed")

    # Verify aria-expanded toggles correctly
    expect(first_cell).to_have_attribute("aria-expanded", "true")

    # Check that another unrevealed cell still has aria-expanded=false
    second_cell = cells.nth(1)
    expect(second_cell).to_have_attribute("aria-expanded", "false")

    # Take another screenshot
    page.screenshot(path="/home/jules/verification/what-the-spell-revealed.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            test_what_the_spell_accessibility(page)
        finally:
            browser.close()
