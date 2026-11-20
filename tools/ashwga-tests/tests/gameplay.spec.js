// Playing a card: marking, lines, full house, saving, sharing, decks and custom cards.
const { test, expect } = require('@playwright/test');
const { openCard } = require('./helpers');

test.describe('gameplay', () => {
  test('a card has 25 squares and its link names the deck and seed', async ({ page }) => {
    await openCard(page, 'd=showcase&s=play1');
    await expect(page.locator('.sq')).toHaveCount(25);
    await expect(page.locator('.sq.free')).toHaveAttribute('aria-pressed', 'true');
    expect(page.url()).toMatch(/#d=showcase&s=play1$/);
  });

  test('one away glows, a line shows the banner, a full house says so', async ({ page }) => {
    await openCard(page, 'd=promo&s=play2');
    for (const i of [0, 1, 2, 3]) await page.locator('.sq').nth(i).click();
    await expect(page.locator('.sq.near')).not.toHaveCount(0);
    await expect(page.locator('#verdict')).toContainText('One away');

    await page.locator('.sq').nth(4).click();
    await expect(page.locator('#banner')).toBeVisible();
    await expect(page.locator('#bannerTitle')).toHaveText('LINE!');
    await expect(page.locator('#lines')).toHaveText('1');
    await expect(page.locator('#bannerClose')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.locator('#banner')).toBeHidden();

    for (let i = 5; i < 25; i++) if (i !== 12) await page.locator('.sq').nth(i).click();
    await expect(page.locator('#bannerTitle')).toHaveText('FULL HOUSE!');
    await expect(page.locator('#pct')).toHaveText('100%');
    await expect(page.locator('#lines')).toHaveText('12');
  });

  test('marks survive a reload, and the banner is not shown again', async ({ page }) => {
    await openCard(page, 'd=streamer&s=play3');
    for (const i of [0, 6, 3, 8]) await page.locator('.sq').nth(i).click(); // no line, so no banner
    const marked = await page.locator('.sq[aria-pressed=true]').count();
    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.locator('.sq[aria-pressed=true]')).toHaveCount(marked);
    await expect(page.locator('#banner')).toBeHidden();
  });

  test('Clear marks resets the card, timer and banner', async ({ page }) => {
    await openCard(page, 'd=awards&s=play4');
    for (const i of [0, 1, 2]) await page.locator('.sq').nth(i).click();
    await page.click('#clear');
    await expect(page.locator('.sq[aria-pressed=true]')).toHaveCount(1); // the free square
    await expect(page.locator('#timer')).toHaveText('0:00');
  });

  test('Share result copies an emoji grid and the card link', async ({ browser }) => {
    const context = await browser.newContext();
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const page = await context.newPage();
    await openCard(page, 'd=patch&s=play5');
    for (const i of [0, 1, 2, 3, 4]) await page.locator('.sq').nth(i).click();
    await page.click('#bannerClose');
    await page.click('#share');
    const text = await page.evaluate(() => navigator.clipboard.readText());
    expect(text).toContain('ASHWGA bingo: Patch Notes');
    expect(text).toContain('1 line in');
    expect(text).toContain('🟧🟧🟧🟧🟧');
    expect(text).toContain('⭐');
    expect(text).toContain('#d=patch&s=play5');
    await context.close();
  });

  test('a card link gives a friend the same card, unmarked', async ({ page, browser }) => {
    await openCard(page, 'd=talk&s=play6');
    await page.locator('.sq').nth(0).click();
    const mine = await page.locator('.sq span').allTextContents();
    const friend = await (await browser.newContext()).newPage();
    await friend.goto(page.url(), { waitUntil: 'networkidle' });
    expect(await friend.locator('.sq span').allTextContents()).toEqual(mine);
    await expect(friend.locator('.sq[aria-pressed=true]')).toHaveCount(1);
  });

  test('New card deals a different card from the same deck', async ({ page }) => {
    await openCard(page, 'd=reality&s=play7');
    const before = await page.locator('.sq span').allTextContents();
    await page.click('#newCard');
    expect(page.url()).toContain('d=reality');
    expect(await page.locator('.sq span').allTextContents()).not.toEqual(before);
  });

  test('switching decks changes the card, colour and title', async ({ page }) => {
    await openCard(page, 'd=showcase&s=play8');
    await page.locator('.deck', { hasText: 'Wrestling Promo' }).click();
    expect(page.url()).toContain('d=promo');
    await expect(page.locator('#deckTitle')).toHaveText('Wrestling Promo');
    await expect(page.locator('.sq.free span')).toContainText('cheap pop');
    await expect(page.locator('body')).toHaveAttribute('data-accent', 'promo');
    await expect(page.locator('.deck[aria-pressed=true]')).toHaveText('Wrestling Promo');
  });

  test('a custom card needs 24 squares, plays, and travels in its link', async ({ page, browser }) => {
    await openCard(page, 'd=showcase&s=play9');
    await page.click('#customPanel summary');
    await page.fill('#cTitle', 'Football Pundit');
    await page.fill('#cFree', 'At the end of the day');
    await page.fill('#cSquares', Array.from({ length: 23 }, (_, i) => 'Cliché ' + i).join('\n'));
    await expect(page.locator('#cPlay')).toBeDisabled();
    await page.fill('#cSquares', Array.from({ length: 26 }, (_, i) => 'Cliché ' + i).join('\n'));
    await expect(page.locator('#cPlay')).toBeEnabled();
    await page.click('#cPlay');
    await expect(page.locator('#deckTitle')).toHaveText('Football Pundit');
    expect(page.url()).toMatch(/d=custom&s=.*&c=/);
    await expect(page.locator('.deck', { hasText: 'Football Pundit (yours)' })).toBeVisible();

    const friend = await (await browser.newContext()).newPage();
    await friend.goto(page.url(), { waitUntil: 'networkidle' });
    await expect(friend.locator('#deckTitle')).toHaveText('Football Pundit');
  });

  test('arrow keys move around the card and Space marks', async ({ page }) => {
    await openCard(page, 'd=keynote&s=play10');
    await page.locator('.sq').nth(0).focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowDown');
    await expect(page.locator('.sq').nth(6)).toBeFocused();
    await page.keyboard.press('Space');
    await expect(page.locator('.sq').nth(6)).toHaveAttribute('aria-pressed', 'true');
  });

  test('everything, fonts included, comes from the page’s own site', async ({ page }) => {
    // The squares are sized to these fonts, so a font from elsewhere that fails to
    // load (as Google Fonts did in CI) changes the layout. It also keeps visitors'
    // data away from third parties.
    const elsewhere = [];
    page.on('request', (r) => { if (!r.url().startsWith('http://localhost:8014/')) elsewhere.push(r.url()); });
    await openCard(page, 'd=promo&s=play12');
    await page.locator('.sq').nth(0).click();
    expect(elsewhere).toEqual([]);
    const fonts = await page.evaluate(() => [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family));
    expect(fonts).toContain('Atkinson Hyperlegible');
    expect(fonts).toContain('Bricolage Grotesque');
  });

  test('the page loads without script errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await openCard(page, 'd=girltalk&s=play11');
    await page.locator('.sq').nth(0).click();
    expect(errors).toEqual([]);
  });
});
