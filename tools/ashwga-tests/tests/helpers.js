// Shared helpers for the ASHWGA browser tests.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const { devices } = require('@playwright/test');

const APP = path.resolve(__dirname, '../../../ashwga');

/**
 * A phone's screen size, scale and touch support, run in Chromium. (Playwright's
 * iPhone profiles default to WebKit, which these tests don't use.)
 */
function phone(name) {
  const { defaultBrowserType, ...rest } = devices[name];
  return rest;
}

/** The decks from ashwga/cards.js, read the same way the page reads them. */
function loadDecks() {
  const sandbox = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(APP, 'cards.js'), 'utf8'), sandbox);
  return sandbox.window.ASHWGA_DECKS;
}

/** Open a card and wait until it's drawn (fonts loaded, text fitted). */
async function openCard(page, hash) {
  await page.goto('/#' + hash, { waitUntil: 'networkidle' });
  // Changing only the hash doesn't reload; reload so each test starts from a clean page.
  await page.reload({ waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
}

/**
 * Squares on screen whose longest word is wider than the square, so the word
 * would be split mid-word. Measured as app.js does when it fits text: with
 * the last-resort "break anywhere" turned off (the .measuring class), at
 * min-content and with fractional widths. Without .measuring every word could
 * break, min-content would be tiny, and nothing would ever be reported.
 */
function midWordBreaks(page) {
  return page.evaluate(() => [...document.querySelectorAll('.sq')].filter((q) => {
    q.classList.add('measuring');
    const cs = getComputedStyle(q);
    const room = q.getBoundingClientRect().width - parseFloat(cs.borderLeftWidth) - parseFloat(cs.borderRightWidth) -
      parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const widest = Math.max(...[...q.children].map((c) => {
      c.style.width = 'min-content';
      const w = c.getBoundingClientRect().width;
      c.style.width = '';
      return w;
    }));
    q.classList.remove('measuring');
    return widest > room + 0.1;
  }).map((q) => q.textContent));
}

/** Press and hold with real touch events (not mouse), for the long-press tests. */
async function touchHold(page, locator, ms) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  const cdp = await page.context().newCDPSession(page);
  const point = [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: point });
  await page.waitForTimeout(ms);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(150);
}

/** A quick tap with real touch events. */
async function touchTap(page, locator) {
  return touchHold(page, locator, 40);
}

module.exports = { APP, phone, loadDecks, openCard, midWordBreaks, touchHold, touchTap };
