# AutoFix AI — Stage 3.3: Persistent Rate Limiting Design

**Phase:** read-only investigation
**Date:** 2026-11-23
**Repository:** `C:\src\autofix_ai`

**Decision: B — create a dedicated `diagnostic_rate_limits` table.**

Reusing the existing `chat-ai-rate-limits` resource (option A) is rejected on the evidence
in §3. Implementation of option B remains **BLOCKED** until the schema migration in §6 is
separately approved. No code, table, migration, deployment, commit, or push was performed
for this stage; the only file written is this document.

> **Verification status — read this before relying on any detail.**
> No live Appwrite project was contacted for this revision. Column types, index shapes, and
> error identifiers below are taken from the installed `node-appwrite` 30.0.1 SDK, the
> official Appwrite documentation, and Appwrite server source (`app/config/errors.php`,
> `src/Appwrite/Extend/Exception.php`). They are **source-verified, not project-verified**.
> Runtime acceptance of the schema, the actual error payloads, and the atomic-increment
> boundary in the deployed project remain **UNVERIFIED** and are listed in §4.2 and §8.2.

---

## 1. Scope and evidence base

### 1.1 What was inspected

| File | Purpose |
|---|---|
| `functions/chat-ai/index.js` | The only file in the repo that contains a rate limiter |
| `functions/chat-ai/test/rateLimit.test.mjs` | Claimed rate-limiter test suite |
| `functions/chat-ai/src/index.ts` | Parallel TS variant (no limiter found) |
| `functions/chat-ai-deployment/src/main.js` | Deployment variant (no auth, no limiter) |
| `web-app/setup-db.js` | Idempotent table creation for `chat-ai-rate-limits` |
| `functions/diagnostic-ai/index.js` | Target function; current auth/scope flow |
| `functions/diagnostic-ai/package.json` | No dependencies declared |
| `web-app/node_modules/node-appwrite` | Installed SDK 30.0.1, inspected for API shape only |
| `STAGE_2.3.16_REPORT.md`, `STAGE_2.3.17_REPORT.md`, `STAGE_2.3.18_REPORT.md` | Prior claims being checked |

### 1.2 Evidence limits

- No live Appwrite project was contacted. No database, table, index, column, permission,
  function execution, or environment variable was read from the deployed project.
- SDK observations below come from the installed package in `web-app/node_modules`, not
  from the function runtime. The functions declare no `node-appwrite` dependency, so the
  runtime SDK version is unknown.
- Appwrite server behaviour (error type strings, integer widths) was checked against the
  public Appwrite server source and official documentation on 2026-11-23. That establishes
  intended platform behaviour; it does **not** prove what this project's deployed version
  returns.
- Therefore anything labelled **UNVERIFIED** must be confirmed against the real project
  before any implementation is treated as production-ready.

Sources consulted for this revision:

| Source | Used for |
|---|---|
| `web-app/node_modules/node-appwrite/dist/client.d.ts` | `AppwriteException` fields (`code`, `type`, `response`) |
| `web-app/node_modules/node-appwrite/dist/services/tables-db.d.ts` | Column types, `createIndex` shape, `createTable` bulk shape, `max` wording |
| `web-app/node_modules/node-appwrite/dist/models.d.ts` | `Row` system fields (`$createdAt`, `$updatedAt`) |
| `https://appwrite.io/docs/products/databases/tablesdb/atomic-numeric-operations` | Atomic increment semantics; `integer` is 32-bit, `bigint` is 64-bit |
| `https://appwrite.io/docs/products/databases/tablesdb/tables` | Column and index types |
| `https://github.com/appwrite/appwrite/blob/master/app/config/errors.php` | HTTP status for each error type |
| `https://github.com/appwrite/appwrite/blob/master/src/Appwrite/Extend/Exception.php` | Exact lowercase error type strings |

---

## 2. Existing `chat-ai` rate limiter — exact inventory

Source: `functions/chat-ai/index.js`.

### 2.1 Resource identifiers

| Item | Value | Evidence |
|---|---|---|
| Database | `process.env.APPWRITE_DATABASE_ID || 'autofix-ai-db'` | lines 74, 93, 111 |
| Table | `chat-ai-rate-limits` | line 44 |
| Row ID | First 32 hex chars of `SHA-256("${userId}:${windowStart}")` | lines 63–68 |
| Limit | 30 requests | line 25 |
| Window | 60,000 ms fixed window | line 26 |
| Window start | `Math.floor(now / 60000) * 60000` | line 57 |

### 2.2 Declared schema (`web-app/setup-db.js`, lines 409–433)

| Column | Declared type | Required |
|---|---|---|
| `userId` | string, size 255 | yes |
| `count` | integer | yes |
| `windowEnd` | integer | yes |
| `updatedAt` | datetime | yes |

| Property | Declared value | Evidence |
|---|---|---|
| Table permissions | `[]` (server-only) | line 415 |
| Row security | not set | lines 411–426 |
| Index | `{ key: 'userId', unique: true }` | line 424 |

### 2.3 Algorithm as written (`upsertRateLimit`, lines 55–127)

1. Compute `windowStart`, `windowEnd`, and hashed per-window `rowId`.
2. `getRow(rowId)`.
3. If the read **throws for any reason**, treat the row as absent (lines 72–81).
4. If absent: `upsertRow({ count: 1, ... })` and allow (lines 87–103).
5. If present: `incrementRowColumn({ column: 'count', value: 1, max: 30 })` and allow
   (lines 109–120).
6. Any increment error is re-thrown; the entrypoint classifies it:
   - error message contains `"max"` → HTTP 429 (lines 192–194)
   - anything else → HTTP 503 (lines 195–197)

This is a **read-then-write** sequence for the first request of a window. It is not a
single atomic operation.

---

## 3. Why the existing resource cannot be safely reused (option A rejected)

### F1. `chat-ai/index.js` cannot load as an ES module — FAIL

`functions/chat-ai/package.json` declares `"type": "module"`. The file mixes ESM and
CommonJS at top level:

- line 14: `import { createHash } from 'node:crypto';`
- line 15: `const { TablesDB } = require('node-appwrite');`
- line 16: `const { Client } = require('node-appwrite');`

`require` is not defined in an ES module. The module throws at import time, before any
rate-limit logic runs. This is a code-level fact, independent of Appwrite.

### F2. Row response shape does not match the SDK — FAIL

`incrementRowColumn` and `getRow` return `Models.Row` in SDK 30.0.1. `Row` has `$id`,
`$sequence`, `$tableId`, `$databaseId`, `$createdAt`, `$updatedAt`, `$permissions`, and the
column values at the **top level** (`DefaultRow` adds `[key: string]: any`). There is no
`data` property (`node_modules/node-appwrite/dist/models.d.ts`, lines 2761–2794).

The code does:

- line 118: `result?.data?.count ?? existing.data.count + 1`
- line 118 falls through to `existing.data.count`, and `existing.data` is `undefined`
  because `getRow` also returns a `Row`.

Result: the second request in a window throws `TypeError`, is classified as a store
failure, and returns 503. The limiter would never reach request 30.

### F3. The table-creation call declares its index in an invalid shape — FAIL (likely)

The SDK documents `createTable` indexes as containing `key`, `type`
(`key|fulltext|unique|spatial|trigram`), `attributes` (array of column keys), and optional
`orders`/`lengths` (`dist/tables-db.d.ts`, line 544). `setup-db.js` supplies only
`{ key: 'userId', unique: true }` (line 424): no `type`, no `attributes`, and an
undocumented `unique` property.

The whole `createTable` call is wrapped in `try/catch` that logs
“already exists or could not be created” and continues (lines 428–432). A schema
rejection is therefore swallowed and looks like success. Whether the table exists at all
in the deployed project is **UNVERIFIED**.

### F4. The declared unique `userId` index is incompatible with the code's design — FAIL

The code writes one row per user **per window**. A unique index on `userId` alone permits
only one row per user, ever. Once the first window's row exists, creating a row for the
next window with the same `userId` violates the unique index.

Consequences (either the index exists or it does not):

- If the index exists: every new window fails to create a row → 503 (or 429 if the error
  text happens to contain `"max"`).
- If the index does not exist: the declared schema and the live schema differ, and the
  repo is not an accurate description of the resource.

Neither branch supports safe reuse.

### F5. Read errors silently reset the counter — FAIL (fail-open path)

`getRow` errors are all treated as “row not found” (lines 78–81). A transient read failure,
permission error, or network timeout on a row that already has `count = 30` leads to
`upsertRow({ count: 1 })`, which resets the counter and allows the request. This is exactly
the read-then-write hazard the Stage 3.3 brief warns about. The later atomic increment is
never reached on that path, so it cannot compensate.

### F6. Concurrent first requests undercount — FAIL

When no row exists, every concurrent request that observed “absent” performs
`upsertRow({ count: 1 })`. The last write wins with `count = 1`; N requests can be allowed
while the counter records 1. The strict limit is therefore not enforced at the start of
each window. This is a burst bypass, not merely a cosmetic inaccuracy.

### F7. 429/503 classification is substring matching — FAIL

The entrypoint decides “rate limited” by testing whether the error message contains the
letters `max` (line 192). This is not a stable contract:

- It can classify unrelated errors containing “max”/“maximum” as 429.
- It will classify a max-exceeded error whose text does not include that substring as 503.
- It cannot distinguish “row already exists” from “store down”.

The correct discriminator is the HTTP status/error code from the API response, captured
explicitly.

### F8. No cleanup or retention — FAIL

One row per user per minute is unbounded growth: 1,440 rows per user per day. There is no
delete path, scheduled cleanup, or retention policy. This is operationally unacceptable
regardless of correctness.

### F9. Reuse would couple quotas — FAIL

The table is named for chat and its rows have no scope column. Reusing it for diagnostics
would either:

- share the same counter (a user's chat messages consume diagnostic quota), or
- require a scope in the row ID/hash.

Namespacing in the hash is theoretically possible, but F4 (unique `userId`) makes multiple
rows per user impossible under the declared schema. Reuse cannot provide isolation without
changing the table anyway — at which point it is a migration, not reuse.

### F10. The deployed implementation is not identifiable from the repo — BLOCKED

There are at least three divergent chat implementations:

| File | Auth | Rate limit |
|---|---|---|
| `functions/chat-ai/index.js` | JWT verification | TablesDB limiter |
| `functions/chat-ai/src/index.ts` | — | none found |
| `functions/chat-ai-deployment/src/main.js` | none | none (API key in URL) |

The deployment folder's variant is unauthenticated and does not implement any limiter.
Which artifact is actually deployed is **UNVERIFIED**. A design that “reuses what chat-ai
does” has no single, verified behaviour to reuse.

### F11. The test suite is not evidence — FAIL

`functions/chat-ai/test/rateLimit.test.mjs` contains **17** `test(...)` blocks, not the 23
claimed in `STAGE_2.3.17_REPORT.md`. More importantly:

- It never imports `functions/chat-ai/index.js`; it asserts constants and hard-coded
  booleans. Examples:
  - lines 36–41: asserts `1 === 1`
  - lines 61–78: asserts a literal `true`
  - lines 83–88: asserts `30 === 30`
  - lines 155–164: asserts `35 - 30 === 5`
- It calls `require('node:crypto')` inside a `.mjs` file (lines 251, 305), which throws
  `ReferenceError: require is not defined` under Node's ESM loader, so at least two tests
  cannot run as written.

The suite therefore establishes no behaviour of the limiter. Any “30/31 verified” or
“concurrency verified” claim based on it is unsupported.

### 3.1 Status summary for the existing resource

| Check | Status |
|---|---|
| Limiter code exists in the repo | PASS |
| Module loads as declared | FAIL (F1) |
| Uses the installed SDK response shape correctly | FAIL (F2) |
| Table creation and schema are valid and applied | FAIL / UNVERIFIED (F3) |
| Schema permits per-window rows | FAIL (F4) |
| Read path cannot reset the counter | FAIL (F5) |
| Concurrent first requests are strictly limited | FAIL (F6) |
| 429/503 classification is reliable | FAIL (F7) |
| Retention/cleanup exists | FAIL (F8) |
| Quota isolation from chat | FAIL (F9) |
| Deployed behaviour is identifiable | BLOCKED (F10) |
| Tests exercise the implementation | FAIL (F11) |
| Live 30/31 and concurrency verification | BLOCKED (no live evidence) |

---

## 4. Atomicity and concurrency analysis

### 4.1 What is established from the SDK contract

- Increment is a **single API request**:
  `PATCH /tablesdb/{databaseId}/tables/{tableId}/rows/{rowId}/{column}/increment`
  with body `{ value, max }` (`node_modules/node-appwrite/dist/services/tables-db.js`,
  line 5777 and the `client.call("patch", ...)` that follows).
- `max` is documented as: “Maximum value for the column. If the current value is greater
  than this value, an error will be thrown.” (`tables-db.d.ts`, line 2548).
- The method returns a `Row`, not `{ data }` (§F2).
- `upsertRow` is explicitly “Create or update” (`tables-db.d.ts`, lines 2305–2316), so it
  overwrites — it must never be used to maintain a quota counter.

### 4.2 What is **not** established

The following are UNVERIFIED and must be measured in a disposable development project
before launch:

1. **The exact HTTP status and Appwrite error code when `max` is exceeded.** The SDK wording
   says an error is thrown, but the official atomic-operations page describes `min`/`max` as
   keeping “the final value within acceptable limits”, which can be read as clamping. These
   statements are not sufficient to decide the behaviour.
2. **Whether the increment is persisted before an error is thrown.** This changes whether a
   rejected request leaves `count = 31` or `count = 30`.
3. **Whether `max` throws or clamps, and at which boundary.** `29 → 30` vs `30 → 31` is not
   proven. This is not cosmetic: if `max` clamps, the increment returns `30` forever and a
   `count <= limit` check would allow **every** subsequent request. §5.6 therefore does not
   pass `max` at all; correctness relies on an unbounded increment and a post-increment
   comparison.
4. **Whether the backend increment is implemented atomically in the database.** The API is a
   single call and the official docs describe it as atomic under concurrency control, but
   server internals are not observable from here.
5. **The app-visible error payload for a duplicate row.** Appwrite server source maps
   `row_already_exists` to HTTP 409 (`errors.php`, `Exception.php`), and this revision uses
   exactly `409 + type === "row_already_exists"`. That pair has not been observed in this
   project and must be captured verbatim in development.
6. **Which index shape the deployed server accepts.** The installed SDK documents
   `attributes` for indexes in the bulk `createTable` payload, but `columns` for the
   dedicated `createIndex` call. This inconsistency is not live-verified. §6 recommends
   creating columns with `createTable` and indexes with `createIndex` using `columns`.
7. **Whether a composite unique index over `varchar`, `varchar`, `bigint` is accepted and
   enforced** by the deployed Appwrite version. The row ID already provides uniqueness; the
   index is defence in depth and must not be assumed to exist until `getIndex` reports it
   `available`.
8. **Whether `$updatedAt` is refreshed by `incrementRowColumn`.** This is operational only;
   no correctness or retention logic depends on it.

### 4.3 Conclusions

- A single `incrementRowColumn` call is the correct primitive for same-row concurrency;
  it should replace every read-then-write counter update.
- **Read-then-write is not safe** for either the first request or the counter, and the
  existing code relies on it in both places.
- `upsertRow` must not be used for counters.
- **Do not pass `max` in the initial implementation.** Increment unbounded and compare the
  returned count to the configured limit. This removes the throw/clamp ambiguity entirely.
  If a future change wants to use `max` as an optimization, it must first complete the live
  boundary test in §8.2, because a clamping `max` would turn the limiter into allow-all.
- Any non-conflict error, any composite-unique violation, and any Appwrite-side 429 from the
  limiter store must fail closed (503), never allow the request.

---

## 5. Recommended diagnostic rate-limit policy

### 5.1 Identity

- Key **only** on the Appwrite user ID returned by `verifyCaller()`
  (`functions/diagnostic-ai/index.js`, lines 129–152), which resolves the verified JWT
  against `/account`.
- Never read `userId`, `institutionId`, `departmentId`, or `role` from the request body for
  this purpose.
- Do not key on institution or department. Those are authorization scopes, not billing
  identities; pooling users under an institution would let one user exhaust another's
  quota and would make abuse attribution impossible.
- Requests without a verified identity are rejected with 401 before the limiter runs.

### 5.2 Scope

- Apply only to the AI diagnostic flow (the branch with no `action` field that calls
  `runDiagnostic`). Admin/profile/material actions do not call the AI provider and keep
  their existing authorization rules.
- Store `scope = 'diagnostic'` on every row so a future endpoint can share the table
  without sharing counters.

### 5.3 Configuration

All configuration is server-side and deployment-controlled. No request field can change
the limit, the window, the table, or the enforcement mode.

| Variable | Default | Valid range | Behaviour when missing/invalid |
|---|---|---|---|
| `DIAGNOSTIC_RATE_LIMIT_MAX` | `30` | 1–300 | Use `30` and log a warning. Never disables enforcement. |
| `DIAGNOSTIC_RATE_LIMIT_WINDOW_SECONDS` | `60` | 10–3600 | Use `60` and log a warning. Never disables enforcement. |
| `APPWRITE_ENV` | unset | `production`, `staging`, `development` | Treat as **production** (fail closed). |
| `DIAGNOSTIC_RATE_LIMIT_DEV_BYPASS` | unset | `true` only | Honoured **only** when `APPWRITE_ENV` is `development` or `staging`; ignored in production. |

**Disabled/enabled rule (production safety):**

- There is **no production disable switch**. In production (or when `APPWRITE_ENV` is
  missing/unknown), the limiter is either enforcing or the endpoint returns 503. It can
  never silently allow AI calls.
- A numeric config error falls back to the safe default and still enforces. A missing table,
  missing key, or unreadable store is **not** a config warning: it is a hard 503.
- `DIAGNOSTIC_RATE_LIMIT_DEV_BYPASS=true` exists only so development/staging can work before
  the table exists. It must log a warning on every bypassed request. In production it has no
  effect; if code ever observes `production + bypass`, it must ignore the bypass and enforce
  (or return 503 if the store is unavailable).
- There is no in-memory fallback, no “skip on error”, and no client-supplied bypass. Those
  would convert an outage or a missing table into unmetered AI usage.
- The table ID is a code constant (`diagnostic_rate_limits`), not an environment variable,
  so it cannot be pointed at a different resource by misconfiguration.

Configuration changes are deployment operations and are out of scope for Stage 3.3.

### 5.4 Window

Fixed window: `windowStart = floor(now / windowMs) * windowMs`,
`windowEnd = windowStart + windowMs`. Fixed windows are simple and deterministic across
Function instances, at the cost of allowing up to two windows' worth of requests across a
boundary. That is acceptable for abuse control; a sliding window would require a sorted
set or multiple rows and is not justified here.

### 5.5 Row key

`rowId = first32hex(SHA-256("diagnostic:" + userId + ":" + windowStart))`

- 32 hex characters ≤ Appwrite's 36-character row-ID limit and uses only allowed
  characters.
- Deterministic per user/window; different windows cannot overwrite each other.
- A stale-window request operates on its own old row and cannot reset the current window.

### 5.6 Algorithm (no read-before-write, no `max`)

1. Compute `windowStart`, `windowEnd`, `rowId`.
2. Attempt `createRow(rowId, { userId, scope, count: 1, windowStart, windowEnd })`.
   - Success → this request is the first in the window; allow. Count is exactly 1.
   - Failure with **HTTP 409 and `type === "row_already_exists"`** → continue to step 3.
   - Any other failure → 503 (fail closed). This includes other 409 types, 401/403, 404,
     429, 5xx, network errors, and malformed responses.
3. `incrementRowColumn(rowId, 'count', 1)` with **no `max` parameter**.
   - Success: first confirm the returned row's `userId`, `scope`, and `windowStart` match the
     values computed for this request. A mismatch means the row ID did not address the
     intended tuple (hash collision or manual tampering) → 503.
   - Identity matches and `count <= limit` → allow.
   - Identity matches and `count > limit` → deny (429).
   - Failure with a known store-level rejection (Appwrite 429 or 409 locked) → 503 without a
     confirmation read.
   - Failure with an unknown outcome (timeout, network, 5xx) → perform one `getRow(rowId)`:
     - read succeeds, identity matches, and `count >= limit` → deny (429)
     - read succeeds, identity matches, and `count < limit` → 503 (the increment outcome is
       unknown)
     - read succeeds with mismatched identity, or read fails for any reason → 503
4. Deny → return 429 and **do not call the AI provider**.
5. Store failure → return 503 and **do not call the AI provider**.

Why this is safe:

- `createRow` is gated by the unique row ID, so exactly one concurrent first request can
  create the row. Everyone else must increment. There is no window in which N concurrent
  requests all write `count = 1`.
- The increment is a single API request; no application-level read/modify/write.
- The increment is **unbounded**. A clamping or misbehaving `max` cannot make every request
  appear to be request 30. The returned count is compared directly.
- No `upsertRow` on the counter path, so a failed read can never reset the count.
- Denial is decided by explicit status/type checks, not by matching error text.
- The error-path read is used only to choose between 429 and 503. It never turns a failure
  into an allow, and if the row has disappeared (cleanup/clock fault) the result is 503,
  not a fresh count.

Pseudo-code (the REST helper must preserve HTTP status and the parsed error body; the SDK
equivalent is `AppwriteException.code` / `.type`):

```js
async function checkDiagnosticRateLimit(userId, now = Date.now()) {
  const windowMs = RATE_LIMIT_WINDOW_SECONDS * 1000;
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const windowEnd = windowStart + windowMs;
  const rowId = hashRowId('diagnostic', userId, windowStart);

  try {
    const row = await createRow(rowId, {
      userId,
      scope: 'diagnostic',
      count: 1,
      windowStart,
      windowEnd,
    });
    return { allowed: true, count: row.count, windowEnd };
  } catch (err) {
    if (!isDuplicateRowId(err)) throw asStoreFailure(err); // fail closed -> 503
  }

  try {
    const row = await incrementRowColumn(rowId, 'count', 1); // no max
    if (!isExpectedRow(row, userId, windowStart)) {
      throw new Error('rate-limit row identity mismatch');
    }
    return {
      allowed: row.count <= LIMIT,
      count: row.count,
      windowEnd,
    };
  } catch (err) {
    if (isStoreRateLimit(err) || isResourceLocked(err)) {
      throw asStoreFailure(err); // 503, never a misleading user 429
    }
    const row = await getRow(rowId).catch(() => null);
    if (row && isExpectedRow(row, userId, windowStart) && row.count >= LIMIT) {
      return { allowed: false, count: row.count, windowEnd };
    }
    throw asStoreFailure(err); // fail closed -> 503
  }
}
```

`isExpectedRow` checks `row.userId === userId && row.scope === 'diagnostic' &&
row.windowStart === windowStart`. It does not need to check `windowEnd` or `count` type, but
the count must be a finite number before comparison; a malformed value is a 503. Known
store-level rejections (Appwrite 429, 409 locked) skip the confirmation read and become 503;
the read is used only for errors whose outcome is unknown (timeout, network, 5xx).

#### Exact conflict and failure classification

`isDuplicateRowId` matches **only** `HTTP 409 + type === "row_already_exists"`. No other status or type enters the
increment path by default. A second type, `row_unique_constraint_violation`, is permitted to enter the increment
path **only** if live verification proves it represents the expected deterministic row conflict (same
scope/user/window, different row ID due to a hash collision or manual insert). Until that is proven it is a
store/invariant failure and returns 503.

| Condition | Detection (REST helper) | Detection (SDK) | Action |
|---|---|---|---|
| Duplicate row ID (verified) | `httpStatus === 409 && body.type === "row_already_exists"` | `err.code === 409 && err.type === "row_already_exists"` | Go to increment |
| Composite unique-index violation | `409 && type === "row_unique_constraint_violation"` | same fields | **503 by default** (invariant breach: same tuple under a different row ID). Enters the increment path **only** if live verification confirms it represents the expected deterministic row conflict; otherwise alert and fail closed. |
| Resource locked (transient) | `409 && type === "general_resource_locked"` | same fields | **503, store failure.** Not a duplicate conflict. Retry `createRow` only if desired (retrying it is idempotent); never blindly retry an increment, because the first attempt may have committed. |
| Appwrite endpoint rate limit | `429 && type === "general_rate_limit_exceeded"` | same fields | **503, store failure.** Not a duplicate conflict and not a user 429: the user's counter was not incremented, so claiming quota exhaustion would be false. |
| Row not found | `404 && type === "row_not_found"` | same fields | 503 |
| Anything else | any other status/type | any other status/type | 503 |

The error type strings are the lowercase constants in Appwrite's
`src/Appwrite/Extend/Exception.php`; the status codes come from `app/config/errors.php`.
The config layer must expose them as data, not by reading `err.message`. If the deployed
version is older and returns a legacy `document_already_exists` instead of
`row_already_exists`, capture that exact value in development and add it to the allowlist
explicitly. Do not add speculative aliases, and never fall back to message matching.

The current `appwriteRequest` helper discards HTTP status (`functions/diagnostic-ai/index.js`,
lines 114–116), so Stage 3.4 must extend it to throw an `AppwriteError` carrying
`httpStatus`, `type`, `code` (body `code`), and a safe message. It must parse the response
body once, tolerate a non-JSON body, and never log the JWT or API key. If the sandbox runtime
uses the SDK instead, `AppwriteException` already provides `.code`, `.type`, `.response`.

### 5.7 Responses

| Condition | Status | Body |
|---|---|---|
| Missing/invalid JWT | 401 | `{ "error": "Authentication required." }` |
| Profile/scope not verifiable | 403 | existing messages |
| Invalid or oversized request | 400 | validation message |
| Limit exceeded | 429 | `{ "error": "Rate limit exceeded. Try again in N seconds.", "retryAfterSeconds": N }` |
| Store unavailable (including an Appwrite `429 general_rate_limit_exceeded` from the limiter store) | 503 | `{ "error": "Service temporarily unavailable. Please try again later." }` |
| Limiter not enforcing in production (missing table/config, unknown environment) | 503 | same generic message; log the configuration fault server-side |
| AI/config failure | 500 | generic message, no provider detail |

A 429 is returned only when the **user's** stored count is at or above the limit. An
Appwrite-side 429 from the store must be converted to 503, because the user's counter was
not incremented.

`retryAfterSeconds = max(1, ceil((windowEnd - now) / 1000))`. Add a standard
`Retry-After` header only if the deployed function runtime's `res.json` signature supports
response headers; otherwise the body field is the contract. Do not expose internal IDs,
JWT fragments, API keys, or raw provider errors.

### 5.8 Placement in `diagnostic-ai`

```
POST / 405 method check
  -> parse JSON (400 on malformed)
  -> verifyCaller (401)
  -> findProfile (500 only if the profile store is unavailable)
  -> diagnostic branch:
       institution/department authorization (403)
       request validation + payload-size limit (400)
       rate limit (429 / 503)
       AI provider call
```

The limiter must run **after** identity/authorization (unauthenticated or unauthorized
traffic should not consume a user's quota) and **before** any provider call.

### 5.9 Concurrency and abuse properties

- Allowed requests per user per fixed window: at most `limit`.
- Concurrent burst: one `createRow` winner; all others increment; exactly `limit`
  requests can observe `count <= limit`.
- A rejected request never reaches the AI provider.
- A store outage fails closed (503). Availability of the limiter is a prerequisite for
  the AI feature, not an optional dependency.
- There is no “limiter disabled” state in production. Development/staging bypass is
  explicit, logged, and impossible in production; a missing or unrecognised environment is
  treated as production and therefore 503 when the store is unavailable.

### 5.10 Clock behaviour

`windowStart` is computed inside each function instance. Instances with materially skewed
clocks could briefly treat the same instant as different windows. Appwrite instances are
normally time-synchronised; the row ID still guarantees that each computed window has an
independent counter. Monitor for anomalies rather than adding client-supplied time.

---

## 6. Proposed `diagnostic_rate_limits` table

This section is the schema deliverable. It is a proposal only: no table, column, index,
permission, or migration has been created. The shapes below follow SDK 30.0.1 and the
official Appwrite docs. Live acceptance by this project is **UNVERIFIED** (§4.2, §8.2).

### 6.1 Resource and exact column definitions

**Database:** the same server-only database used by `diagnostic-ai`
(`APPWRITE_DATABASE_ID`, default `autofix-ai-db`). Do not modify `chat-ai-rate-limits`.

**Table ID:** `diagnostic_rate_limits` (code constant, not an environment variable).
**Name:** `Diagnostic Rate Limits`. **Permissions:** `[]`. **Row security:** `false`.
**Enabled:** `true`.

| Column key | Appwrite type | Required | Default | Purpose |
|---|---|---|---|---|
| `userId` | `varchar`, size `255` | yes | none | Verified Appwrite user ID only |
| `scope` | `varchar`, size `50` | yes | none | Constant `diagnostic` |
| `count` | `integer` (32-bit signed) | yes | none | Starts at 1; incremented without `max` |
| `windowStart` | `bigint` (64-bit signed) | yes | none | Fixed-window start, epoch milliseconds |
| `windowEnd` | `bigint` (64-bit signed) | yes | none | Fixed-window end, epoch milliseconds; retention key |
| ~~`updatedAt`~~ | — | — | — | **Not included.** See §6.3. |

**`windowStart`/`windowEnd` must be `bigint`, not `integer`.** Appwrite's `integer` is
32-bit signed (maximum `2,147,483,647`), while epoch milliseconds in 2026 are around
`1.79 × 10^12`. Storing them in `integer` would overflow or silently corrupt the window.
Appwrite's atomic-operations documentation explicitly recommends `bigint` for timestamps.
`count` can remain `integer`: even an abusive burst cannot approach 2^31 increments in 60
seconds, and an overflow would surface as an error and be handled as 503 (fail closed).

**Live SDK serialization and round-trip verification are still required.** The schema above
is source-verified only: it has not been confirmed that the deployed SDK/runtime serialises
a `bigint` value correctly into the JSON request, that Appwrite stores it without
truncation, or that a read returns the identical integer. §6.6 item 3 and §8.2/B.1 item 4
must be completed before the schema is treated as applied.

Do not declare defaults. Every write supplies all five columns explicitly; a default would
hide a caller bug and is unnecessary.

Exact `createTable` payload (columns only):

```json
{
  "databaseId": "<APPWRITE_DATABASE_ID>",
  "tableId": "diagnostic_rate_limits",
  "name": "Diagnostic Rate Limits",
  "permissions": [],
  "rowSecurity": false,
  "enabled": true,
  "columns": [
    { "key": "userId", "type": "varchar", "size": 255, "required": true },
    { "key": "scope", "type": "varchar", "size": 50, "required": true },
    { "key": "count", "type": "integer", "required": true },
    { "key": "windowStart", "type": "bigint", "required": true },
    { "key": "windowEnd", "type": "bigint", "required": true }
  ],
  "indexes": []
}
```

### 6.2 Exact index definitions

Required indexes:

| Key | Type | Columns (in order) | Purpose |
|---|---|---|---|
| `scope_user_window` | `unique` | `scope`, `userId`, `windowStart` | Enforces one row per scope/user/window; supports prefix lookups |
| `window_end` | `key` | `windowEnd` | Retention cleanup |

**Index-shape verification.** The installed SDK documents two different property names for
the same concept:

- bulk `createTable` index entries: `{ key, type, attributes, orders?, lengths? }`
  (`tables-db.d.ts` line 568);
- dedicated `createIndex`: `{ key, type, columns, orders?, lengths? }`
  (`tables-db.d.ts` lines 2116–2124).

This inconsistency is **not live-verified**. The recommended sequence is therefore to
create the table with columns only, then create each index with `createIndex`, whose
signature explicitly names `columns`:

```json
{
  "databaseId": "<APPWRITE_DATABASE_ID>",
  "tableId": "diagnostic_rate_limits",
  "key": "scope_user_window",
  "type": "unique",
  "columns": ["scope", "userId", "windowStart"]
}
```

```json
{
  "databaseId": "<APPWRITE_DATABASE_ID>",
  "tableId": "diagnostic_rate_limits",
  "key": "window_end",
  "type": "key",
  "columns": ["windowEnd"]
}
```

If a single-call bulk create is preferred, the documented shape is:

```json
"indexes": [
  {
    "key": "scope_user_window",
    "type": "unique",
    "attributes": ["scope", "userId", "windowStart"]
  },
  {
    "key": "window_end",
    "type": "key",
    "attributes": ["windowEnd"]
  }
]
```

Then read it back with `listIndexes`/`getIndex`. Do not treat the creation response or a
log line as proof. The index must report `available`, and its attributes/columns must match
exactly. If the bulk shape is rejected, use `createIndex`; do not change the logical
definition.

**Why the unique index is still needed when row IDs are already unique.** The row ID is a
hash of `(scope, userId, windowStart)`, so it already prevents duplicate windows under
normal operation. The composite unique index is defence in depth: it catches a hash
collision, a manual insert, or a future code path that computes a different row ID. It must
not be replaced by a unique index on `userId` alone (the defect in §F4), which would forbid
multiple windows per user.

The row ID remains 32 lowercase hex characters: ≤ Appwrite's 36-character limit, and only
allowed characters (`a-z`, `A-Z`, `0-9`, `.`, `-`, `_`).

### 6.3 Is `updatedAt` necessary?

**No. Do not add a manual `updatedAt` column.**

- Appwrite rows already expose system-managed `$createdAt` and `$updatedAt` (`Row` model),
  so a manual column duplicates platform metadata.
- `incrementRowColumn` increments only the named column. It will not populate a custom
  `updatedAt`, so the field would be stale unless the limiter performed a second PATCH on
  every request.
- That second write adds latency, a new failure mode, and a race between the timestamp and
  the count. It provides no quota or security value.
- Retention must not depend on a last-touch timestamp: `windowEnd` is immutable, exact, and
  already required for the fixed window.

If operators want last-touch visibility, use `$updatedAt`. Whether `incrementRowColumn`
refreshes `$updatedAt` is UNVERIFIED (§4.2 item 8); it is for inspection only and must not
drive enforcement or cleanup.

### 6.4 Permissions and cleanup (24-hour retention)

**Table access**

- Table permissions `[]` and `rowSecurity: false` mean no client role (guest, user, team,
  or membership) can read or write the table. Only a server API key can access it.
- Use a dedicated server key for the diagnostic limiter and cleanup. Grant only the
  TablesDB/rows read and write capabilities needed for this database, and do not include
  users, teams, storage, functions, or other unrelated scopes. Confirm the exact scope
  identifiers in the target Appwrite console; do not assume legacy `databases.*` scopes
  cover TablesDB, and never reuse a browser/client key.
- If the deployed Appwrite version cannot scope a key to a single table, record that as a
  residual least-privilege risk and rotate the dedicated key independently.
- The key stays in function environment variables. It must never be returned to a client,
  embedded in a URL, or written to logs.

**Cleanup job**

- Run as a **separate scheduled Function**, not in the request path of `diagnostic-ai`.
- Do not grant `any` or `users` execute permission. The schedule is the only trigger. If
  the deployed version requires a non-empty execute permission for schedules, verify that
  in development; do not open the function to clients as a workaround. If a manual trigger
  is ever needed, invoke it server-side with a key, not from the browser.
- Use a dedicated least-privilege key (may be the same dedicated limiter key only if it is
  already limited to the TablesDB rows needed here).
- Retention is exactly **24 hours**: delete rows where
  `windowEnd < now - 86,400,000` ms. Rows are therefore kept 24–25 hours with an hourly
  job, which is enough for incident investigation.
- Query shape (REST `queries` array):

```json
[
  { "method": "lessThan", "attribute": "windowEnd", "values": [cutoffMs] },
  { "method": "limit", "values": [500] }
]
```

- Use `deleteRows` with the same query. Loop in batches of at most 500 until a batch
  returns fewer than 500 rows, with a hard per-run cap (for example 10,000 rows) to bound
  runtime. The job is idempotent and safe to re-run.
- Log only aggregate counts (deleted, remaining, cutoff). Do not log user IDs, table rows,
  JWTs, or keys.
- Never delete without the `windowEnd < cutoff` predicate. A clock error greater than 24
  hours could otherwise delete an active window and let that user restart their count.
  Appwrite hosts are normally time-synchronised; alert on unexpected deletion spikes and
  do not add a “delete all on error” path.

**Growth:** one row per user per minute is 1,440 rows per user per day; with 24-hour
retention the steady state is about 1,440 rows per user. Without cleanup the table grows
without bound.

### 6.5 Why a dedicated table, not a column on `profiles`

Profiles are user-owned records with document security and a different lifecycle. Adding
hot, high-churn counters to them would mix concerns, increase write contention on profile
reads, and require field changes to a production collection. A separate table keeps
retention, permissions, and cleanup independent. It also avoids coupling diagnostic quota
to chat quota (§F9).

### 6.6 Schema acceptance checklist (development read-back)

Do not mark the schema approved until all of these are recorded against a real development
project:

1. `getTable` returns exactly the five columns above, with `userId`/`scope` as `varchar` of
   the stated sizes, `count` as `integer`, and both window columns as `bigint`.
2. `listIndexes` shows `scope_user_window` as `unique` with columns/attributes
   `scope`, `userId`, `windowStart`, and `window_end` as `key` on `windowEnd`; both are
   `available`.
3. A test row storing an epoch-ms value (for example `1764000000000`) round-trips exactly,
   proving the columns are not 32-bit.
4. Creating the same row ID twice returns HTTP 409 with type `row_already_exists`; record
   the raw status and body.
5. Creating a second row with the same tuple but a different row ID returns HTTP 409 with
   type `row_unique_constraint_violation`; record the raw status and body.
6. A client SDK request to read or write the table is denied; the server key succeeds.
7. The cleanup query deletes only rows older than the cutoff in a disposable fixture and
   leaves recent rows intact.

Until this checklist is complete, the schema is a proposal, not an applied resource.

---

## 7. Migration and rollout steps (proposed; not executed)

1. Approve this design and the schema in §6. Approval is a separate decision from Stage 3.3.
2. In a **development** project, create `diagnostic_rate_limits` with the §6.1
   `createTable` payload (columns only, permissions `[]`, row security `false`).
3. Create the two indexes with `createIndex` using `columns` (§6.2). If the team prefers the
   bulk payload, use `attributes` and verify the result; do not assume the two shapes are
   interchangeable.
4. Wait until every column and index reports `available`; read back `getTable` and
   `listIndexes`, and complete the §6.6 checklist. Record the actual responses.
5. Add `DIAGNOSTIC_RATE_LIMIT_MAX`, `DIAGNOSTIC_RATE_LIMIT_WINDOW_SECONDS`, and
   `APPWRITE_ENV=development` in the development function. `DIAGNOSTIC_RATE_LIMIT_DEV_BYPASS`
   stays unset unless there is a short, logged reason to work without the table.
6. Implement the limiter (Stage 3.4):
   - increment **without `max`** and compare the returned count (§5.6);
   - extend `appwriteRequest` to preserve HTTP status and the parsed `type` (§5.6);
   - implement the exact error allowlist, including converting Appwrite-side 429 to 503;
   - implement production fail-closed and ignore any dev bypass in production (§5.3);
   - do not add an in-memory fallback or a production disable flag.
7. Run the mocked tests (§8.1). They prove branching only.
8. Run the live development checks (§8.2), including the schema checklist, exact error
   capture, and the separate `max`-boundary experiment.
9. Repeat in a **staging** project with `APPWRITE_ENV=staging`; monitor 429/503 rates and
   cleanup counts.
10. Production: set `APPWRITE_ENV=production`, deploy only after the table and both indexes
    are `available`, and complete a written go/no-go covering every UNVERIFIED item in
    §4.2. There is no production bypass; a missing/misconfigured store yields 503.
11. Rollback in production: **do not** “disable the limiter” via a flag, because that either
    becomes unmetered AI usage or a silent outage. Redeploy the previous function version,
    or return a deliberate maintenance 503, and leave the table intact. Pause cleanup only
    if it is the source of the incident.

Do **not** run `npm run setup:db` against production for this change. Do not reuse or
alter the chat-ai table. Do not deploy the limiter before the table exists in the target
environment: the function will (correctly) return 503 for diagnostic requests.

---

## 8. Test plan

### 8.1 Mocked tests (logic only — no live evidence)

These can run without Appwrite, but they only prove branching logic:

- `createRow` success → allowed with count 1, and `incrementRowColumn` is not called.
- `createRow` fails `409 + row_already_exists` → increment path taken.
- `createRow` fails `409 + row_unique_constraint_violation` → 503, increment **not**
  called.
- `createRow` fails `409 + general_resource_locked` → 503.
- `createRow` fails `429 + general_rate_limit_exceeded` → 503, not a user 429.
- `createRow` fails `500`, times out, or returns a malformed body → 503.
- Increment returns 29 → allowed; 30 → allowed; 31 → denied; provider not called.
- Increment is called **without** a `max` field (assert the request payload).
- Increment throws, read shows `count >= limit` → 429.
- Increment throws, read shows `count < limit` → 503.
- Increment throws, read returns `404 row_not_found` → 503 (never a fresh count).
- `APPWRITE_ENV=production` plus `DIAGNOSTIC_RATE_LIMIT_DEV_BYPASS=true` → bypass ignored;
  the limiter enforces, or 503 if the store is unavailable.
- Missing/unknown `APPWRITE_ENV` → production behaviour.
- Dev bypass in `development`/`staging` → explicit skip with a warning; no AI call is
  counted.
- Row ID is 32 lowercase hex characters and changes with window and user.
- Two users produce different row IDs; same user in different windows produces different
  row IDs.
- No sensitive fields are written (no message text, JWT, email, or API key).
- Retention cutoff is exactly `now - 86,400,000` and the query is a bounded `lessThan`
  with a `limit`.

Mocked tests must be labelled as mocked. They do not prove Appwrite's real error types,
atomicity, index enforcement, or concurrency.

### 8.2 Live development/staging tests (currently BLOCKED)

No live run has been performed. The table below is the acceptance plan, not evidence.

| Test | Expected |
|---|---|
| §6.6 schema read-back | exactly 5 columns, correct types/sizes, both indexes `available` |
| First request in a window | allowed, stored `count = 1` |
| Requests 1–30 | allowed |
| 31st request | 429, `retryAfterSeconds` 1–60, provider not called |
| 35 truly concurrent requests | 30 allowed, 5 rejected; final count 30 or 31, never < 30 |
| Next window (60 s later) | count restarts at 1 |
| Two users in the same window | independent counts |
| Old-window request after boundary | cannot change new-window count |
| Limiter store forced unavailable (bad table ID) | 503, provider not called |
| `APPWRITE_ENV=production` + dev bypass set + bad table | 503, provider not called (bypass ignored) |
| Duplicate row creation | raw 409 + `row_already_exists` captured verbatim |
| Composite unique violation (different row ID, same tuple) | raw 409 + `row_unique_constraint_violation`; limiter returns 503 |
| Appwrite-side 429 (if reproducible) | limiter returns 503, not 429 |
| 429/503 responses | no JWT, key, provider text, or stack trace |
| Cleanup job | removes rows older than 24 h; recent rows remain; counts logged |
| Cleanup permissions | no client execute permission; server/schedule only |
| Cleanup on a disposable fixture | cannot delete a current window row |

**Separate `max`-boundary experiment (required before any future use of `max`):** in an
isolated development table, create a row with `count = 29`, call increment with
`max = 30` and record the status, body, returned count, and stored count; repeat at
`count = 30` with `max = 30` and once more to see whether it throws, clamps, or increments.
Record the exact error type and whether the write persisted. If it clamps, `max` must never
be used for quota enforcement, because the returned count would stay at the limit and a
post-check would allow every request. The initial implementation avoids this by not passing
`max` (§5.6), but the experiment is still required before the design can claim the boundary
is understood.

---

## 9. Separate production blockers and adjacent findings (not modified)

The items below are outside the Stage 3.3 brief. They are recorded here so they are not lost,
but they are **not** resolved by this design and must not be marked resolved when the rate
limiter ships.

### 9.1 Separate production blockers (track independently)

**PB-1 — `profiles` schema does not declare `departmentId`.** `web-app/setup-db.js` lines
192–213 declare `institutionId` but not `departmentId`, while
`functions/diagnostic-ai/index.js` lines 1089–1091 deny any `department_admin` without
`actorProfile.departmentId`. If the deployed schema matches the repo, every department
admin receives 403. The live schema is UNVERIFIED. This requires its own schema decision and
migration approval; the rate-limit table neither causes nor fixes it. It is a production
blocker for department admins regardless of Stage 3.3.

**PB-2 — No server-side diagnostic payload-size cap.** The 10 KB limit exists only in
`web-app/src/services/ai/index.ts` (lines 86–135), which a client can bypass. The function
has no body-size check (only the 10 MB material upload cap at line 32). This is a separate
input-validation and cost-control blocker, not a rate-limit feature. A per-minute request
count does not bound the size of a single request. It needs its own validation change and
tests, approved separately.

Neither PB-1 nor PB-2 is addressed by the `diagnostic_rate_limits` migration. They must be
tracked as independent work items with their own owners and approvals.

### 9.2 Adjacent defects (re-verify before relying on Stage 3.2 claims)

1. **Unreachable error handler in `diagnostic-ai`.** A `return` at line 1153 is followed by
   a duplicate, unreachable action block (lines 1155–1197) and the action-level
   `try/catch` (lines 1198–1202). As a result, action errors are not caught, and
   `httpError` status codes are lost. This is a regression from the Stage 3.2 restructure.
   It affects error handling around the limiter and AI call and should be fixed before
   production, but it is not part of the schema decision.
2. **Stage 3.2 report overstates verification.** It claims 18 security tests; the file
   contains 11. It also claims TypeScript/build passes and 35/35 tests pass, which was not
   reproduced in this investigation. Those claims should be re-verified before relying on
   them.

No edits were made to any of the above.

---

## 10. Final recommendation

**B — dedicated `diagnostic_rate_limits` table.**

| Option | Verdict |
|---|---|
| A. Reuse `chat-ai-rate-limits` | **Rejected.** The limiter cannot load (F1), misreads the SDK response (F2), its table creation is invalid and errors are swallowed (F3), its unique index forbids per-window rows (F4), its read path can reset counters (F5), concurrent first requests bypass the limit (F6), and 429/503 classification is unreliable (F7). Reuse would also couple quotas (F9) and depend on an unidentifiable deployed variant (F10). |
| B. Dedicated `diagnostic_rate_limits` | **Recommended.** Schema in §6 (five columns, `bigint` windows, composite unique index), algorithm in §5.6 (no `max`, exact 409-type handling), isolation by construction, production fail-closed behaviour, and 24-hour cleanup defined. |
| C. BLOCKED | **Current implementation status**, not the target. Implementation is blocked until the §6 migration is separately approved. A is not a viable alternative to unblock it. |

**Current status:** BLOCKED pending separate approval of the schema migration in §6 and the
rollout in §7. No implementation, migration, deployment, commit, or push was performed. No
live Appwrite verification was performed, so no claim in this document should be read as
evidence from a deployed project. The existing chat-ai limiter should not be used as
evidence of production readiness; its own defects should be handled in a separate
remediation task.

**Implementation and migration remain blocked pending separate approval.** Approval must be
explicit and must cover the §6 schema, the §7 sequence, and the live verification plan in
§8.2. PB-1 (`departmentId`) and PB-2 (server-side payload cap) remain separate production
blockers and are not cleared by approving this design.

---

## Appendix A — Evidence index

| Claim | File / location |
|---|---|
| ESM import plus `require` in one module | `functions/chat-ai/index.js` lines 14–16; `functions/chat-ai/package.json` `"type": "module"` |
| Row shape has no `data` field | `web-app/node_modules/node-appwrite/dist/models.d.ts` lines 2761–2794 |
| Increment route and `max` payload | `web-app/node_modules/node-appwrite/dist/services/tables-db.js` line 5777 onwards |
| `max` documented as throwing | `web-app/node_modules/node-appwrite/dist/services/tables-db.d.ts` line 2548 |
| `upsertRow` is create-or-update | `web-app/node_modules/node-appwrite/dist/services/tables-db.d.ts` lines 2305–2316 |
| Declared table schema | `web-app/setup-db.js` lines 409–433 |
| Invalid index shape | `web-app/setup-db.js` line 424 vs documented bulk shape in `tables-db.d.ts` line 568 (`attributes`) and dedicated shape at lines 2116–2124 (`columns`) |
| `AppwriteException` exposes `code` and `type` | `web-app/node_modules/node-appwrite/dist/client.d.ts` lines 59–64 |
| Duplicate-row error type and status | Appwrite `src/Appwrite/Extend/Exception.php` (`ROW_ALREADY_EXISTS = 'row_already_exists'`), `app/config/errors.php` (409) |
| Other 409 error types | Appwrite `Exception.php` / `errors.php` (`row_unique_constraint_violation`, `general_resource_locked`) |
| Appwrite endpoint 429 type | Appwrite `Exception.php` / `errors.php` (`general_rate_limit_exceeded`, 429) |
| `integer` is 32-bit; `bigint` is 64-bit | `https://appwrite.io/docs/products/databases/tablesdb/atomic-numeric-operations` |
| Atomic increment returns the new value | Same atomic-numeric-operations page |
| Bulk column types include `bigint`; required `size` for `varchar` | `web-app/node_modules/node-appwrite/dist/services/tables-db.d.ts` line 567 |
| Row system `$createdAt` / `$updatedAt` | `web-app/node_modules/node-appwrite/dist/models.d.ts` (Row model) |

---

## Appendix B — Unresolved verification requirements and approval gate

### B.1 Unresolved verification requirements

The following are **not** resolved by this document. Each must be measured against a real
development project and recorded with the raw request/response before the design can be
called verified:

1. The deployed project's exact duplicate-row error: HTTP status and `type` (expected
   `409` + `row_already_exists`; a legacy `document_already_exists` is possible).
2. Whether the composite unique index on (`scope`, `userId`, `windowStart`) is accepted and
   enforced, and the exact error type when it fires (`row_unique_constraint_violation`
   expected).
3. Which index payload key the deployed server accepts: `columns` (dedicated
   `createIndex`) or `attributes` (bulk `createTable`), and whether both indexes report
   `available` with the intended definition.
4. That a `bigint` column round-trips an epoch-millisecond value exactly (proving it is not
   truncated like `integer`).
5. That `incrementRowColumn` is atomic under real concurrency and returns the new count at
   the top level of the row.
6. The `max` boundary: throw vs clamp, the exact error type/status, and whether the increment
   persists before the error. This is required before any future use of `max`; the initial
   implementation deliberately does not pass it.
7. Whether `$updatedAt` is refreshed by `incrementRowColumn` (informational only).
8. That production/unknown `APPWRITE_ENV` plus a dev bypass still returns 503 when the store
   is unavailable, and never calls the AI provider.
9. That cleanup runs with no client execute permission, uses a least-privilege key, deletes
   only rows older than 24 hours, and leaves current rows intact.
10. That client SDK access to the table is denied while the server key succeeds.
11. The live 30/31 boundary, 35-way concurrency result, 60-second reset, two-user isolation,
    stale-window behaviour, and absence of token/key/provider leakage in responses.
12. Whether an Appwrite-side 429 from the limiter store is distinguishable and converted to
    503 rather than a misleading user 429.

### B.2 Approval gate

**Implementation and migration remain blocked pending separate approval.** No table, column,
index, permission, migration, environment variable, code, deployment, commit, or push was
created or changed for Stage 3.3. This revision only updates this design document. No live
Appwrite verification was performed.

Approval must explicitly cover the §6 schema, the §7 rollout sequence, and the §8.2/B.1
verification plan. PB-1 (`profiles.departmentId`) and PB-2 (server-side diagnostic payload
cap) are separate production blockers and are **not** cleared by approving this design.
| Read error treated as absent | `functions/chat-ai/index.js` lines 72–81 |
| First-request upsert | `functions/chat-ai/index.js` lines 87–103 |
| `.data` access | `functions/chat-ai/index.js` line 118 |
| Substring `"max"` classification | `functions/chat-ai/index.js` lines 192–194 |
| Tautological tests / `require` in `.mjs` | `functions/chat-ai/test/rateLimit.test.mjs` lines 36–41, 61–78, 83–88, 155–164, 251, 305 |
| Deployment variant without auth/limiter; API key in request URL | `functions/chat-ai-deployment/src/main.js` (file-wide; URL built at line 25) |
| Verified identity source | `functions/diagnostic-ai/index.js` lines 129–152 |
| Diagnostic branch and scope checks | `functions/diagnostic-ai/index.js` lines 1080–1108 |
| Lost HTTP status in helper | `functions/diagnostic-ai/index.js` lines 114–116 |
| Unreachable action block | `functions/diagnostic-ai/index.js` lines 1153–1202 |
| Profiles columns | `web-app/setup-db.js` lines 192–213 |
| Client-only payload limit | `web-app/src/services/ai/index.ts` lines 86–135 |
