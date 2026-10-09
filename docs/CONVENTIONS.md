# College Management — Conventions

Incremental standards for the Express API and React frontend. Existing code is migrated over time; new code should follow these rules.

## API responses

| Case | Status | Body |
|------|--------|------|
| Success (read/update) | 200 | Raw JSON entity or array |
| Success (create) | 201 | Created entity |
| Success (delete) | 204 | Empty |
| Client/server error | 4xx/5xx | `{ message, code?, details? }` |
| Health | 200/503 | `{ status, db? }` |

**Exceptions (intentional):**

- Auth login: `{ token, user }`
- Password-reset flows: `{ success, message, resetId? }` (anti-enumeration)
- Chatbot tool results (internal): `{ success, message, ... }` — not exposed as separate HTTP per tool

Do not wrap successful REST payloads in `{ data: ... }`.

## Errors

- Services throw `Error` with `status` (400–503). Prefer `createHttpError` from `backend/src/utils/httpError.js`.
- Optional: `code` (machine-readable), `details` (validation field map).
- Controllers: `try/catch` → `next(err)` only (no duplicate logging except debug).
- `errorHandler` maps Mongoose validation/cast/duplicate-key errors to 400/409.

## Validation

- No Joi/Zod layer yet; validate in services or domain modules (`booking/bookingValidation.js`, etc.).
- Shared helpers: `backend/src/utils/validation.js` (`validateDateOnly`, `validateObjectId`).
- Throw `badRequest("…")` for invalid input before DB calls.

## Services

- One exported function per use case; named exports.
- Accept `{ orgId, user, payload }` style context objects where multiple params are needed.
- Return lean Mongoose documents or plain objects; avoid mixing `{ success }` envelopes in REST services (chat/password-reset only).
- Email failures: log with `createLogger(module).error` and do not fail the main operation unless critical.

## Logging

- Use `createLogger("ModuleName")` from `backend/src/utils/logger.js`.
- Levels: `error` (failures), `warn` (degraded), `info` (lifecycle), `debug` (verbose, off in prod unless `LOG_LEVEL=debug`).
- HTTP access: morgan only.

## Naming

| Area | Convention |
|------|------------|
| Files | `camelCase` for services/controllers; domain folders (`booking/`, `workflows/`) for shared rules |
| Route params | `:orgId`, `:bookingId`, `:reqId`, `:ticketId`, `:utilityId` |
| Booking status | `snake_case` (`pending`, `hod_approved`) |
| Requisition/maintenance status | `SCREAMING_SNAKE` (`PENDING_HOD`) |
| RBAC | `requirePermission(PERMISSIONS.*)` — not role-only middleware |
| Roles | assistant, faculty, etc.; see User model enum |

## Frontend

- API client: `frontend/src/lib/api.ts`; errors via `getApiErrorMessage(error)` from `apiError.ts`.
- Backend error shape: `{ message, code?, details? }`.
- Only **401** is handled globally (session redirect); 403 → `Forbidden` route via `RequireAuth`.

## Shared utilities (backend)

| Module | Purpose |
|--------|---------|
| `utils/object.js` | `pick`, `toObjectIdOrNull` |
| `utils/escapeRegex.js` | Safe regex for user input |
| `utils/validation.js` | Dates, ObjectIds |
| `utils/httpError.js` | Typed HTTP errors |
| `utils/logger.js` | Namespaced logging |
