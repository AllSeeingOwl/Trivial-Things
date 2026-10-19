## 2024-04-12 - [Improve Accessibility of Loading and Error States in WidgetCard]
**Learning:** Next.js skeletons and error UI states inside interactive dashboard components often lack critical ARIA attributes (like `role="status"` or `role="alert"`), preventing screen readers from understanding dynamic widget states during ISR re-fetches.
**Action:** Always verify that dynamically injected or swapped UI states (like error fallbacks and skeletons) are assigned proper ARIA roles (`alert`, `status`) and `aria-live` attributes to maintain accessibility context.

## 2024-04-13 - [Improve Empty States Accessibility and Experience]
**Learning:** When displaying decorative elements like emojis in empty states (e.g., 🏗️), they must be hidden from screen readers using `aria-hidden="true"` to prevent confusing readouts. Additionally, an empty state is an opportunity to guide the user back to content, rather than leaving them at a dead end without interactive navigation elements.
**Action:** Always verify that empty state placeholders include an accessible and interactive way out (such as a call-to-action button or link) and ensure any decorative characters are properly hidden from assistive technologies.

## 2024-04-15 - [Add Skip to Content Link in Main Layout]
**Learning:** Single Page Applications (SPAs) and layouts with fixed or prominent headers often trap screen reader and keyboard users. A "Skip to main content" link must be implemented early in the DOM tree, visually hidden by default, but revealed upon focus, directing users strictly to the primary interactive container.
**Action:** Always include a `href="#main-content"` skip link right after the `<body>` tag, and ensure the target main container has `id="main-content"` and `tabIndex={-1}` to accept programmatic focus without affecting natural tab order.

## 2024-04-18 - [Ensure Keyboard Accessibility for Native Tooltips]
**Learning:** Native `title` tooltips placed on non-interactive elements (like `<span>` or `<div>` badges) are completely inaccessible to keyboard-only users who cannot trigger mouse hover states.
**Action:** Always verify that status badges or decorative elements utilizing native tooltips also include `tabIndex={0}`, an appropriate explicit role (e.g., `role="status"`), a descriptive `aria-label`, and `focus-visible` CSS rules to ensure they can be reached, focused, and read by screen readers or keyboard navigators.
## 2024-04-23 - [Group Filter Navigation under Header Details]
**Learning:** In Next.js dashboard applications with prominent titles and subtitles, placing structural navigation elements (like Category filters) directly below the title block, rather than floating them independently, creates a stronger visual hierarchy. Changing the flex alignment of the header from `items-end` to `items-start` keeps secondary metadata badges anchored neatly out of the flow of the primary content navigation.
**Action:** Always group related hierarchical navigation elements beneath their descriptive context. Ensure secondary elements like status badges are aligned to the `start` of flex containers if their sibling items have highly variable heights due to wrapping.

## 2026-10-10 - [Accessible Focus States and Screen Reader Labeling on Header Navigation Links]
**Learning:** Decorative unicode arrow indicators in navigation links (e.g., `← Back to Central Portal`) are often read aloud literally by screen readers (e.g. "leftwards arrow Back to Central Portal"), and header navigation links can easily miss explicit `focus-visible` ring styles.
**Action:** Wrap decorative directional arrows in `<span aria-hidden="true">`, provide an explicit `aria-label`, and ensure `focus-visible:ring-2` styles match the rest of the application's interactive controls.

## 2026-10-11 - [Empty Data State Accessibility in Dashboard Widgets]
**Learning:** When dashboard widgets fetch empty data arrays (0 items) without erroring, rendering an empty list container leaves screen reader users in the dark. Providing a explicit empty fallback with `role="status"`, a decorative icon marked `aria-hidden="true"`, and descriptive text ensures clear feedback across assistive technologies.
**Action:** Always implement explicit empty state fallbacks in list/card components when item arrays are empty, assigning `role="status"` to notify screen readers dynamically.

## 2026-10-12 - [Central Portal Accessibility and Focus Visibility]
**Learning:** Standalone HTML portals and landing pages often omit primary landmark elements (`<main>`), skip links, and ARIA modal attributes on loading overlays, impairing keyboard navigation flow and screen reader context.
**Action:** Always verify that landing page portals include a `<main id="main-content" tabindex="-1">` wrapper, a top-level skip link, explicit `focus-visible` ring utilities on interactive cards, and `role="dialog"` attributes on overlay popups.

## 2026-10-13 - [Inline Form Feedback over Blocking Alerts for Screen Reader Focus Context]
**Learning:** Using native browser `alert()` popups for form submission status breaks user flow and steals window focus without allowing screen readers to easily re-focus or navigate back to invalid form inputs. Inline feedback containers with `role="status"` and `aria-live="polite"` dynamically announce success/error messages to assistive technologies while preserving keyboard focus within the form.
**Action:** Always replace `alert()` calls on AJAX form submissions with inline status containers configured with `role="status"` and `aria-live="polite"`.

## 2026-10-14 - [Dynamic Coordinate Labeling for Interactive Grid Cells]
**Learning:** Interactive grid cells with generic masked labels (e.g., "Word 1-1") leave screen reader users without spatial coordinate context. Providing initial `aria-label`s with explicit row and column positions ("Reveal word at row 1, column 1") and updating `aria-label` dynamically upon cell reveal ("CAT, row 1, column 1") provides clear assistive feedback during keyboard grid navigation.
**Action:** Always assign explicit row/column coordinate information in `aria-label` attributes when creating or updating interactive grid cell elements in board/grid games.

## 2026-10-15 - [Screen Reader Context and Keyboard Navigability in Reference Data Cards]
**Learning:** Dynamically rendering list or grid cards (such as element reference cards) without explicit ARIA labels can force screen readers to read fragmented numbers and strings out of context. Providing structured `aria-label` descriptions alongside keyboard focusability (`tabindex="0"`, focus rings) ensures seamless screen reader and keyboard accessibility.
**Action:** Always attach comprehensive `aria-label` attributes and keyboard focus management (`tabindex="0"`, `focus:ring-2`) to reference and data cards.

## 2026-10-16 - [Keyboard Accessibility and Modal Focus Management for Dynamically Rendered Calendar Events]
**Learning:** Dynamically injected interactive event elements (like calendar event bars) created as `<div>` tags are omitted from tab ordering and keyboard interaction unless explicitly given `role="button"`, `tabindex="0"`, descriptive `aria-label`s, and `keydown` event listeners for Enter/Space keys. Additionally, opening action modals (such as event deletion dialogs) requires shifting focus directly to a modal focus target to maintain keyboard context.
**Action:** Always assign `role="button"`, `tabindex="0"`, `focus:ring-2` focus rings, and `keydown` listeners to interactive dynamic elements, and programmatically shift focus into dialogs when opened.
