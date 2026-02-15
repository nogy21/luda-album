# GALLERY DOMAIN GUIDE

## OVERVIEW

Gallery domain owns photo models, grouping/label logic, repository IO mapping, highlights, and comment helpers.

## WHERE TO LOOK

| Task                               | File                                                   |
| ---------------------------------- | ------------------------------------------------------ |
| Static image seed + metadata       | `lib/gallery/images.ts`                                |
| DB row <-> domain mapping + paging | `lib/gallery/repository.ts`                            |
| Month grouping + labels            | `lib/gallery/grouping.ts`, `lib/gallery/time.ts`       |
| Featured/highlight selection       | `lib/gallery/featured.ts`                              |
| Landing memory selection           | `lib/gallery/landing.ts`                               |
| Photo comment domain               | `lib/gallery/comment-*`                                |
| Shared types                       | `lib/gallery/types.ts`, `lib/gallery/comment-types.ts` |

## CONVENTIONS

- Keep repository transport fields snake_case only at DB boundary.
- Convert to camelCase domain models before returning to routes/UI.
- `PhotoVisibility` defaults to `family` unless explicitly admin.
- Cursor encoding format is `takenAt|id` and is consumed by API/UI.
- Keep time/label formatting in dedicated helpers (`time.ts`) not UI files.

## TESTING

- Tests are colocated (`*.test.ts`) for repository, grouping, comments, landing, tags, featured.
- Prefer behavior tests around ordering, fallback, and mapping stability.

## ANTI-PATTERNS

- Do not duplicate row-to-domain mapping logic outside repository.
- Do not embed Korean copy labels directly in repository data transforms unless intentionally domain-owned.
- Do not change cursor or summary shape without updating route contracts.
