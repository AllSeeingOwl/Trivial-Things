## 2024-03-23 - [WCAG 1.4.1 Use of Color]
**Learning:** In interactive quiz components, using background color alone (like turning a button green for correct or red for incorrect) is an accessibility failure for color-blind users. They may not be able to perceive the status change.
**Action:** When indicating state changes such as correct/incorrect in quiz apps, always pair color cues with a text equivalent or icon (like appending ' ✓' or ' ✗' to the answer choice).

## 2026-03-24 - Event Bubbling Breaking Keyboard Accessibility
**Learning:** Attaching a `keydown` listener to a parent container (like a flashcard) that calls `event.preventDefault()` on `Enter` or `Space` will completely break keyboard interaction for any interactive child elements (like `<button>`) within it, because the default action of triggering a `click` event is prevented when the event bubbles up.
**Action:** Always check `event.target` in parent `keydown` handlers. If the target is not the parent element itself (or if it's an interactive element that should handle its own keys), do not call `preventDefault()` or `stopPropagation()`.

## 2026-03-24 - Explicit Focus States for Custom Interactive Elements
**Learning:** Custom interactive elements (like `.row-handle` in `sliding_rows_flashcards`) that use generic `div` tags but act as buttons (`role="button"`, `tabindex="0"`) will not have default browser focus indicators, making them invisible to keyboard navigation users.
**Action:** Always manually define `:focus-visible` styles with a clear `outline` for any custom interactive components to ensure keyboard accessibility matches standard button behavior.

## 2026-03-24 - Visual Feedback on Async Buttons
**Learning:** Buttons triggering asynchronous network requests (like loading new data) without disabled states or loading indicators cause user confusion and can lead to duplicate requests. Users may not realize their action was registered, especially on slow connections.
**Action:** Always add explicit loading states (disabling the button, updating text, and using `aria-busy="true"`) to buttons during async operations, and ensure proper styling for the `:disabled` state (like reduced opacity and `cursor: not-allowed`).
