# API HANDLER GUIDE

## OVERVIEW

All HTTP contracts for public photos/guestbook and admin actions live here.

## ROUTES

| Route                                     | File                                         | Notes                                  |
| ----------------------------------------- | -------------------------------------------- | -------------------------------------- |
| `GET/POST /api/guestbook`                 | `app/api/guestbook/route.ts`                 | Validation + Supabase fallback         |
| `GET /api/photos`                         | `app/api/photos/route.ts`                    | Cursor paging + date filters + summary |
| `GET /api/photos/highlights`              | `app/api/photos/highlights/route.ts`         | Featured/highlight feed                |
| `GET/POST /api/photos/[photoId]/comments` | `app/api/photos/[photoId]/comments/route.ts` | Per-photo comments                     |
| `POST /api/admin/auth`                    | `app/api/admin/auth/route.ts`                | Admin login cookie issue               |
| `GET /api/admin/session`                  | `app/api/admin/session/route.ts`             | Session check                          |
| `POST /api/admin/logout`                  | `app/api/admin/logout/route.ts`              | Session clear                          |
| `POST /api/admin/upload`                  | `app/api/admin/upload/route.ts`              | Multipart upload + DB record           |
| `PATCH /api/admin/photos/[photoId]`       | `app/api/admin/photos/[photoId]/route.ts`    | Featured toggle/rank                   |

## CONTRACT CONVENTIONS

- Responses use `NextResponse.json`.
- Client-facing error messages are Korean.
- Public endpoints support fallback behavior when Supabase is unavailable.
- Admin mutation endpoints require verified admin session token.

## ANTI-PATTERNS

- Never skip `verifyAdminSessionToken` on `/api/admin/*` write paths.
- Never return raw internal error objects or secrets.
- Never break cursor format `takenAt|id` on photos list without consumer update.

## CHECKLIST BEFORE CHANGING

- Validate query/body parsing and status codes.
- Preserve cache headers on photos/highlights handlers.
- Keep fallback path behavior explicitly tested or manually verified.
