// Layout: squares fit their text on every deck and screen size.
const { test, expect } = require('@playwright/test');
const { loadDecks, openCard, midWordBreaks, phone } = require('./helpers');

const DECKS = loadDecks();
const SCREENS = {
  'iPhone SE': phone('iPhone SE'),
  'iPhone 13': phone('iPhone 13'),
  'Pixel 5': phone('Pixel 5'),
  desktop: { viewport: { width: 1280, height: 900 } },
};
const CARDS_PER_DECK = 6;

/** Deal several cards per deck in one page and collect problems on each. */
async function sweep(page, check) {
  const problems = new Set();
  for (const deck of DECKS) {
    for (let k = 0; k < CARDS_PER_DECK; k++) {
      await page.evaluate((h) => { location.hash = h; }, `d=${deck.id}&s=sweep${k}`);
      // Wait for this exact card: its deck colour and its card code (unique per card).
      await page.waitForFunction(([id, code]) => document.body.dataset.accent === id &&
        document.getElementById('cardCode').textContent === code, [deck.id, `SWEEP${k}`]);
      for (const p of await check(page)) problems.add(`${deck.id}: ${p}`);
    }
  }
  return [...problems];
}

for (const [name, screen] of Object.entries(SCREENS)) {
  test.describe(name, () => {
    test.use(screen);

    test('no square clips its text, overlaps a neighbour or leaves the card', async ({ page }) => {
      test.setTimeout(180_000);
      await openCard(page, 'd=showcase&s=layout');
      const problems = await sweep(page, (p) => p.evaluate(() => {
        const out = [], grid = document.getElementById('grid').getBoundingClientRect();
        const sq = [...document.querySelectorAll('.sq')];
        const r = sq.map((e) => e.getBoundingClientRect());
        sq.forEach((e, i) => {
          if (e.scrollHeight > e.clientHeight + 1) out.push('clipped: ' + e.textContent);
          if (r[i].right > grid.right + 1 || r[i].left < grid.left - 1) out.push('outside the card: ' + e.textContent);
          if (i % 5 !== 4 && r[i].right > r[i + 1].left + 0.5) out.push('overlaps: ' + e.textContent);
        });
        if (document.documentElement.scrollWidth > innerWidth) out.push('page scrolls sideways');
        return out;
      }));
      expect(problems).toEqual([]);
    });

    if (name !== 'iPhone SE') {
      // A 320px phone is too narrow for a few long words even at the smallest
      // readable size, so they wrap there (Safari hyphenates them).
      test('no word is split mid-word', async ({ page }) => {
        test.setTimeout(180_000);
        await openCard(page, 'd=showcase&s=words');
        expect(await sweep(page, midWordBreaks)).toEqual([]);
      });

      test('no word is split on the first card a visitor sees', async ({ page }) => {
        for (const deck of DECKS) {
          await openCard(page, `d=${deck.id}&s=first`);
          expect(await midWordBreaks(page), deck.id).toEqual([]);
        }
      });
    }
  });
}

test('on phones the deck picker is a two-column grid that fits', async ({ browser }) => {
  for (const device of ['iPhone SE', 'iPhone 13']) {
    const page = await (await browser.newContext(phone(device))).newPage();
    await openCard(page, 'd=keynote&s=chips');
    const chips = page.locator('.deck');
    await expect(chips).toHaveCount(DECKS.length);
    const clipped = await chips.evaluateAll((els) => els.filter((c) => c.scrollWidth > c.clientWidth + 1).map((c) => c.textContent));
    expect(clipped, device).toEqual([]);
    const cols = await page.locator('#decks').evaluate((e) => getComputedStyle(e).gridTemplateColumns.split(' ').length);
    expect(cols, device).toBe(2);
  }
});
