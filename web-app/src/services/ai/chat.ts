import { client } from '../../lib/appwrite';
import i18n from '../../lib/i18n';

/**
 * Appwrite Function ID for the chat AI.
 * This ID is configured in the web app environment and points to the
 * chat-ai function which handles authentication, rate limiting, and
 * privacy protection server-side.
 */
const CHAT_FUNCTION_ID = '6ad66bab003e47ee0af3';

/**
 * Friendly fallback reply shown when the AI provider is unavailable.
 * This key is registered in i18next under the 'dashboard' namespace
 * with key 'chat_fallback'.
 */
const fallbackReply = (message: string) =>
  i18n.t('dashboard.chat_fallback', {
    message: message.slice(0, 120),
    id: CHAT_FUNCTION_ID,
  });

/**
 * Extract a human-readable reply from an Appwrite function's `responseBody`.
 * 
 * Handles:
 *   - plain text
 *   - JSON strings (`"hello"`)
 *   - `{ reply | response | message | text | answer | content | output }`
 *   - OpenAI-style `{ choices: [{ message: { content } }] }`
 *   - Fallback objects `{ fallback: string }` (returned as-is so the
 *     caller can display the offline message)
 * 
 * Returns `null` when no usable text can be found.
 */
export function parseChatResponse(responseBody?: string | null): string | null {
  if (!responseBody) return null;

  const trimmed = responseBody.trim();
  if (!trimmed) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    // Not JSON — the function returned plain text.
    // If the plain text resembles a fallback message, return null so the
    // caller can show the standard offline fallback instead of raw text.
    if (trimmed.includes('Chat AI is temporarily unavailable')) {
      return null;
    }
    return trimmed;
  }

  if (typeof parsed === 'string') {
    return parsed.trim() || null;
  }

  if (!parsed || typeof parsed !== 'object') {
    return null;
  }

  const data = parsed as Record<string, unknown>;

  // Direct string fields used by our functions / common APIs.
  const directFields = ['reply', 'response', 'message', 'text', 'answer', 'content', 'output'];
  for (const field of directFields) {
    const value = data[field];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  // OpenAI-style chat completion payload.
  if (Array.isArray(data.choices)) {
    const content = (data.choices[0] as { message?: { content?: unknown } } | undefined)
      ?.message?.content;
    if (typeof content === 'string' && content.trim()) {
      return content.trim();
    }
  }

  // Fallback object from the server: { fallback: "..." }
  if (data?.fallback && typeof data?.fallback === 'string') {
    return data.fallback; // caller will display the offline message
  }

  return null;
}

/**
 * Send a single message to the AI assistant and return its reply.
 * 
 * Workflow:
 *   1. Frontend validates the message (max length, non-empty).
 *   2. Frontend calls `functions.createExecution` with the chat-ai Function ID.
 *   3. The chat-ai Function verifies the Appwrite JWT from the execution context,
 *      enforces rate limits, loads the trusted profile, and forwards the request
 *      to the AI provider (OpenAI/Gemini).
 *   4. The function returns `{ reply: string }` on success, or `{ error: string }`,
 *     or `{ fallback: string }` when the provider is unavailable.
 *   5. The frontend parses the response and either shows the AI reply or the
 *     offline fallback — never mixes the two.
 * 
 * The function requires a verified Appwrite JWT (automatic when the user is
 * signed in via Appwrite SDK). Unauthenticated calls are rejected at the
 * server with a 401, which manifests as an error caught below.
 */
export async function generateChatReply(message: string): Promise<string> {
  // 1. Frontend validation — must not be empty and must respect the length limit.
  const trimmed = message.trim();
  if (!trimmed) {
    return i18n.t('dashboard.chat_fallback', {
      message: '',
      id: CHAT_FUNCTION_ID,
    });
  }
  if (trimmed.length > 2000) {
    // Silently truncate or error; here we show the fallback.
    return i18n.t('dashboard.chat_fallback', {
      message: trimmed.slice(0, 120),
      id: CHAT_FUNCTION_ID,
    });
  }

  // 2. Call the Chat AI Function.
  //    The Appwrite SDK's createExecution will include the JWT automatically
    // when the user is authenticated (the execution context populates
    // x-appwrite-user-jwt). If the user is not signed in, the function returns
    // a 401, which we catch and fall back to the offline reply.
    try {
      const execution = await client.createExecution(
        CHAT_FUNCTION_ID,
        JSON.stringify({ message })
      );

      const statusCode = execution.responseStatusCode ?? 0;
      const failed = execution.status === 'failed' || (statusCode > 0 && statusCode >= 400);

      if (!failed && execution.responseBody) {
        const parsed = parseChatResponse(execution.responseBody);
        if (parsed) {
          return parsed;
        }
      }

      // If we reach here, the function either failed, returned an unrecognised
      // body, or returned a fallback. Fall back to the offline message.
      const warnMsg = [
        'AI Function Execution Response:',
        execution.status,
        execution.responseStatusCode,
        execution.responseBody,
      ].filter(Boolean).join(' ');
      // Log operatively — do not expose raw bodies in production logs.
      // In a production build, this would go through a secure logger.
      // eslint-disable-next-line no-console
      console.warn('[chat-ai] Unexpected response:', warnMsg);

      // Fall back to the offline friendly message.
      return i18n.t('dashboard.chat_fallback', {
        message: trimmed.slice(0, 120),
        id: CHAT_FUNCTION_ID,
      });
    } catch (error: any) {
      // Function not deployed / network / permission error.
      // The chat-ai function handles auth failures (401) and returns appropriate
      // errors; here we just fall back to the offline reply.
      // eslint-disable-next-line no-console
      console.error('AI Function Error:', error.message || 'Unknown error');

      return i18n.t('dashboard.chat_fallback', {
        message: trimmed.slice(0, 120),
        id: CHAT_FUNCTION_ID,
      });
    }
  }