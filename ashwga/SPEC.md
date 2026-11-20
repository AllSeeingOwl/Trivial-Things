# ASHWGA Cliché Bingo: product spec

## The idea

Satirical bingo cards for things that always go the same way: game showcases,
streams, wrestling promos, open-world games. You play along live and dab each
cliché as it happens. The joke is how fast you get a line. A full house means
nothing surprised you at all.

**Name:** **ASHWGA**, short for "Ah shit, here we go again". It's the sigh you let out when
the thing you knew was coming arrives right on time.

**One-line pitch:** "Bingo for things you could see coming a mile off."

## Who it's for

- **Second-screen watchers.** They already have a phone in hand during a
  stream, a showcase or a pay-per-view.
- **Watch parties and Discord groups.** Everyone gets a different card for the
  same event, and the first to get a line gets bragging rights.
- **Posters.** "FULL HOUSE in 6 minutes" with an emoji grid is the share.

## Principles

1. **Tropes, not people.** Squares mock formats and habits ("Blames the
   controller"), never a named real person. This keeps it funny rather than
   mean, keeps it legally safe, and is a moderation rule for anything
   user-submitted.
2. **Squares must be checkable live.** Each one is a moment you can spot as it
   happens, not an opinion ("bad writing").
3. **Short enough for a phone square.** About 45 characters at most.
4. **Instant to start.** No account, no setup. Open the page and you have a card.

## Prototype (built: v0.1, `ashwga/`)

A static page with no backend, deployed like `crossover_size_converter`.

| Feature | Notes |
|---|---|
| 8 starter decks | Game Showcase, Live Streamer, Wrestling Promo, Open-World Game, Award Show, Video Essay, Girl Talk, Patch Notes. 50 to 52 squares each, so two cards share only about half their squares. |
| Random 5×5 cards | Seeded shuffle; the free centre square is each deck's most certain cliché. |
| Shareable card | URL `#d=<deck>&s=<seed>` rebuilds the exact card. Friends can play the same card, or press "New card" to get their own. |
| Marking | Tap, or use the arrow keys and Space. The dab animation respects reduced motion. |
| Line / full-house detection | 12 lines (5 rows, 5 columns, 2 diagonals), with a banner on the first line and on a full house. |
| "One away" glow | A square that would finish a line pulses orange. This is the "you're almost there" feeling the whole idea is built on. |
| Stats | Lines, time since the first dab, and the share of squares called. |
| Share result | Emoji grid plus a summary and the link. Uses the native share sheet on phones and the clipboard elsewhere. |
| Custom cards | Title, free square and at least 24 squares. The whole deck is encoded in the link, so it can be sent with no server. |
| Edit squares | A panel lists every square in the deck: the 24 on your card, the rest of the deck, and any you removed. **Swap** replaces a card square with a random spare. **Put on card** asks you to tap which square it replaces. **Remove** takes a square out of the deck, swapping it off the card if needed. **Add** puts your own square in the deck. A deck can't drop below 24 squares, and **Reset this deck** undoes the edits. Deck edits live in this browser (`ashwga:edits:<deck>`). An edited card adds `&k=` (its 24 squares) to its link, so the link still shares the exact card. |
| Close enough counts | A house rule in How to play: if it's clearly the same cliché in different words, it counts. About a third of each deck's squares (147 in all, mostly the quoted ones) and every free square list 2 or 3 example variations. Squares with variations show a ≈ mark. Press and hold (touch), hover (mouse) or `?` (keyboard) shows "Also counts: …". A press and hold never marks the square, and screen readers hear the variations in the square's label. The deck list shows them too. Custom decks and added squares take variations after a `\|` ("Square \| variation \| variation"), up to 5 each, and custom ones travel in the card link. |
| Persistence | Marks are saved per card in `localStorage`. Each browser keeps its own. |
| Squares sized to their text | Each column's width follows how wordy it is and its longest word. Rows grow to fit their tallest square. Short squares get bigger text, and a square only shrinks its text (to no less than 8.5px) when its longest word would otherwise split. |
| Light and dark themes, phone-first layout | Tested down to a 320px-wide screen. On the very narrowest phones, a few long words still wrap; Safari hyphenates them. |

### Data format

`cards.js` holds `window.ASHWGA_DECKS`, an array of
`{ id, title, blurb, accent, free, squares[], also }`. `also` maps a square's exact text to other wordings that count. Adding a deck means adding an
object and a colour token (`--a-<accent>`) in `index.html`.

## Roadmap

### v0.2: content and polish (still static)
- More decks: sports pundits, product keynotes, reality TV, film trailers,
  cooking shows, "tier list" videos.
- **Event cards:** dated cards for specific upcoming events (a showcase
  date or a PPV), linked from a "Tonight" strip.
- **Share image:** render the finished card to a PNG on a canvas, styled as a
  "certificate of predictability".
- Print and PDF layout for in-person watch parties, with several cards per page.
- Deck difficulty labels. Some decks are "Easy line" by design.

### v0.3: live rooms (needs a small backend)
- **Rooms:** a host makes a room for an event and gets a short code. Players
  join and each gets their own seeded card from the same deck.
- **Live feed:** "Sam called *Mic drop*", plus a leaderboard by lines and time.
- **Consensus marking (optional):** a square only counts once a majority of
  the room has marked it, which stops people faking a win.
- **Stack:** this would fit the repo as a Flask app with SQLite and polling,
  or server-sent events, like the others. WebSockets are not needed at room
  sizes under about 50.

### v0.4: community squares
- Players suggest squares for a deck; others vote "always happens" or
  "rarely".
- Squares are weighted by votes, so the most predictable ones turn up more often.
- **Predictability heatmap:** after an event, show which squares most rooms
  marked. That's a shareable "most predictable moment of the night" post.
- Moderation: the trope-not-person rule, a report button, and approval before a
  square goes live.

## Success measures
- Share rate (share or copy-link presses per card played).
- Squares marked per session. A card with fewer than 3 marks means the deck missed.
- Return visits on event days.
- For community squares: the share of suggestions approved.

## Open questions
- **Name in public places:** the full phrase contains a swear word. App-store listings,
  ads or school-friendly settings may want just the acronym, or "Ah sh*t, here we go again".
- Should the free square sometimes be a "trap" square that never happens? It's funny, but might
  feel unfair.
- Should rooms allow a shared single card (everyone on one card), as well as one
  card each?
- Monetisation, if ever: sponsored deck packs, or an ad-free supporter tier.
  Not needed while it stays a static site.
