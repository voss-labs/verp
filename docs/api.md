# API Documentation

## Overview

VERP exposes a small REST API for write-side academic operations. The API surface is intentionally minimal — most read paths in the dashboard go through React Server Components reading directly from the database via `src/db/queries/`, not through HTTP. Use this API when you need to mutate state from a client component or integrate from outside the app.

All requests and responses are JSON. Every mutation also writes an entry to the audit log (`src/db/schema/audit.ts`) capturing the actor, the target entity, and a JSONB details payload.

## Authentication

Most endpoints require an authenticated session. Sessions are managed by Better Auth and tokens are stored in HTTP-only cookies set by `/api/auth/sign-in/email` (or another sign-in sub-path). Session lookup happens via `getSessionUser()` in `src/lib/session.ts`.

Roles are `admin`, `faculty`, and `student`. Most write endpoints reject the `student` role outright; some are admin-only.

## CORS

`next.config.ts` opens CORS on `/api/*` for all origins (methods: GET, POST, PUT, PATCH, DELETE, OPTIONS). External integrations can call these endpoints directly with a valid session cookie.

## Response Format

Successful responses are wrapped:

```json
{ "data": { ... } }
```

Errors return a flat shape with the appropriate HTTP status code:

```json
{ "error": "Error message" }
```

Helpers `apiSuccess(data, status)` and `apiError(message, status)` in `src/lib/api-response.ts` produce these shapes.

> **Exception**: `GET /api/me` returns the user object directly without a `data` wrapper. See that endpoint's section below.

## Endpoints

### 1. `/api/auth/[...all]` (Better Auth)

Better Auth passthrough — handles sign-in, sign-up, sign-out, session retrieval, email verification, password reset, etc. via many sub-paths under this prefix. Both `GET` and `POST` are exported.

**Common sub-paths:**

- `POST /api/auth/sign-in/email` — sign in with email and password
- `POST /api/auth/sign-up/email` — register a new account
- `POST /api/auth/sign-out` — destroy the current session
- `GET /api/auth/get-session` — read the active session

For the full list and request / response shapes, see [Better Auth's documentation](https://www.better-auth.com/docs).

**Required Role:** Public (these are the auth boundary itself)

### 2. `GET /api/me`

Retrieve the currently authenticated user with role and linked faculty / student IDs.

**Required Role:** Authenticated

> This is the only endpoint that does not use the `{ data: ... }` envelope — it returns the user object directly.

**Response (200 OK):**

```json
{
  "id": "user-id",
  "name": "John Doe",
  "email": "user@example.com",
  "image": null,
  "role": "faculty",
  "facultyId": "faculty-uuid",
  "studentId": null
}
```

`role` is `"admin"`, `"faculty"`, or `"student"`. `facultyId` is populated when the role is `faculty` or `admin`; `studentId` is populated when the role is `student`.

**Errors:**

- `401` — `{ "error": "Unauthorized" }`

### 3. `POST /api/marks`

Bulk upsert marks for a single course offering.

**Required Role:** `faculty` or `admin` (`student` rejected)

**Lock check:** If the offering's `"all"` lock is set and the caller is not `admin`, returns `403`.

**Request Body:**

```json
{
  "courseOfferingId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "marks": [
    {
      "studentId": "student-uuid-1",
      "isa": 15,
      "mse1": 25,
      "mse2": null,
      "ese": 35
    }
  ]
}
```

All four mark fields (`isa`, `mse1`, `mse2`, `ese`) **must be present** in each entry; values may be `null` to leave a component unset. Non-null values must be non-negative integers.

**Response (200 OK):**

```json
{ "data": { "saved": 2 } }
```

**Errors:**

- `400` — `{ "error": "Invalid marks data" }`
- `403` — `{ "error": "Forbidden" }` (student role) or `{ "error": "Marks are locked" }`
- `500` — internal error

### 4. `PATCH /api/offerings/[id]/assign-faculty`

Assign or unassign a faculty member on a course offering.

**Required Role:** `admin`

**URL Parameters:**

- `id` — course offering UUID

**Request Body:**

```json
{ "facultyId": "faculty-uuid" }
```

Pass `"facultyId": null` to unassign the offering.

**Response (200 OK):**

```json
{ "data": { "success": true } }
```

**Errors:**

- `400` — `{ "error": "Invalid data" }`
- `403` — `{ "error": "Forbidden" }`
- `404` — `{ "error": "Offering not found" }`

### 5. `POST /api/offerings/[id]/enroll`

Enroll a student in a course offering.

**Required Role:** `faculty` or `admin` (`student` rejected)

**URL Parameters:**

- `id` — course offering UUID

**Request Body:**

```json
{ "studentId": "student-uuid" }
```

**Response (200 OK):**

```json
{
  "data": {
    "id": "enrollment-uuid",
    "courseOfferingId": "offering-uuid",
    "studentId": "student-uuid",
    "isActive": true,
    "createdAt": "2026-04-09T10:00:00Z",
    "updatedAt": "2026-04-09T10:00:00Z"
  }
}
```

**Errors:**

- `400` — `{ "error": "Invalid data" }`
- `403` — `{ "error": "Forbidden" }`

### 6. `DELETE /api/offerings/[id]/enroll`

Remove a student's enrollment from a course offering.

**Required Role:** `faculty` or `admin` (`student` rejected)

**URL Parameters:**

- `id` — course offering UUID

**Request Body:**

```json
{ "studentId": "student-uuid" }
```

**Response (200 OK):**

```json
{ "data": { "success": true } }
```

**Errors:**

- `400` — `{ "error": "Invalid data" }`
- `403` — `{ "error": "Forbidden" }`
- `404` — `{ "error": "Enrollment not found" }`

### 7. `POST /api/offerings/[id]/batches`

Create a new batch within a course offering.

**Required Role:** `faculty` or `admin` (`student` rejected)

**URL Parameters:**

- `id` — course offering UUID

**Request Body:**

```json
{ "name": "Batch A" }
```

`name` must be 1–20 characters.

**Response (200 OK):**

```json
{
  "data": {
    "id": "batch-uuid",
    "courseOfferingId": "offering-uuid",
    "name": "Batch A",
    "isActive": true,
    "createdAt": "2026-04-09T10:00:00Z",
    "updatedAt": "2026-04-09T10:00:00Z"
  }
}
```

**Errors:**

- `400` — `{ "error": "Invalid data" }`
- `403` — `{ "error": "Forbidden" }`
- `409` — `{ "error": "Batch name already exists" }` (duplicate batch name in this offering)

### 8. `PATCH /api/offerings/[id]/batches`

Assign a student to an existing batch within a course offering.

**Required Role:** `faculty` or `admin` (`student` rejected)

**URL Parameters:**

- `id` — course offering UUID

**Request Body:**

```json
{
  "batchId": "batch-uuid",
  "studentId": "student-uuid"
}
```

**Response (200 OK):**

```json
{
  "data": {
    "id": "assignment-uuid",
    "batchId": "batch-uuid",
    "studentId": "student-uuid",
    "isActive": true,
    "createdAt": "2026-04-09T10:00:00Z",
    "updatedAt": "2026-04-09T10:00:00Z"
  }
}
```

**Errors:**

- `400` — `{ "error": "Invalid data" }`
- `403` — `{ "error": "Forbidden" }`

### 9. `POST /api/offerings/[id]/lock`

Lock or unlock a marks component for a course offering.

**Required Role:** `faculty` or `admin` may **lock**; **only `admin`** may **unlock**.

**URL Parameters:**

- `id` — course offering UUID

**Request Body:**

```json
{
  "component": "isa",
  "lock": true
}
```

`component` is one of `"isa"`, `"mse"`, `"ese"`, or `"all"`. `lock` is a boolean.

**Response (200 OK):**

```json
{ "data": { "success": true } }
```

**Errors:**

- `400` — `{ "error": "Invalid data" }`
- `403` — `{ "error": "Forbidden" }` (student role) or `{ "error": "Only admins can unlock marks" }` (faculty attempting to unlock)

### 10. `GET /api/offerings/[id]/lock`

Get the current lock status for all four marks components.

**Required Role:** Authenticated (any role)

**URL Parameters:**

- `id` — course offering UUID

**Response (200 OK):**

```json
{
  "data": {
    "isa": false,
    "mse": true,
    "ese": false,
    "all": false
  }
}
```

**Errors:**

- `401` — `{ "error": "Unauthorized" }`

## HTTP Status Codes

| Code | Meaning                                      |
| ---- | -------------------------------------------- |
| 200  | Success                                      |
| 400  | Bad Request (invalid data)                   |
| 401  | Unauthorized (no session)                    |
| 403  | Forbidden (insufficient permissions or lock) |
| 404  | Not Found                                    |
| 409  | Conflict (duplicate or constraint violation) |
| 500  | Internal Server Error                        |

## Conventions

- All timestamps are ISO 8601 with timezone offsets
- Domain entity IDs (students, faculty, courses, offerings, batches, etc.) are UUIDs; `userId` from Better Auth is a text string, not a UUID
- Session cookies are sent automatically by the browser; external integrations must forward the Better Auth session cookie
- Mark components (`isa`, `mse1`, `mse2`, `ese`) are nullable but **not optional** — fields must be present in the request body, with `null` to indicate "not set"
- Every successful mutation creates an audit log entry; see `src/db/schema/audit.ts` for the schema
