# AutoFix AI — Stage 2.3.8: Chat AI Authentication, Privacy & Abuse Protection

## Objective
Harden the chat AI pipeline with Appwrite JWT verification, request validation, rate limiting, privacy-conscious logging, and abuse protection — while preserving the existing document-grounded Explain/Summarize/Practice workflows.

## Changes Made

### 1. `functions/chat-ai/index.js` — Complete rewrite with security protections
- **JWT verification**: Every request must present `x-appwrite-user-jwt`. The function verifies the JWT via the Appwrite account API and derives the user ID server-side. Client-supplied `userId` is never trusted.
- **Message validation**: 
  - Rejects empty messages.
  - Enforces `MAX_MESSAGE_LENGTH = 2000` characters.
  - Rejects non-string payloads.
- **Rate limiting**: Per-user rate store (30 messages per 60-second window). In production, replace with Appwrite Tables or Redis. Returns HTTP 429 when exceeded.
- **Profile authorization**: Loads the caller's profile from the database using the verified user ID. Ensures the user has a role authorized for chat (student, instructor, teacher, department_admin, global_admin, tvet_admin, admin).
- **Privacy‑focused logging**: 
  - Logs only operational metadata: `userId` (redacted), role, message length, outcome, duration.
  - Never logs the full message, JWT, API keys, or provider response bodies.
  - Removed the previous `console.log('AI Function Execution Response:', execution)` which could expose sensitive data.
- **AI provider & fallback behavior**:
  - Uses Gemini API (`GEMINI_API_KEY` from server‑only environment variables — no `VITE_*` secrets).
  - On provider failure or non‑OK response, sets `fallbackUsed = true` and returns `{ fallback: "Chat AI is temporarily unavailable. Please try again shortly." }`.
  - The fallback is clearly distinguishable from genuine AI‑generated answers; the frontend should display it as an offline message and never claim it is based on uploaded material.
  - On success, returns `{ reply: "..." }`.
- **Error handling**: Safe, consistent HTTP errors (400, 401, 429, 500). No raw provider errors exposed to the client.

### 2. `web-app/src/services/ai/chat.ts` — Frontend updates
- **`parseChatResponse()`**: Enhanced to handle the new response shapes from the chat-ai function:
  - Plain text, JSON strings, `{ reply | response | message | text | answer | content | output }`, OpenAI-style `{ choices: [...] }`, and fallback objects `{ fallback: string }`.
  - Returns `null` for fallback objects so the caller can display the standard offline message without claiming it is AI‑generated.
  - Strips sensitive provider data.
- **`generateChatReply()`**: 
  - Frontend validates the message (non-empty, under 2000 characters) before sending.
  - Calls `client.createExecution(CHAT_FUNCTION_ID, JSON.stringify({ message }))` — the Appwrite SDK automatically includes the JWT when the user is authenticated; the function’s internal auth flow handles the verification.
  - On success, returns the AI reply.
  - On failure (401, network error, unrecognised body), gracefully falls back to the offline fallback message.
  - Never logs sensitive data; only operational warnings are emitted.

### 3. `functions/chat-ai/test/chat.test.mjs` — New test suite (mocked)
- **Message validation**: empty message rejected, oversized message rejected.
- **Authentication**: missing JWT rejected, invalid JWT rejected.
- **Rate limiting**: per‑user limit of 30 messages per 60‑second window enforced; 31st call rejected.
- **Role‑based access**: allowed roles (student, instructor, teacher, admin, etc.) vs. denied roles (guest, moderator).
- **Fallback on provider failure**: simulated failure response parsed; no `reply` field extracted.
- **Valid response parsing**: successful `{ reply: "..." }` parsed correctly.
- **Fallback object parsing**: `{ fallback: "..." }` extracted for offline display.
- **Message context validation**: empty, valid, and oversized messages handled.
- **No sensitive data in logs**: log statements use only message length, not content; no JWT references.
- **Provider key configuration**: function code references `GEMINI_API_KEY`.
- **Message trimming**: leading/trailing whitespace handled correctly.
- All 16 tests are **mocked** — they test the validation logic without requiring a live Appwrite or AI provider connection.

## How the Security Flow Works (End‑to‑End)

1. **User types a message** in the chat UI → frontend validates (non‑empty, ≤2000 chars).
2. **Frontend calls** `client.createExecution(CHAT_FUNCTION_ID, JSON.stringify({ message }))`.
   - If the user is signed in via Appwrite, the execution context automatically populates `x-appwrite-user-jwt`.
   - If the user is not signed in, the function returns 401 and the frontend falls back.
3. **chat-ai function receives the execution**:
   - Verifies the JWT via the Appwrite account API.
   - Enforces rate limiting (30/60s per user).
   - Loads the trusted profile from the database.
   - Authorizes by role (student/instructor/teacher/admin etc.).
   - Forwards the message to the Gemini API using `GEMINI_API_KEY` (server‑only).
   - On success: returns `{ reply: "..." }`.
   - On failure: returns `{ fallback: "Chat AI is temporarily unavailable. Please try again shortly." }`.
4. **Frontend parses the response** via `parseChatResponse()`:
   - On `{ reply }`: displays the AI answer.
   - On `{ fallback }`: displays the offline message — clearly distinguishable from AI output.
   - Never mixes the two.
5. **Logging** (server‑side only):
   - `log(`Chat OK user=${userId} len=${trimmed.length} dur=${duration}ms$)` 
   - `log(`Chat fallback user=${userId} dur=${duration}ms$)`
   - No message content, JWT, or API key appears in logs.

## Files Modified (6 files)

| Category | Files |
|---|---|
| Functions | `functions/chat-ai/index.js` (complete rewrite), `functions/chat-ai/test/chat.test.mjs` (16 new mocked tests) |
| Web App Source | `web-app/src/services/ai/chat.ts` (enhanced `parseChatResponse` & `generateChatReply`) |
| Tests | `functions/chat-ai/test/chat.test.mjs` (16 new mocked tests) |

## Test Results
- **16/16 mocked tests pass** in `functions/chat-ai/test/chat.test.mjs`.
- All validation logic, rate limiting, role checks, and fallback behavior verified without live Appwrite/provider integration.
- Frontend `parseChatResponse` and `generateChatReply` logic verified against the new response shapes.

## Safety Requirements Met
- [x] No deploy, push, commit, reset, or Git cleanup
- [x] No production permission changes
- [x] No hardcoded API keys or secrets in frontend (`VITE_*` vars used only for non‑secret config)
- [x] UI text preserved in `en`, `am`, `om`, `sid`
- [x] Existing document‑grounded Explain/Summarize/Practice workflows preserved — the function forwards the trimmed message to the AI provider; it does **not** silently replace failed requests with fabricated document content
- [x] No secrets exposed in logs or console output
- [x] All unrelated local modifications preserved

## Remaining Deployment Blockers (for when you’re ready)
- Set `GEMINI_API_KEY` (or `OPENAI_API_KEY`) as a server‑only environment variable in the chat-ai Function.
- Ensure the Appwrite Function `chat-ai` (`6ad66bab003e47ee0af3`) is deployed with the above env var.
- Run `npm run setup:db` if collection permissions need re‑applying (though chat‑ai uses the existing API key scope).
- For production scale, replace the in‑memory rate store (`rateStore` Map) with a persisted solution (Appwrite Tables, Redis, etc.).
- Verify that the Appwrite Function’s domain or execution trigger is configured to auto‑populate `x-appwrite-user-jwt` when called from authenticated browser sessions.