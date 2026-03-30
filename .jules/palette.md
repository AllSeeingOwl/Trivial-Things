## 2026-03-30 - Disable Choice Buttons Upon Selection
**Learning:** Preventing double clicks/submissions by applying an immediate disabled state (both functionally with `disabled=true` and visually with `cursor: not-allowed` and reduced opacity) provides a crucial interaction improvement that signals to the user their choice has been registered.
**Action:** When implementing MCQ or interactive choice logic, ensure all siblings/related options are disabled immediately upon the first user interaction to improve interaction clarity and prevent duplicate network/state requests.
