# PROJECT KNOWLEDGE BASE

**Generated:** 2026-02-14
**Commit:** d2e057d
**Branch:** main

## OVERVIEW

Mobile-first family album on Next.js App Router. Core domains: photo feed/highlights/comments, guestbook, and admin upload/session.

## STRUCTURE

```text
luda-album/
├── app/                # App Router pages + API handlers
├── components/         # Client/UI surfaces (shell, gallery, guestbook, admin)
├── lib/                # Domain and integration logic
├── docs/               # Product plans + DB schema
└── public/             # Local image assets + fonts
```

## WHERE TO LOOK

| Task                         | Location                                                                                     | Notes                                          |
| ---------------------------- | -------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Photos page UX               | `app/photos/page.tsx`, `components/app-shell.tsx`                                            | Shell + hero + grouped gallery entrypoint      |
| Photo API paging/filtering   | `app/api/photos/route.ts`                                                                    | Query parsing, cursor, fallback, cache headers |
| Featured/highlights logic    | `app/api/photos/highlights/route.ts`, `lib/gallery/repository.ts`                            | Featured rank + fallback ordering              |
| Guestbook API + validation   | `app/api/guestbook/route.ts`, `lib/guestbook/*`                                              | Input validation + Supabase fallback           |
| Admin auth/session           | `app/api/admin/auth/route.ts`, `app/api/admin/session/route.ts`, `lib/admin/session.ts`      | Cookie token lifecycle                         |
| Admin upload pipeline        | `app/api/admin/upload/route.ts`, `components/admin-console.tsx`, `lib/admin/upload-queue.ts` | Multipart upload + progress + retry            |
| Photo comments               | `app/api/photos/[photoId]/comments/route.ts`, `lib/gallery/comment-*`                        | Per-photo comment list/create                  |
| Gallery grouping/time labels | `lib/gallery/grouping.ts`, `lib/gallery/time.ts`                                             | Month buckets + Korean labels                  |
| Design tokens/global motion  | `app/globals.css`, `lib/ui/motion-config.ts`                                                 | Tokenized color/space/radius + reduced motion  |

## CODE MAP

| Symbol                            | Type          | Location                       | Role                                  |
| --------------------------------- | ------------- | ------------------------------ | ------------------------------------- |
| `RootLayout`                      | component     | `app/layout.tsx`               | Global metadata/font/body root        |
| `GET (photos)`                    | route handler | `app/api/photos/route.ts`      | Main photo listing contract           |
| `listPhotosPageFromDatabase`      | function      | `lib/gallery/repository.ts`    | Cursor paging + summary from Supabase |
| `listPhotoHighlightsFromDatabase` | function      | `lib/gallery/repository.ts`    | Featured + highlights composition     |
| `createGalleryImageRecord`        | function      | `lib/gallery/repository.ts`    | Upload metadata insert path           |
| `AppShell`                        | component     | `components/app-shell.tsx`     | Mobile app-like header/nav shell      |
| `AdminConsole`                    | component     | `components/admin-console.tsx` | Admin auth/upload/featured UI         |

## CONVENTIONS

- `app/api/**/route.ts` handlers use `NextResponse.json` and return Korean error copy.
- Supabase may be absent locally; routes provide static/in-memory fallback instead of hard failure.
- Shared import alias is `@/*` from project root (`tsconfig.json`).
- Tests are colocated as `*.test.ts` under `lib/**` (Vitest).
- Global visual system uses CSS custom properties in `app/globals.css`.

## ANTI-PATTERNS (THIS PROJECT)

- Do not bypass `verifyAdminSessionToken` for any `/api/admin/*` mutation route.
- Do not call Supabase directly from UI components; route handlers + `lib/*` repositories are the boundary.
- Do not remove fallback behavior (`createServerSupabaseClient() === null`) from public routes without replacing UX path.
- Do not introduce non-token colors/radii into core UI; extend `:root` tokens first.
- Do not change photo cursor format (`takenAt|id`) without updating both API and consumers.

## UNIQUE STYLES

- Korean-first user-facing copy, including errors and status labels.
- Mobile-first tap targets (`--tap-min`, bottom-safe nav) are enforced in shell/components.
- Feature design recorded in `docs/plans/*`; implementation should trace back to those notes.

## COMMANDS

```bash
npm run dev
npm run test
npm run lint
npm run build
```

## NOTES

- Critical envs for full flow: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_STORAGE_BUCKET`, `GALLERY_PHOTOS_TABLE`, `ADMIN_UPLOAD_PASSWORD`, `ADMIN_SESSION_SECRET`.
- Untracked planning assets may exist (`SPEC.md`, `docs/plans/`, `public/Paperlogy/`); check before committing.
