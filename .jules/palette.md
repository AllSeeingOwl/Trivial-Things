## 2026-03-30 - Disable Choice Buttons Upon Selection
**Learning:** Preventing double clicks/submissions by applying an immediate disabled state (both functionally with `disabled=true` and visually with `cursor: not-allowed` and reduced opacity) provides a crucial interaction improvement that signals to the user their choice has been registered.
**Action:** When implementing MCQ or interactive choice logic, ensure all siblings/related options are disabled immediately upon the first user interaction to improve interaction clarity and prevent duplicate network/state requests.
## 2026-04-02 - Destructive Action Confirmation & Async Feedback
**Learning:** Destructive actions like "Reset All" must always have user confirmation to prevent accidental loss of progress. Furthermore, tying async operations to explicit UI feedback (disabling buttons, changing text to "Resetting...", updating `aria-busy`) prevents double-submissions and gives the user clarity that their action is being processed.
**Action:** Always implement a `confirm()` dialog for resets/deletes, and visually/functionally disable the trigger button while the backend request is in flight.

## 2026-04-05 - Use Empty States for Completion States
**Learning:** Handling positive completion states (like finishing a deck of flashcards) with generic error messages (red text, `role="alert"`) creates an alarming and negative user experience. Users need to feel rewarded when they finish a task.
**Action:** When a user completes all available items or exhausts a list, replace the error alert with a dedicated, visually pleasing `#empty-state` container featuring a success message and a clear call-to-action to restart or continue.
