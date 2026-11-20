// "Close enough counts": variations of a square, and how players see and add them.
const { test, expect } = require('@playwright/test');
const { loadDecks, openCard, touchHold, touchTap, phone } = require('./helpers');

test.describe('deck data', () => {
  for (const deck of loadDecks()) {
    test(`${deck.id}: ≥24 unique squares, and every variation belongs to a real square`, () => {
      const all = [...deck.squares, deck.free];
      const lower = all.map((t) => t.toLowerCase());
      expect(deck.squares.length).toBeGreaterThanOrEqual(48);
      expect(new Set(lower).size).toBe(all.length);
      for (const t of all) expect(t.length, t).toBeLessThanOrEqual(42);
      for (const [square, also] of Object.entries(deck.also || {})) {
        expect(all, `variation key "${square}"`).toContain(square);
        expect(also.length).toBeGreaterThan(0);
      }
      expect(deck.also[deck.free], 'the free square has variations').toBeTruthy();
    });
  }
});

test.describe('on a touch phone', () => {
  test.use({ ...phone('iPhone 13') });

  test('press and hold shows variations without marking; a tap still marks', async ({ page }) => {
    await openCard(page, 'd=promo&s=var1');
    const sq = page.locator('.sq.has-also:not(.free)').first();
    await touchHold(page, sq, 650);
    await expect(page.locator('#alsoPop')).toBeVisible();
    await expect(page.locator('#alsoPop')).toContainText('Also counts');
    await expect(sq).toHaveAttribute('aria-pressed', 'false');
    const pop = await page.locator('#alsoPop').boundingBox();
    expect(pop.x).toBeGreaterThanOrEqual(0);
    expect(pop.x + pop.width).toBeLessThanOrEqual(page.viewportSize().width);

    await touchTap(page, sq);
    await expect(sq).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#alsoPop')).toBeHidden();

    const plain = page.locator('.sq:not(.has-also):not(.free)').first();
    await touchTap(page, plain);
    await expect(plain).toHaveAttribute('aria-pressed', 'true');
  });

  test('the free square shows its variations too', async ({ page }) => {
    await openCard(page, 'd=promo&s=var2');
    await touchHold(page, page.locator('.sq.free'), 650);
    await expect(page.locator('#alsoPop')).toContainText('Names the state');
  });
});

test.describe('with a mouse and keyboard', () => {
  test('hover and ? show variations; Escape and moving away hide them', async ({ page }) => {
    await openCard(page, 'd=streamer&s=var3');
    const sq = page.locator('.sq.has-also:not(.free)').first();
    await expect(sq).toHaveAttribute('aria-label', /Also counts:/);
    await sq.hover();
    await expect(page.locator('#alsoPop')).toBeVisible();
    await page.mouse.move(5, 5);
    await expect(page.locator('#alsoPop')).toBeHidden();

    await sq.focus();
    await page.keyboard.press('?');
    await expect(page.locator('#alsoPop')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#alsoPop')).toBeHidden();

    await page.locator('.sq:not(.has-also):not(.free)').first().focus();
    await page.keyboard.press('?');
    await expect(page.locator('#toast')).toContainText('Close enough');

    await sq.click();
    await expect(sq).toHaveAttribute('aria-pressed', 'true');
  });

  test('the pointer can move onto the popover without it closing (WCAG 1.4.13)', async ({ page }) => {
    await openCard(page, 'd=promo&s=var4');
    await page.locator('.sq.has-also').first().hover();
    await expect(page.locator('#alsoPop')).toBeVisible();
    const box = await page.locator('#alsoPop').boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 6 });
    await page.waitForTimeout(400);
    await expect(page.locator('#alsoPop')).toBeVisible();
  });

  test('the deck list shows variations, and you can add your own with |', async ({ page }) => {
    await openCard(page, 'd=streamer&s=var5');
    await page.click('#editSquares');
    expect(await page.locator('#editPanel .alsoline').count()).toBeGreaterThanOrEqual(5);

    await page.fill('#eNew', 'Reads a donation in a funny voice | Does an accent for a donation | Robot voice for a donation');
    await page.click('#eAddPlace');
    await page.locator('.sq').nth(0).click();
    await expect(page.locator('.sq').nth(0).locator('span')).toHaveText('Reads a donation in a funny voice');
    await expect(page.locator('.sq').nth(0)).toHaveClass(/has-also/);
    await page.locator('.sq').nth(0).focus();
    await page.keyboard.press('?');
    await expect(page.locator('#alsoPop')).toContainText('Robot voice');
    await page.keyboard.press('Escape');

    const first = await page.locator('#eRest li .sqtext').first().textContent();
    await page.fill('#eNew', first + ' | My own wording');
    await page.click('#eAdd');
    await expect(page.locator('#eRest li', { hasText: first }).locator('.alsoline')).toContainText('My own wording');
  });

  test('custom decks take variations after | and share them in the link', async ({ page, browser }) => {
    await openCard(page, 'd=promo&s=var6');
    await page.click('#customPanel summary');
    await page.fill('#cTitle', 'Pundit');
    await page.fill('#cFree', 'At the end of the day | When all is said and done');
    await page.fill('#cSquares', Array.from({ length: 26 }, (_, i) => `Cliché ${i}` + (i < 3 ? ` | Variant ${i}a | Variant ${i}b` : '')).join('\n'));
    await expect(page.locator('#cCount')).toContainText('26 squares');
    await page.click('#cPlay');

    const friend = await (await browser.newContext()).newPage();
    await friend.goto(page.url(), { waitUntil: 'networkidle' });
    await expect(friend.locator('.sq.free')).toHaveAttribute('aria-label', /When all is said and done/);

    await page.goto('/#d=promo&s=var6', { waitUntil: 'networkidle' });
    await page.reload({ waitUntil: 'networkidle' });
    await page.click('#customPanel summary');
    await page.click('#cFromDeck');
    await expect(page.locator('#cSquares')).toHaveValue(/“Come Sunday…” \| “This Sunday at…”/);
    await expect(page.locator('#cFree')).toHaveValue(/\| Names the state/);
  });
});
