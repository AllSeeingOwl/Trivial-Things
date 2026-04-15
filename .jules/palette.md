## 2024-04-12 - [Improve Accessibility of Loading and Error States in WidgetCard]
**Learning:** Next.js skeletons and error UI states inside interactive dashboard components often lack critical ARIA attributes (like `role="status"` or `role="alert"`), preventing screen readers from understanding dynamic widget states during ISR re-fetches.
**Action:** Always verify that dynamically injected or swapped UI states (like error fallbacks and skeletons) are assigned proper ARIA roles (`alert`, `status`) and `aria-live` attributes to maintain accessibility context.

## 2024-04-13 - [Improve Empty States Accessibility and Experience]
**Learning:** When displaying decorative elements like emojis in empty states (e.g., 🏗️), they must be hidden from screen readers using `aria-hidden="true"` to prevent confusing readouts. Additionally, an empty state is an opportunity to guide the user back to content, rather than leaving them at a dead end without interactive navigation elements.
**Action:** Always verify that empty state placeholders include an accessible and interactive way out (such as a call-to-action button or link) and ensure any decorative characters are properly hidden from assistive technologies.

## 2024-04-15 - [Add Skip to Content Link in Main Layout]
**Learning:** Single Page Applications (SPAs) and layouts with fixed or prominent headers often trap screen reader and keyboard users. A "Skip to main content" link must be implemented early in the DOM tree, visually hidden by default, but revealed upon focus, directing users strictly to the primary interactive container.
**Action:** Always include a `href="#main-content"` skip link right after the `<body>` tag, and ensure the target main container has `id="main-content"` and `tabIndex={-1}` to accept programmatic focus without affecting natural tab order.
