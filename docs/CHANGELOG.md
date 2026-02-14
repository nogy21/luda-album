# Changelog

## 2026-02-15 - Overnight UI/UX polish

- Refined `/photos` first screen to reduce above-the-fold dead space and show both hero intent and next-section preview immediately.
- Reworked CTA hierarchy with one clear primary action (`이번 달 사진 보기`) and softened secondary action (`다른 순간 보기`) for clearer decision flow.
- Updated Korean microcopy across hero/gallery async states for more polished, concise, family-friendly tone.
- Added new-photo update bottom sheet on `/photos` with daily exposure guard and dismiss snooze behavior (24h) to improve perceived freshness without alert fatigue.
- Tightened visual system tokens in `app/globals.css` to the product palette (`#E96A8D / #FFF9F5 / #1F1720 / #6B5A63 / #F0DDE4`) and strengthened bottom tab active affordance.
- Preserved subtle motion and accessibility: transform/opacity-first transitions, reduced-motion respect, `aria-current` on active tab, improved labels, and clearer loading/error readability.

### Why this changed

- Improve first 3-second clarity on mobile.
- Make photo browsing feel emotionally premium while keeping interaction costs low.
- Keep the UI system maintainable with token-driven, reusable updates instead of one-off styling.
