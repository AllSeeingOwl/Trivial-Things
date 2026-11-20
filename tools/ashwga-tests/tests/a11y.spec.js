// Accessibility: axe-core (WCAG 2.2 AA) in every state, plus the keyboard,
// focus, hover and motion checks that automated scanners can't make.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const { loadDecks, openCard, phone } = require('./helpers');

const AXE = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];

async function axe(page, state) {
  await page.addScriptTag({ content: AXE });
  const violations = await page.evaluate(async (tags) => {
    const r = await window.axe.run(document, { runOnly: { type: 'tag', values: tags } });
    return r.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(', ')}`);
  }, TAGS);
  expect(violations, state).toEqual([]);
}

const CONFIGS = {
  'desktop light': { viewport: { width: 1280, height: 900 } },
  'desktop dark': { viewport: { width: 1280, height: 900 }, colorScheme: 'dark' },
  'phone light': phone('iPhone 13'),
  'phone dark': { ...phone('iPhone 13'), colorScheme: 'dark' },
};

for (const [name, config] of Object.entries(CONFIGS)) {
  test.describe(`axe, ${name}`, () => {
    test.use(config);

    test('every state of the card and panels', async ({ page }) => {
      test.setTimeout(120_000);
      await openCard(page, 'd=promo&s=axe1');
      await axe(page, 'fresh card');
      for (const i of [0, 1, 2, 3]) await page.locator('.sq').nth(i).click();
      await axe(page, 'one away from a line');
      await page.locator('.sq').nth(4).click();
      await expect(page.locator('#banner')).toBeVisible();
      // The banner pops in (fade and scale); check its colours once the animation has finished.
      await page.locator('#banner').evaluate((e) => Promise.all(e.getAnimations().map((a) => a.finished)));
      await axe(page, 'line banner');
      await page.click('#bannerClose');
      await page.click('#editSquares');
      await page.locator('#eRest li').first().getByRole('button', { name: /^Remove/ }).click();
      await axe(page, 'edit panel, with a removed square');
      await page.locator('#eRest li').first().getByRole('button', { name: /^Put on card/ }).click();
      await axe(page, 'choosing a square');
      await page.keyboard.press('Escape');
      await page.locator('.sq.has-also').first().focus();
      await page.keyboard.press('?');
      await axe(page, 'variations popover');
      await page.keyboard.press('Escape');
      await page.click('#customPanel summary');
      await page.click('#share');
      await axe(page, 'custom panel and toast');
    });

    test('every deck, with squares marked', async ({ page }) => {
      test.setTimeout(120_000);
      for (const deck of loadDecks()) {
        await openCard(page, `d=${deck.id}&s=axe2`);
        for (const i of [0, 6, 18]) await page.locator('.sq').nth(i).click();
        await axe(page, deck.id);
      }
    });
  });
}

test.describe('keyboard and focus', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('tab order: decks, one stop for the grid, card buttons, panels', async ({ page }) => {
    await openCard(page, 'd=promo&s=kb1');
    await page.locator('body').click({ position: { x: 5, y: 5 } });
    const stops = [];
    for (let n = 0; n < 40; n++) {
      await page.keyboard.press('Tab');
      const s = await page.evaluate(() => { const a = document.activeElement; return (a.id || a.className || a.tagName) + '|' + (a.textContent || '').trim().slice(0, 30); });
      if (stops.length && s === stops[0]) break;
      stops.push(s);
    }
    expect(stops.filter((s) => s.startsWith('deck|'))).toHaveLength(loadDecks().length);
    expect(stops.filter((s) => s.startsWith('sq'))).toHaveLength(1);
    for (const id of ['share', 'newCard', 'copyLink', 'clear', 'editSquares']) expect(stops.some((s) => s.startsWith(id + '|')), id).toBe(true);
    expect(stops.filter((s) => s.startsWith('SUMMARY'))).toHaveLength(2);
  });

  test('every kind of control shows a focus ring', async ({ page }) => {
    await openCard(page, 'd=promo&s=kb2');
    await page.keyboard.press('Tab'); // switch to keyboard focus mode
    for (const sel of ['.deck', '.sq[tabindex="0"]', '#share', '#newCard', '#editPanel summary', '#customPanel summary']) {
      await page.locator(sel).first().focus();
      const ring = await page.locator(sel).first().evaluate((e) => { const c = getComputedStyle(e); return c.outlineStyle !== 'none' && parseFloat(c.outlineWidth) >= 2; });
      expect(ring, sel).toBe(true);
    }
  });

  test('switching decks keeps focus on the deck picker', async ({ page }) => {
    await openCard(page, 'd=promo&s=kb3');
    await page.locator('.deck', { hasText: 'Reality TV' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('.deck', { hasText: 'Reality TV' })).toBeFocused();
  });

  test('Swap, Remove and Restore keep focus in the list', async ({ page }) => {
    await openCard(page, 'd=promo&s=kb4');
    await page.click('#editSquares');
    await page.locator('#eRest li').nth(2).getByRole('button', { name: /^Remove/ }).focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#eRest li').nth(2).getByRole('button', { name: /^Remove/ })).toBeFocused();
    await page.locator('#eCard li').nth(5).getByRole('button', { name: /^Swap/ }).focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#eCard li').nth(5).getByRole('button', { name: /^Swap/ })).toBeFocused();
    await page.locator('#eRemoved li').first().getByRole('button', { name: /^Restore/ }).focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#editPanel summary')).toBeFocused(); // the list it was in is now gone
  });

  test('the free square’s name starts with its visible text (WCAG 2.5.3)', async ({ page }) => {
    await openCard(page, 'd=promo&s=kb5');
    const free = page.locator('.sq.free');
    const visible = (await free.evaluate((e) => e.textContent)).replace(/\s+/g, ' ').trim();
    expect(visible.startsWith('Free ')).toBe(true);
    expect((await free.getAttribute('aria-label')).startsWith(visible)).toBe(true);
  });
});

test('reduced motion: scrolling jumps and square animations are off', async ({ browser }) => {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 700 }, reducedMotion: 'reduce' })).newPage();
  await openCard(page, 'd=promo&s=rm1');
  await page.click('#editSquares');
  const y1 = await page.evaluate(() => scrollY);
  await page.waitForTimeout(600);
  expect(y1).toBeGreaterThan(0);
  expect(await page.evaluate(() => scrollY)).toBe(y1);
  expect(await page.locator('.sq').first().evaluate((e) => getComputedStyle(e).transitionDuration)).toBe('0s');
});

test('reflow at 320 CSS px, also under the WCAG text-spacing override', async ({ browser }) => {
  const page = await (await browser.newContext({ viewport: { width: 320, height: 640 } })).newPage();
  await openCard(page, 'd=keynote&s=rf1');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.addStyleTag({ content: '*{line-height:1.5!important;letter-spacing:.12em!important;word-spacing:.16em!important} p{margin-bottom:2em!important}' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
