# COMPONENTS UI GUIDE

## OVERVIEW

Reusable client-facing UI surfaces: app shell, gallery/guestbook sections, landing blocks, and admin console.

## COMPONENT GROUPS

| Group            | Files                                                                      | Notes                                            |
| ---------------- | -------------------------------------------------------------------------- | ------------------------------------------------ |
| Shell/navigation | `components/app-shell.tsx`                                                 | Sticky top bar + bottom tab nav + cover card     |
| Photos UI        | `components/gallery-section.tsx`, `components/landing-*`                   | Grouped gallery and landing storytelling modules |
| Guestbook UI     | `components/guestbook-section.tsx`, `components/landing-guestbook-cta.tsx` | Form/list state + CTA surface                    |
| Admin UI         | `components/admin-console.tsx`                                             | Auth, queue progress, retries, featured toggle   |

## CONVENTIONS

- Keep IO in routes; components call API endpoints, not Supabase directly.
- Use tokens from `app/globals.css` (`--color-*`, `--radius-*`, `--tap-min`).
- Respect reduced-motion and intro gating helpers from `lib/ui/*`.
- Maintain Korean-first UX copy and explicit status messages.

## ANTI-PATTERNS

- Do not hardcode new color/radius values in isolated components.
- Do not duplicate upload queue logic; use `lib/admin/upload-queue.ts` helpers.
- Do not bypass shared shell for `/photos` and `/guestbook` pages.
