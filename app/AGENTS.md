# APP ROUTING GUIDE

## OVERVIEW

Contains App Router pages, global layout, and API route tree roots.

## STRUCTURE

```text
app/
├── layout.tsx        # Root HTML/body + global metadata/fonts
├── page.tsx          # Root route redirect/landing
├── photos/page.tsx   # Main photo surface
├── guestbook/page.tsx
├── admin/page.tsx
└── api/              # HTTP handlers
```

## WHERE TO LOOK

| Need                    | File                     |
| ----------------------- | ------------------------ |
| Root metadata/font/body | `app/layout.tsx`         |
| Photo experience route  | `app/photos/page.tsx`    |
| Guestbook route wrapper | `app/guestbook/page.tsx` |
| Admin console route     | `app/admin/page.tsx`     |
| API tree entry          | `app/api/**/route.ts`    |

## CONVENTIONS

- Route modules are `page.tsx`; API handlers are `route.ts`.
- User copy is Korean-first.
- Page-level data loading prefers server-side fetch with fallback-safe responses.

## ANTI-PATTERNS

- Do not place DB credentials or direct DB calls inside page components.
- Do not add non-API handlers under `app/api/**`.
- Do not bypass shell/navigation patterns for `/photos` and `/guestbook`.

## COMMANDS

```bash
npm run dev
npm run build
```
