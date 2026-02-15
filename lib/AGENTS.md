# LIB DOMAIN GUIDE

## OVERVIEW

`lib/` holds domain logic and integration boundaries consumed by routes/components.

## SUBDOMAINS

| Domain    | Path             | Responsibility                                           |
| --------- | ---------------- | -------------------------------------------------------- |
| Gallery   | `lib/gallery/`   | Photo models, grouping, highlights, repository, comments |
| Guestbook | `lib/guestbook/` | Guestbook validation + repository contract               |
| Admin     | `lib/admin/`     | Session token + upload queue state helpers               |
| Supabase  | `lib/supabase/`  | Server client factory                                    |
| UI utils  | `lib/ui/`        | Motion/scroll/intro utility helpers                      |

## CONVENTIONS

- Keep transport shape mapping inside repositories (`repository.ts`).
- Keep type declarations in nearby `types.ts`.
- Keep pure helpers side-effect free unless module purpose is state/session.
- Tests are colocated as `*.test.ts` for most domain helpers.

## ANTI-PATTERNS

- Do not import `next/*` into pure domain helper modules unless unavoidable.
- Do not call Supabase directly from components; route handlers own IO boundaries.
- Do not mix presentation copy with domain transformation logic.
