# Mobile-First UI Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Improve the app to feel like a production mobile photo service by fixing sizing rhythm, visual hierarchy, and first-screen layout.

**Architecture:** Keep the existing AppShell -> CoverCard -> Gallery/Guestbook structure, but normalize spacing/typography tokens and rebuild first-screen composition around photos. Preserve existing data flow and APIs; focus on presentation-layer changes only.

**Tech Stack:** Next.js App Router, React 19, Tailwind CSS v4 utilities, CSS variables in `app/globals.css`, Next `Image`.

---

### Task 1: Define Mobile Baseline Tokens

**Files:**
- Modify: `app/globals.css`
- Reference: `components/app-shell.tsx`, `components/gallery-section.tsx`, `components/guestbook-section.tsx`

**Step 1: Create token map for mobile rhythm**

Add or normalize CSS custom properties for spacing and text tiers used across sections:

```css
:root {
  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-5: 1.25rem;
  --space-6: 1.5rem;
  --text-title: 1.2rem;
  --text-body: 0.95rem;
}
```

**Step 2: Add reduced-motion protection for hover transforms**

```css
@media (prefers-reduced-motion: reduce) {
  .motion-safe-scale {
    transform: none !important;
    transition: none !important;
  }
}
```

**Step 3: Run lint/diagnostics for stylesheet usage**

Run: `npx eslint "components/app-shell.tsx" "components/gallery-section.tsx" "components/guestbook-section.tsx"`

Expected: no new errors.

**Step 4: Commit**

```bash
git add app/globals.css
git commit -m "design: define mobile spacing and motion baseline tokens"
```

### Task 2: Rebuild Shell Proportions for Mobile Viewport

**Files:**
- Modify: `components/app-shell.tsx`

**Step 1: Normalize header + body + bottom-nav vertical rhythm**

Adjust shell spacing so first content row appears earlier and nav does not overtake viewport height on small screens.

**Step 2: Tighten max width behavior for phone-first rendering**

Keep desktop cap but prioritize mobile width consistency (`px`, `pt`, bottom safe-area padding, tap-size continuity).

**Step 3: Verify safe-area and target size**

Run checks at 360/390/430 widths and ensure all tappable controls remain >=44px height.

**Step 4: Run lint/diagnostics**

Run: `npx eslint "components/app-shell.tsx"`

Expected: no new errors.

**Step 5: Commit**

```bash
git add components/app-shell.tsx
git commit -m "design: rebalance mobile shell spacing and safe-area layout"
```

### Task 3: Photo-First Hero Redesign (Google Photos-Inspired)

**Files:**
- Modify: `components/app-shell.tsx`
- Reference: `lib/gallery/featured.ts`, `lib/gallery/images.ts`
- Test: `lib/gallery/featured.test.ts`

**Step 1: Keep deterministic first paint, optional shuffle action**

Use `getInitialFeaturedImages()` for initial render; keep `getShuffledFeaturedImages()` only as secondary action.

**Step 2: Rework first section composition**

Implement hierarchy:
- compact title row
- dominant lead tile + supporting tiles
- reduced caption density (only where needed)

**Step 3: Simplify decorative layers**

Remove unnecessary visual noise that competes with photos.

**Step 4: Validate deterministic logic remains correct**

Run: `npm run test -- lib/gallery/featured.test.ts`

Expected: tests pass.

**Step 5: Commit**

```bash
git add components/app-shell.tsx lib/gallery/featured.ts lib/gallery/featured.test.ts
git commit -m "design: shift hero to photo-first mobile collage layout"
```

### Task 4: Align Gallery Density and Information Hierarchy

**Files:**
- Modify: `components/gallery-section.tsx`
- Reference: `app/globals.css`

**Step 1: Rebalance section header weight**

Reduce over-emphasis from badges/labels; prioritize photo content blocks.

**Step 2: Normalize tile proportions and inter-card spacing**

Keep strong first tile but make rest visually consistent for mobile scanability.

**Step 3: Apply reduced-motion-safe hover behavior**

Use class-level guard (e.g., `motion-safe-scale`) so reduced-motion users avoid scaling transitions.

**Step 4: Keep month archive ergonomics**

Ensure accordion controls, load-more, and lightbox actions remain thumb-friendly.

**Step 5: Run lint/diagnostics**

Run: `npx eslint "components/gallery-section.tsx"`

Expected: no new errors.

**Step 6: Commit**

```bash
git add components/gallery-section.tsx app/globals.css
git commit -m "design: tune gallery density and mobile visual hierarchy"
```

### Task 5: Bring Guestbook Visual Language in Line

**Files:**
- Modify: `components/guestbook-section.tsx`

**Step 1: Harmonize typography and card density**

Match input, message card, and metadata sizing to the same mobile scale used by hero/gallery.

**Step 2: Keep accessibility behavior intact**

Retain `aria-live`, `role="alert"`, labels, and clear loading/error states while reducing visual clutter.

**Step 3: Fix autofill usability rule**

Set nickname `autocomplete` to a practical value (e.g., `name`) instead of `off`.

**Step 4: Run lint/diagnostics**

Run: `npx eslint "components/guestbook-section.tsx"`

Expected: no new errors.

**Step 5: Commit**

```bash
git add components/guestbook-section.tsx
git commit -m "design: align guestbook UI with mobile-first visual system"
```

### Task 6: Final QA, Accessibility, and Build Verification

**Files:**
- Verify: `components/app-shell.tsx`, `components/gallery-section.tsx`, `components/guestbook-section.tsx`, `app/globals.css`

**Step 1: Run diagnostics on changed files**

Use LSP diagnostics for all modified files.

Expected: zero errors.

**Step 2: Run test suite**

Run: `npm run test`

Expected: all tests pass.

**Step 3: Run targeted lint and full build**

Run:

```bash
npx eslint "components/app-shell.tsx" "components/gallery-section.tsx" "components/guestbook-section.tsx"
npm run build
```

Expected: build succeeds with no regressions caused by redesign changes.

**Step 4: Manual mobile pass**

Check at 360x800, 390x844, 430x932:
- first screen composition
- bottom nav safe-area and overlap
- photo tile readability/crop quality
- guestbook form usability and input comfort

**Step 5: Commit verification snapshot**

```bash
git add -A
git commit -m "chore: verify mobile redesign stability and accessibility"
```
