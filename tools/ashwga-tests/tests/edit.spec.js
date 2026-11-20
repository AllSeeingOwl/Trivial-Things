// "Edit squares": seeing every square in a deck, and changing the card or the deck.
const { test, expect } = require('@playwright/test');
const { openCard, phone } = require('./helpers');

const cells = (page) => page.locator('.sq span').allTextContents();
const rowButton = (page, list, row, name) => page.locator(`#${list} li`).nth(row).getByRole('button', { name: new RegExp('^' + name) });

test.describe('edit squares', () => {
  test('the panel lists the card, the rest of the deck, and a summary', async ({ page }) => {
    await openCard(page, 'd=awards&s=ed1');
    expect(page.url()).not.toContain('&k=');
    await page.click('#editSquares');
    await expect(page.locator('#editPanel')).toHaveAttribute('open', '');
    await expect(page.locator('#eCard li')).toHaveCount(24);
    await expect(page.locator('#eRest li')).toHaveCount(26); // 50 squares in the deck
    await expect(page.locator('#eSummary')).toContainText('50 squares in play');
  });

  test('Swap replaces one square, keeps other marks, and the link carries the card', async ({ page, browser }) => {
    await openCard(page, 'd=awards&s=ed2');
    const before = await cells(page);
    for (const i of [0, 1, 2]) await page.locator('.sq').nth(i).click();
    await page.click('#editSquares');
    await rowButton(page, 'eCard', 2, 'Swap').click();
    const after = await cells(page);
    expect(after[2]).not.toBe(before[2]);
    expect(before).not.toContain(after[2]);
    expect(after.filter((t, i) => i !== 2)).toEqual(before.filter((t, i) => i !== 2));
    await expect(page.locator('.sq').nth(2)).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('.sq[aria-pressed=true]')).toHaveCount(3); // two marks + free
    expect(page.url()).toContain('&k=');

    await page.reload({ waitUntil: 'networkidle' });
    expect(await cells(page)).toEqual(after);
    await expect(page.locator('.sq[aria-pressed=true]')).toHaveCount(3);

    const friend = await (await browser.newContext()).newPage();
    await friend.goto(page.url(), { waitUntil: 'networkidle' });
    expect(await friend.locator('.sq span').allTextContents()).toEqual(after);
    await expect(friend.locator('.sq[aria-pressed=true]')).toHaveCount(1);
  });

  test('Remove takes a square off the card and out of new cards; Restore brings it back', async ({ page }) => {
    await openCard(page, 'd=awards&s=ed3');
    await page.click('#editSquares');
    const victim = (await cells(page))[6];
    await page.locator('#eCard li', { hasText: victim }).getByRole('button', { name: /^Remove/ }).click();
    expect(await cells(page)).not.toContain(victim);
    await expect(page.locator('#eRemoved li', { hasText: victim })).toHaveCount(1);
    await expect(page.locator('#eRest li')).toHaveCount(25);
    for (let n = 0; n < 12; n++) {
      await page.click('#newCard');
      expect(await cells(page)).not.toContain(victim);
    }
    await page.click('#editSquares');
    await page.locator('#eRemoved li', { hasText: victim }).getByRole('button', { name: /^Restore/ }).click();
    await expect(page.locator('#eRemovedWrap')).toBeHidden();
  });

  test('Add and put on card places your square where you tap; Escape cancels picking', async ({ page }) => {
    await openCard(page, 'd=promo&s=ed4');
    await page.click('#editSquares');
    await page.fill('#eNew', 'Calls the referee “a disgrace”');
    await page.click('#eAddPlace');
    await expect(page.locator('#pickHint')).toBeVisible();
    await page.locator('.sq').nth(7).click();
    expect((await cells(page))[7]).toBe('Calls the referee “a disgrace”');
    await expect(page.locator('#pickHint')).toBeHidden();
    await expect(page.locator('#eCard li', { hasText: 'Calls the referee' }).locator('.tag')).toHaveText('yours');

    const before = await cells(page);
    await rowButton(page, 'eRest', 0, 'Put on card').click();
    await page.keyboard.press('Escape');
    await expect(page.locator('#pickHint')).toBeHidden();
    await page.locator('.sq').nth(3).click();
    expect(await cells(page)).toEqual(before); // a tap marks again, nothing replaced
    await expect(page.locator('.sq').nth(3)).toHaveAttribute('aria-pressed', 'true');
  });

  test('Reset clears deck edits but leaves the current card alone', async ({ page }) => {
    await openCard(page, 'd=essay&s=ed5');
    await page.click('#editSquares');
    await page.fill('#eNew', 'Thumbnail with a shocked face');
    await page.click('#eAdd');
    await expect(page.locator('#eRest li', { hasText: 'Thumbnail with a shocked face' })).toHaveCount(1);
    await rowButton(page, 'eRest', 0, 'Remove').click();
    await page.click('#eReset');
    await expect(page.locator('#eRest li', { hasText: 'Thumbnail with a shocked face' })).toHaveCount(0);
    await expect(page.locator('#eRemovedWrap')).toBeHidden();
    await expect(page.locator('#eReset')).toBeDisabled();
  });

  test('a deck can’t drop below 24 squares, and Swap explains when nothing is spare', async ({ page }) => {
    await openCard(page, 'd=patch&s=ed6');
    await page.click('#editSquares');
    const spare = await page.locator('#eRest li').count();
    for (let n = 0; n < spare; n++) await rowButton(page, 'eRest', 0, 'Remove').click();
    await expect(page.locator('#eRest li')).toHaveCount(0);
    await rowButton(page, 'eCard', 0, 'Remove').click();
    await expect(page.locator('#toast')).toContainText('at least 24');
    await rowButton(page, 'eCard', 0, 'Swap').click();
    await expect(page.locator('#toast')).toContainText('No spare');
  });

  test('switching decks and back returns to the edited card', async ({ page }) => {
    await openCard(page, 'd=awards&s=ed7');
    await page.click('#editSquares');
    await rowButton(page, 'eCard', 0, 'Swap').click();
    const edited = await cells(page);
    await page.locator('.deck', { hasText: 'Girl Talk' }).click();
    await page.locator('.deck', { hasText: 'Award Show' }).click();
    expect(await cells(page)).toEqual(edited);
  });

  test('a damaged card link falls back to the normal card', async ({ page }) => {
    await openCard(page, 'd=awards&s=ed8');
    const normal = await cells(page);
    await page.goto('/#d=awards&s=ed8&k=bm90LWpzb24', { waitUntil: 'networkidle' });
    await page.reload({ waitUntil: 'networkidle' });
    expect(await cells(page)).toEqual(normal);
  });

  test('the panel fits a 320px phone with no sideways scroll', async ({ browser }) => {
    const page = await (await browser.newContext({ ...phone('iPhone SE') })).newPage();
    await openCard(page, 'd=essay&s=ed9');
    await page.click('#editSquares');
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
  });
});
