## 2024-04-12 - [Improve Accessibility of Loading and Error States in WidgetCard]
**Learning:** Next.js skeletons and error UI states inside interactive dashboard components often lack critical ARIA attributes (like `role="status"` or `role="alert"`), preventing screen readers from understanding dynamic widget states during ISR re-fetches.
**Action:** Always verify that dynamically injected or swapped UI states (like error fallbacks and skeletons) are assigned proper ARIA roles (`alert`, `status`) and `aria-live` attributes to maintain accessibility context.
