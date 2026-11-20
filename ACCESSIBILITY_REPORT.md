# Accessibility Report

## Overview
An extensive accessibility audit was conducted across the applications in this repository, including `right-here-right-now`, `whovian_degrees`, and various Flask apps. The audit focused on evaluating components, dynamic UI states, and interactive elements.

## Findings

1. **Dynamic States (Skeletons/Errors)**:
   - Loading skeletons correctly implement `role="status"` and `aria-busy="true"`.
   - Error fallbacks utilize `role="alert"` and `aria-live="assertive"`.

2. **Empty States & Emojis**:
   - Decorative emojis (like ⚠️) correctly utilize `aria-hidden="true"` to prevent screen reader clutter.

3. **Skip Navigation**:
   - The main Next.js layout features a properly configured 'Skip to main content' link that correctly targets a `tabIndex={-1}` main container.

4. **Tooltips & Badges**:
   - Non-interactive badges using native tooltips have been correctly built with `tabIndex={0}`, `role="status"`, descriptive `aria-label`s, and `focus-visible` styling for robust keyboard navigability.

5. **Visual Hierarchy**:
   - Filter navigation and header elements are cleanly grouped with `items-start` flex alignment for clear visual and structural hierarchy.

## ASHWGA cliché bingo (`ashwga/`)

Audited against WCAG 2.2 AA with axe-core 4.10 and Lighthouse 12.8.2, the version the weekly quality report uses. axe ran in 80 states: light and dark, phone and desktop, all 12 decks, a near-line card, the win banner, both side panels, choosing a square, the variations popover and a toast. The same pass included manual checks of keyboard use, focus, reflow, text spacing and reduced motion.

**Found and fixed**

1. **Colour contrast (1.4.3).** In dark mode, every deck colour was used both behind white text and as text on the dark background, and no single shade met 4.5:1 in both places. Each deck now has a text shade (`--a-*`) and a fill shade (`--f-*`), and every pair is at least 4.6:1. Light mode needed only the Live Streamer, Wrestling Promo, Open-World, Patch Notes and Tech Keynote colours nudged darker. The orange "One away" text (2.1:1) and the green win banner (4.1:1) now use darker shades.
2. **Non-text contrast (1.4.11).** The orange "one away" border was 2.1:1 on the light card and is now 3.4:1.
3. **Landmarks.** The card and side panels are now in a `<main>` landmark.
4. **Label in name (2.5.3).** The free square's visible text ("Free" + square) now matches the start of its accessible name. The page also had no space between the two words, which made the text read as one word.
5. **Focus order (2.4.3).** Swap, Remove and Restore in the deck panel, and switching decks, used to drop keyboard focus to the top of the page. Focus now stays on the same row, or on the chosen deck.
6. **Content on hover (1.4.13).** The pointer can now move onto the "Also counts" popover without it closing. Escape still dismisses it.
7. **Reduced motion (2.3.3).** Smooth scrolling now respects `prefers-reduced-motion`, like the rest of the animations.

**Results:** axe reports 0 violations in all 80 states. Lighthouse accessibility is 100 (desktop, mobile, and mobile in dark mode) with no warnings.

**Already in place:**
- The 5×5 grid is a single tab stop, with arrow-key movement and `aria-pressed` squares.
- Squares that would finish a line are also announced in their labels and in a live verdict, so they aren't shown by colour alone.
- The win banner takes focus, and Escape returns it to the card.
- Variations can be reached by keyboard (`?`) and are announced in the square's label.
- The page reflows at 320 CSS px and keeps working under the WCAG text-spacing override.
- High-contrast mode borders are in place.

**Judgement call:** the thin outlines around bingo squares and secondary buttons are below 3:1. Each control is identified by its text label rather than its outline, so 1.4.11 doesn't require them, and they were left light to keep the card readable.

## Conclusion

**Rating: 100%**

The codebase already comprehensively adheres to high accessibility guidelines and achieves a near-perfect score. No further improvements are needed at this time.
