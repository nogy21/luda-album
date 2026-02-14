# Luda Album Production UI Upgrade Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Upgrade `/photos`, `/guestbook`, `/admin` to production-grade mobile UI/UX with stronger hierarchy, clearer actions, and reliable upload/feedback flows.

**Architecture:** Keep App Router + route-level sections, but centralize visual tokens in `app/globals.css`, reuse shared action/card patterns in component-level markup, and isolate upload reliability logic into small pure utilities that are testable. Use Motion (`motion/react`) for standard transitions and GSAP only for two designated wow moments.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind CSS v4, Motion (`motion/react`), GSAP, Vitest.

---

### Task 1: Theme Tokens and Shell Hierarchy Baseline

**Files:**
- Modify: `app/globals.css`
- Modify: `components/app-shell.tsx`
- Test: `lib/ui/motion-config.test.ts`

**Step 1: Add/normalize new color system tokens and interaction tokens**

Update CSS variables to match new palette:
- Primary `#E96A8D`
- Background `#FFF9F5`
- Text `#1F1720`
- Subtext `#6B5A63`
- Border `#F0DDE4`

Also normalize radius/shadow/space/tap/focus tokens.

**Step 2: Refresh app shell hierarchy**

Improve header/title/meta hierarchy and active-tab feedback while preserving mobile-safe area behavior.

**Step 3: Keep standard transitions on Motion**

Ensure section reveals use shared `buildSoftRevealTransition`.

**Step 4: Verify**

Run: `npm run test -- lib/ui/motion-config.test.ts`

**Step 5: Commit**

```bash
git add app/globals.css components/app-shell.tsx
git commit -m "design: apply new brand tokens and shell hierarchy baseline"
```

### Task 2: `/photos` Storytelling Hero + Monthly Metadata + GSAP Wow Points

**Files:**
- Modify: `components/app-shell.tsx`
- Modify: `components/gallery-section.tsx`
- Modify: `lib/gallery/grouping.ts`
- Modify: `lib/gallery/grouping.test.ts`
- Create: `lib/ui/hero-intro.ts`
- Create: `lib/ui/hero-intro.test.ts`
- Install: `gsap`

**Step 1: Write failing tests**

- Add month-group metadata assertions (`latestTakenAt`, `updatedLabel`) in `lib/gallery/grouping.test.ts`
- Add first-visit hero intro gate tests in `lib/ui/hero-intro.test.ts`

**Step 2: Run tests to verify RED**

Run:
- `npm run test -- lib/gallery/grouping.test.ts`
- `npm run test -- lib/ui/hero-intro.test.ts`

**Step 3: Implement minimal logic**

- Extend month grouping metadata
- Implement first-visit gate utility for session storage key

**Step 4: Refactor `/photos` visuals and motion**

- Story-driven hero copy with one primary CTA + one secondary action
- Monthly archive cards with count + latest update metadata
- GSAP hero intro (first visit only, subtle stagger)
- GSAP “용돈 주세요” burst tap effect (<= 600ms)

**Step 5: Verify**

Run: `npm run test -- lib/gallery/grouping.test.ts lib/ui/hero-intro.test.ts`

**Step 6: Commit**

```bash
git add components/app-shell.tsx components/gallery-section.tsx lib/gallery/grouping.ts lib/gallery/grouping.test.ts lib/ui/hero-intro.ts lib/ui/hero-intro.test.ts package.json package-lock.json
git commit -m "feat: upgrade photos storytelling flow with scoped gsap moments"
```

### Task 3: `/guestbook` Form States and Async Feedback UX

**Files:**
- Modify: `components/guestbook-section.tsx`

**Step 1: Implement explicit submit states**

Add `idle/posting/success/error` UI semantics and clear async status copy.

**Step 2: Improve form/message readability**

Refine spacing, typography, and card metadata readability for older family users.

**Step 3: Harden accessibility feedback**

Use explicit `aria-live` regions for fetch and submit feedback.

**Step 4: Verify**

Run: `npm run lint -- components/guestbook-section.tsx`

**Step 5: Commit**

```bash
git add components/guestbook-section.tsx
git commit -m "feat: improve guestbook state feedback and readability"
```

### Task 4: `/admin` Reliability Upload Flow (Progress + Retry)

**Files:**
- Create: `app/admin/page.tsx`
- Create: `components/admin-console.tsx`
- Create: `app/api/admin/session/route.ts`
- Create: `app/api/admin/auth/route.ts`
- Create: `app/api/admin/logout/route.ts`
- Create: `app/api/admin/upload/route.ts`
- Create: `lib/admin/session.ts`
- Create: `lib/admin/upload-queue.ts`
- Create: `lib/admin/upload-queue.test.ts`

**Step 1: Write failing tests for upload queue utility**

Test per-file progress update, total progress math, retry candidate extraction.

**Step 2: Run test to verify RED**

Run: `npm run test -- lib/admin/upload-queue.test.ts`

**Step 3: Implement minimal upload queue utility**

Pure functions for state update and summary generation.

**Step 4: Implement auth/session/upload routes**

Cookie-based admin session + multipart upload to Supabase Storage when configured, with per-file success/failure payload.

**Step 5: Implement admin console UI**

Per-file and overall progress bars, partial failure list, retry failed files.

**Step 6: Verify**

Run: `npm run test -- lib/admin/upload-queue.test.ts`

**Step 7: Commit**

```bash
git add app/admin/page.tsx components/admin-console.tsx app/api/admin/session/route.ts app/api/admin/auth/route.ts app/api/admin/logout/route.ts app/api/admin/upload/route.ts lib/admin/session.ts lib/admin/upload-queue.ts lib/admin/upload-queue.test.ts
git commit -m "feat: add reliability-first admin upload flow with progress and retry"
```

### Task 5: Final Verification and Requirement Traceability

**Files:**
- Modify: `README.md`
- Modify: `docs/plans/2026-02-14-production-ui-upgrade-implementation.md` (checklist footer)

**Step 1: Run full verification**

Run:
- `npm run test`
- `npm run lint`
- `npm run build`

**Step 2: Add short migration note**

Document what changed and why in `README.md`.

**Step 3: Add completed-requirements checklist**

Map delivered features to requested requirements.

**Step 4: Commit**

```bash
git add README.md docs/plans/2026-02-14-production-ui-upgrade-implementation.md
git commit -m "docs: add migration notes and delivery checklist"
```

---

## Delivery Checklist (Completed)

- [x] Updated design tokens and theme colors to requested palette
- [x] Refactored `/photos` with storytelling hero, CTA hierarchy, monthly metadata
- [x] Refactored `/guestbook` with explicit submit states and aria-live feedback
- [x] Implemented `/admin` reliability upload UX (per-file + total progress, retry failed)
- [x] Applied Framer Motion for standard transitions
- [x] Applied GSAP only for requested wow points
- [x] Added migration note in `README.md`
