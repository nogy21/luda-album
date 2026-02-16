# ADMIN API GUIDE

## OVERVIEW

Admin endpoints handle authentication, session lifecycle, upload mutations, and featured-photo updates.

## ROUTES

| Route                               | File                                      | Guard                        |
| ----------------------------------- | ----------------------------------------- | ---------------------------- |
| `POST /api/admin/auth`              | `app/api/admin/auth/route.ts`             | Checks admin password/config |
| `GET /api/admin/session`            | `app/api/admin/session/route.ts`          | Session token verification   |
| `POST /api/admin/logout`            | `app/api/admin/logout/route.ts`           | Session cookie clear         |
| `POST /api/admin/upload`            | `app/api/admin/upload/route.ts`           | Requires valid admin session |
| `GET /api/admin/photos`             | `app/api/admin/photos/route.ts`           | Requires valid admin session |
| `GET /api/admin/events`             | `app/api/admin/events/route.ts`           | Requires valid admin session |
| `PATCH /api/admin/photos/[photoId]` | `app/api/admin/photos/[photoId]/route.ts` | Requires valid admin session |
| `DELETE /api/admin/photos/[photoId]`| `app/api/admin/photos/[photoId]/route.ts` | Requires valid admin session |
| `GET/POST/DELETE /api/admin/pwa-branding` | `app/api/admin/pwa-branding/route.ts` | Requires valid admin session |

## BOUNDARY RULES

- Auth/session boundary is centralized in `lib/admin/session.ts`.
- All write operations verify `verifyAdminSessionToken` before mutating data.
- Upload route requires Supabase availability; returns 503 when unavailable.
- Error payloads are user-safe Korean messages.

## ANTI-PATTERNS

- Never allow `/api/admin/*` mutation without session-token check.
- Never leak raw stack traces or secrets in JSON errors.
- Never bypass repository helpers for gallery writes.
