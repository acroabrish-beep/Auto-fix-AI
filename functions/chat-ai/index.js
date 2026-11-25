/* 
  APPWRITE FUNCTION: chat-ai
  
  Secure proxy between the AutoFix AI chat UI and OpenAI.
  Verifies Appwrite JWT, enforces atomic distributed rate limits with window reset, protects user privacy.
  
  Store OPENAI_API_KEY in the Appwrite Function environment variables.
  Never expose API keys, JWTs, or user data to the frontend.
  
  Input  (POST JSON): { "message": "My car cranks but won't start" }
  Output (JSON):      { "reply": "..." } | { "error": "..." } | { "fallback": "..." }
*/

import { createHash } from 'node:crypto';
import { TablesDB, Client } from 'node-appwrite';

const endpoint =
  process.env.APPWRITE_FUNCTION_API_ENDPOINT ||
  process.env.APPWRITE_ENDPOINT ||
  'https://fra.cloud.appwrite.io/v1';
const projectId =
  process.env.APPWRITE_FUNCTION_PROJECT_ID || process.env.APPWRITE_PROJECT_ID;

const geminiApiKey = process.env.GEMINI_API_KEY || '';
const geminiModel = process.env.GEMINI_MODEL || 'gemini-3.8-flash';

const MAX_MESSAGE_LENGTH = 2000;
const RATE_LIMIT_MAX = 30;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;

// TablesDB persistent rate limiter â€” shared across Function instances, atomic increments with window reset.
// Row ID: 32-char SHA-256 hash of "userId:windowStart" (first 32 of 64).
// Satisfies Appwrite custom row ID constraint: max 36 chars, hex-only characters.
// Deterministic: same user+window always produces the same ID.
// Different users/windows produce different IDs (with overwhelming probability).
// Eliminates stale-window race conditions while staying within Appwrite row-ID limits.

// TablesDB persistent rate limiter â€” shared across Function instances, atomic increments with window reset.
// Use Appwrite's per-execution key. It is injected in x-appwrite-key and
// is limited by this Function's configured scopes; no manually managed key
// or stale APPWRITE_API_KEY secret is required.
function createTablesDB(req) {
  const executionKey = req.headers?.['x-appwrite-key'];
  if (!executionKey || typeof executionKey !== 'string') {
    throw new Error('Appwrite execution key is missing.');
  }
  const tablesClient = new Client()
    .setEndpoint(endpoint)
    .setProject(projectId)
    .setKey(executionKey);
  return new TablesDB(tablesClient);
}

// Table name: chat-ai rate limits; created idempotently in setup-db.js
const RATE_LIMIT_TABLE = 'chat-ai-rate-limits';

// ---------------------------------------------------------------------------
// Atomic rate limiter using Appwrite TablesDB with per-user, per-window row IDs.
// Row ID: 32-char SHA-256 hash of "userId:windowStart" (first 32 of 64).
// Satisfies Appwrite custom row ID constraint: max 36 chars, hex-only characters.
// Deterministic: same user+window always produces the same ID.
// Different users/windows produce different IDs (with overwhelming probability).
// No separate window-detection check is needed â€” the row ID guarantees correctness.
// ---------------------------------------------------------------------------

async function upsertRateLimit(userId, tablesdb) {
  const now = Date.now();
  const windowStart = Math.floor(now / RATE_LIMIT_WINDOW_MS) * RATE_LIMIT_WINDOW_MS;
  const windowEnd = windowStart + RATE_LIMIT_WINDOW_MS;
  // Per-user, per-window row ID â€” 32-char SHA-256 hash of "userId:windowStart".
  // This satisfies Appwrite custom row ID constraints (max 36 chars, hex-only).
  // Deterministic: same user+window always produces the same ID.
  // Different users/windows produce different IDs (with overwhelming probability).
  const rowIdInput = `${userId}:${windowStart}`;
  const hash = createHash('sha256').update(rowIdInput).digest('hex');
  // SHA-256 produces exactly 64 hex chars; Appwrite allows max 36.
  // We use the first 32 chars to satisfy the 36-char limit while preserving
  // enough entropy for uniqueness within the same user+window space.
  const rowId = hash.substring(0, 32);

  // Step 1: Try to read the current row for this user in the current window.
  let existing;
  try {
    existing = await tablesdb.getRow({
      databaseId: process.env.APPWRITE_DATABASE_ID || 'autofix-ai-db',
      tableId: RATE_LIMIT_TABLE,
      rowId: rowId,
    });
  } catch (getErr) {
    // Row not found â€” first request in this window for this user.
    existing = null;
  }

  // Step 2: Handle based on row existence.
  // Because the row ID includes the windowStart, there is no separate window-detection step:
  // - If row doesn't exist â†’ first request in this window â†’ create with count=1
  // - If row exists â†’ same window â†’ atomically increment (incrementRowColumn with max=30 is atomic at Appwrite backend)
  if (!existing) {
    // First request in this window â€” create the row with count=1.
    // This is safe for concurrent first-time users: both may execute getRow â†’ row not found
    // â†’ both execute upsertRow â†’ due to upsertRow atomicity at the Appwrite backend level,
    // only one "wins" the row creation but both set count=1, resulting in count=1 (well under 30).
    await tablesdb.upsertRow({
      databaseId: process.env.APPWRITE_DATABASE_ID || 'autofix-ai-db',
      tableId: RATE_LIMIT_TABLE,
      rowId: rowId,
      data: {
        userId,
        count: 1,
        windowEnd,
        updatedAt: new Date().toISOString(),
      },
    });
    return { count: 1, exceeded: false };
  } else {
    // Same window â€” atomically increment the count.
    // incrementRowColumn with max=30 is atomic at the Appwrite backend level:
    //   - new count â‰¤ 30 â†’ operation succeeds, count is incremented atomically
    //   - new count > 30   â†’ operation fails (throws), caller receives HTTP 429
    try {
      const result = await tablesdb.incrementRowColumn({
        databaseId: process.env.APPWRITE_DATABASE_ID || 'autofix-ai-db',
        tableId: RATE_LIMIT_TABLE,
        rowId: rowId,
        column: 'count',
        value: 1,
        max: RATE_LIMIT_MAX, // 30 â€” new count must not exceed this
      });
      const newCount = result?.data?.count ?? existing.data.count + 1;
      const exceeded = newCount > RATE_LIMIT_MAX;
      return { count: newCount, exceeded };
    } catch (incrementErr) {
      // incrementRowColumn failed. The only expected reason is max exceeded (new count > 30).
      // Re-throw so the caller receives HTTP 429.
      throw incrementErr;
    }
  }
}

// ---------------------------------------------------------------------------
// Entrypoint
// ---------------------------------------------------------------------------

export default async (context) => {
  const { req, res, log, error } = context;

  if (req.method !== 'POST') {
    return res.json({ error: 'Method not allowed. Use POST.' }, 405);
  }

  let payload;
  try {
    payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.json({ error: 'Invalid JSON payload.' }, 400);
  }

  // 1. Validate message shape and size
  const message = payload?.message;
  if (typeof message !== 'string' || !message.trim()) {
    return res.json({ error: 'A non-empty "message" string is required.' }, 400);
  }
  const trimmed = message.trim();
  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    return res.json({ error: `Message exceeds maximum length (${MAX_MESSAGE_LENGTH} characters).` }, 400);
  }
  const systemPrompt = typeof payload?.systemPrompt === 'string' ? payload.systemPrompt.trim().slice(0, 2000) : '';

  // 2. Authenticate.
  //    Prefer Appwrite's own x-appwrite-user-id header: Appwrite sets it
  //    itself for executions by a signed-in user and clients cannot override
  //    x-appwrite-* headers. If absent, fall back to verifying a JWT.
  //    Log header NAMES only — never tokens or keys.
  const headerNames = Object.keys(req.headers || {}).join(', ');
  log(`Auth headers received: ${headerNames}`);

  let userId = null;

  const userIdFromHeader =
    req.headers['x-appwrite-user-id'] &&
    typeof req.headers['x-appwrite-user-id'] === 'string'
      ? req.headers['x-appwrite-user-id']
      : null;

  if (userIdFromHeader) {
    // Trusted: Appwrite sets this header for signed-in executions.
    userId = userIdFromHeader;
  } else {
    // Fall back to JWT verification (body `jwt`, then `x-appwrite-user-jwt` header).
    const jwt =
      (payload?.jwt && typeof payload.jwt === 'string'
        ? payload.jwt
        : req.headers['x-appwrite-user-jwt'] &&
          typeof req.headers['x-appwrite-user-jwt'] === 'string'
        ? req.headers['x-appwrite-user-jwt']
        : null);

    if (!jwt) {
      return res.json({ error: 'Authentication required. Please sign in to continue.' }, 401);
    }

    if (!projectId) {
      log('Auth config error: APPWRITE_FUNCTION_PROJECT_ID / APPWRITE_PROJECT_ID is not set');
      return res.json({ error: 'Authentication service is not configured.' }, 500);
    }

    // Verify JWT using Appwrite account API
    try {
      const verifyRes = await fetch(`${endpoint}/account`, {
        headers: {
          'X-Appwrite-Project': projectId,
          'X-Appwrite-JWT': jwt,
          Accept: 'application/json',
        },
      });

      if (!verifyRes.ok) {
        const endpointHost = endpoint ? new URL(endpoint).host : '(unset)';
        const bodyText = await verifyRes.text().catch(() => '');
        log(
          `JWT verification failed host=${endpointHost} status=${verifyRes.status} body=${bodyText}`
        );
        return res.json({ error: 'Authentication required.' }, 401);
      }

      const account = await verifyRes.json();
      userId = typeof account?.$id === 'string' ? account.$id : null;
    } catch (err) {
      const endpointHost = endpoint ? new URL(endpoint).host : '(unset)';
      log(`JWT verification error host=${endpointHost} message=${err.message}`);
      return res.json({ error: 'Authentication required.' }, 401);
    }

    if (!userId) {
      return res.json({ error: 'Authentication required.' }, 401);
    }
  }

  // 3. Atomic persistent rate-limiting â€” shared across Function instances with per-window row IDs.
  //    incrementRowColumn atomically increments the counter and enforces the max.
  //    Never an in-memory Map â€” always backed by Appwrite TablesDB.
  let rateCheck;
  try {
    const tablesdb = createTablesDB(req);
    rateCheck = await upsertRateLimit(userId, tablesdb);
  } catch (err) {
    // Max exceeded â†’ HTTP 429; store unavailable â†’ HTTP 503
    if (err.message && err.message.toLowerCase().includes('max')) {
      return res.json({ error: 'You are sending messages too quickly. Please wait a moment and try again.' }, 429);
    }
    // TablesDB / persistent store unavailable â€” fail closed
    error('Rate limit service unavailable: ' + (err.message || 'unknown'));
    return res.json({ error: 'Service temporarily unavailable. Please try again later.' }, 503);
  }

  if (rateCheck.exceeded) {
    return res.json({ error: 'You are sending messages too quickly. Please wait a moment and try again.' }, 429);
  }

  // 4. Log only operational metadata â€” never message content, JWTs, or API keys
  const startTime = Date.now();

  // 5. AI provider call
  if (!geminiApiKey) {
    error('GEMINI_API_KEY is not configured for chat-ai.');
    return res.json({ error: 'AI assistant is not configured. Please contact the administrator.' }, 503);
  }

  let reply = null;
  let fallbackUsed = false;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent`, {
      method: 'POST',
      signal: AbortSignal.timeout(18_000),
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': geminiApiKey,
      },
      body: JSON.stringify({
        ...(systemPrompt ? { systemInstruction: { parts: [{ text: systemPrompt }] } } : {}),
        contents: [{ role: 'user', parts: [{ text: trimmed }] }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      log(`Gemini API error status=${response.status} body=${errorText}`);
      fallbackUsed = true;
    } else {
      const aiData = await response.json();
      const content = aiData?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (content && typeof content === 'string' && content.trim()) {
        reply = content.trim();
      } else {
        fallbackUsed = true;
      }
    }
  } catch (err) {
    // Network / provider error
    log(`Gemini call error message=${err.message}`);
    fallbackUsed = true;
  }

  // 6. Respond
  if (reply) {
    // Log success metadata only
    const duration = Date.now() - startTime;
    log(`Chat OK user=${userId} len=${trimmed.length} dur=${duration}ms`);
    return res.json({ reply });
  }

  // Fallback â€” clearly distinguishable from genuine AI replies
  const fallbackText = `Chat AI is temporarily unavailable. Please try again shortly.`;
  const duration = Date.now() - startTime;
  log(`Chat fallback user=${userId} dur=${duration}ms`);
  return res.json({ fallback: fallbackText });
};


