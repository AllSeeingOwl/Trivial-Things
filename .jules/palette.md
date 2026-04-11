## 2026-03-30 - Disable Choice Buttons Upon Selection
**Learning:** Preventing double clicks/submissions by applying an immediate disabled state (both functionally with `disabled=true` and visually with `cursor: not-allowed` and reduced opacity) provides a crucial interaction improvement that signals to the user their choice has been registered.
**Action:** When implementing MCQ or interactive choice logic, ensure all siblings/related options are disabled immediately upon the first user interaction to improve interaction clarity and prevent duplicate network/state requests.
## 2026-04-02 - Destructive Action Confirmation & Async Feedback
**Learning:** Destructive actions like "Reset All" must always have user confirmation to prevent accidental loss of progress. Furthermore, tying async operations to explicit UI feedback (disabling buttons, changing text to "Resetting...", updating `aria-busy`) prevents double-submissions and gives the user clarity that their action is being processed.
**Action:** Always implement a `confirm()` dialog for resets/deletes, and visually/functionally disable the trigger button while the backend request is in flight.

## 2026-04-05 - Use Empty States for Completion States
**Learning:** Handling positive completion states (like finishing a deck of flashcards) with generic error messages (red text, `role="alert"`) creates an alarming and negative user experience. Users need to feel rewarded when they finish a task.
**Action:** When a user completes all available items or exhausts a list, replace the error alert with a dedicated, visually pleasing `#empty-state` container featuring a success message and a clear call-to-action to restart or continue.

## 2026-04-08 - SPA Focus Management on Screen Transition
**Learning:** In Single Page Applications, transitioning between virtual 'screens' by simply toggling display classes causes keyboard focus to drop to the `<body>` element. This is a severe accessibility issue because screen readers do not announce the new content, leaving users lost.
**Action:** When swapping virtual screens, always query the newly active container for its main heading (`<h1>`, `<h2>`, `<h3>`), add `tabindex="-1"`, and programmatically call `.focus()` on it. This forces screen readers to announce the new context and provides a logical starting point for keyboard navigation.

## 2026-04-09 - Handle Native Dialogs in Playwright Tests
**Learning:** When using Playwright to test frontend interactions that trigger native browser dialogs (like `alert()` or `confirm()`), the script will hang indefinitely if these dialogs are not handled.
**Action:** Always explicitly attach a dialog handler (e.g., `page.on("dialog", lambda dialog: dialog.accept())`) before triggering actions that spawn native browser dialogs during automated tests.

## 2024-04-11 - Navigation Accessibility in Next.js Filter Buttons
**Learning:** When using Next.js `Link` components as filter buttons mapped over categories, they often lack proper semantic grouping and active state announcement for screen readers. Since they act as a sub-navigation rather than standalone actions, wrapping them in a `<nav aria-label="Category filters">` significantly improves context.
**Action:** Always wrap filter link groups in `<nav>` elements with descriptive `aria-label`s, and explicitly set `aria-current="page"` (or `"true"`) on the active link based on the current pathname so screen readers correctly identify the selected state among alternatives. Add clear `focus-visible` styling for keyboard users since default link focus rings might clash with rounded button designs.
