# ASHWGA browser tests

Playwright tests for [ASHWGA](../../ashwga/), the cliché bingo page. They serve
`ashwga/` as a static site, the way Render does, and drive it in Chromium. Phones
are emulated, with real touch events where it matters.

| File | What it checks |
|---|---|
| `tests/gameplay.spec.js` | Marking, lines and full house, saving across reloads, sharing, card links, decks, custom cards, keyboard play |
| `tests/edit.spec.js` | Edit squares: swap, remove, restore, add and place, reset, the 24-square minimum, edited-card links |
| `tests/variations.spec.js` | "Close enough counts": deck data, press-and-hold, hover, `?`, the deck list, `\|` variations in custom and added squares |
| `tests/layout.spec.js` | Across every deck on iPhone SE, iPhone 13, Pixel 5 and desktop: no clipped, overlapping or off-card squares, and no word split mid-word |
| `tests/a11y.spec.js` | axe-core (WCAG 2.2 AA) in every state, light and dark, phone and desktop, plus tab order, focus rings, focus after edits, hoverable popover, reduced motion and reflow |

## Run them

```bash
cd tools/ashwga-tests
npm ci
npx playwright install chromium   # first time only
npx playwright test
```

The tests need `python3` on the PATH; they start `python3 -m http.server 8014` themselves.
To use a Chromium that's already installed, set `PW_CHROMIUM_EXECUTABLE` to its path.

CI runs them on every pull request that touches `ashwga/` or this folder
(`.github/workflows/ashwga-tests.yml`). If one fails there, its HTML report is
uploaded as the `ashwga-playwright-report` artifact.

## Adding a deck

`variations.spec.js` and `layout.spec.js` read the decks from `ashwga/cards.js`,
so a new deck is tested automatically. If a square is too long for a phone, the
mid-word test names it.
