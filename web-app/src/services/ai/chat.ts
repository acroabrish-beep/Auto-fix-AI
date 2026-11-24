import { client } from '../../lib/appwrite';
import { Functions } from 'appwrite';
import i18n from '../../lib/i18n';

const functions = new Functions(client);

const CHAT_FUNCTION_ID = (import.meta.env.VITE_APPWRITE_CHAT_FUNCTION_ID as string | undefined)?.trim() || '';

/**
 * Friendly fallback reply shown when the AI provider is unavailable.
 */
const fallbackReply = (message: string) =>
  i18n.t('dashboard.chat_fallback', {
    message: message.slice(0, 120),
    id: CHAT_FUNCTION_ID,
  });

export function parseChatResponse(responseBody?: string | null): string | null {
  if (!responseBody) return null;

  const trimmed = responseBody.trim();
  if (!trimmed) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
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

  const directFields = ['reply', 'response', 'message', 'text', 'answer', 'content', 'output'];
  for (const field of directFields) {
    const value = data[field];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  if (Array.isArray(data.choices)) {
    const content = (data.choices[0] as { message?: { content?: unknown } } | undefined)
      ?.message?.content;
    if (typeof content === 'string' && content.trim()) {
      return content.trim();
    }
  }

  if (data?.fallback && typeof data?.fallback === 'string') {
    return data.fallback;
  }

  return null;
}

export async function generateChatReply(message: string, systemPrompt?: string): Promise<string> {
  const trimmed = message.trim();
  if (!trimmed) {
    return fallbackReply('');
  }
  if (trimmed.length > 2000) {
    return fallbackReply(trimmed.slice(0, 120));
  }

  if (!CHAT_FUNCTION_ID) {
    throw new Error('The chat service is not configured. Please contact your administrator.');
  }

  let execution: any;
  try {
    execution = await functions.createExecution(
      CHAT_FUNCTION_ID,
      JSON.stringify({ message: trimmed, systemPrompt: systemPrompt?.trim() || undefined })
    );
  } catch (error: any) {
    console.error('[chat-ai] execution error', {
      code: error?.code ?? error?.status,
      message: error?.message || 'Unknown error',
    });
    const msg = (error?.message || '').toLowerCase();
    if (/network|cors|failed to fetch|load failed/.test(msg)) {
      throw new Error('Network error. Please check your connection and try again.');
    }
    if (error?.code === 404 || /not found/.test(msg)) {
      throw new Error('The chat service is not available right now.');
    }
    if (error?.code === 401 || /unauthorized|authentication/.test(msg)) {
      throw new Error('You are not allowed to use the chat. Please sign in.');
    }
    throw new Error('Something went wrong. Please try again later.');
  }

  const statusCode = execution.responseStatusCode ?? 0;
  const failed = execution.status === 'failed' || (statusCode > 0 && statusCode >= 400);

  if (failed) {
    let serverMessage = '';
    try {
      const parsed = execution.responseBody ? JSON.parse(execution.responseBody) : null;
      serverMessage = parsed?.error || '';
    } catch { /* ignore */ }
    console.error('[chat-ai] execution failed', { status: statusCode, body: execution.responseBody });
    if (statusCode === 401) throw new Error('You are not allowed to use the chat. Please sign in.');
    if (statusCode === 404) throw new Error('The chat service is not available right now.');
    if (statusCode >= 500) throw new Error('Something went wrong on our side. Please try again later.');
    throw new Error(serverMessage || 'Something went wrong. Please try again.');
  }

  if (execution.responseBody) {
    const parsed = parseChatResponse(execution.responseBody);
    if (parsed) {
      return parsed;
    }
  }

  console.warn('[chat-ai] Unexpected response:', execution.status, execution.responseStatusCode);
  return fallbackReply(trimmed);
}
