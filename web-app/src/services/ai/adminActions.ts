import { client } from '../../lib/appwrite/client';
import { Functions } from 'appwrite';

const functions = new Functions(client);

function getServerFunctionId(): string {
  const functionId = (import.meta.env.VITE_APPWRITE_ADMIN_FUNCTION_ID || import.meta.env.VITE_APPWRITE_DIAGNOSTIC_FUNCTION_ID || '').trim();

  if (!functionId) {
    throw new Error('The diagnostic service is not configured. Please contact your administrator.');
  }
  return functionId;
}

function classifyError(error: any, statusCode?: number): { message: string; status: number } {
  const rawMessage = error?.message || (typeof error === 'string' ? error : '');
  const code = error?.code ?? error?.status ?? statusCode ?? 0;
  // Log real details for operators; never surface them to users.
  // eslint-disable-next-line no-console
  console.error('[adminActions] execution error', { code, status: statusCode, message: rawMessage });

  const msg = rawMessage.toLowerCase();
  if (code === 401 || /unauthorized|authentication required|not allowed/.test(msg)) {
    return { message: 'You are not allowed to perform this action. Please sign in and try again.', status: 401 };
  }
  if (code === 404 || /not found|function.*not.*found|no matching/.test(msg)) {
    return { message: 'The requested service is not available. Please try again later.', status: 404 };
  }
  if (/network|cors|failed to fetch|load failed|typeerror/.test(msg)) {
    return { message: 'Network error. Please check your connection and try again.', status: 0 };
  }
  if (code >= 500 || code === 0) {
    return { message: 'Something went wrong on our side. Please try again later.', status: 500 };
  }
  return { message: 'Something went wrong. Please try again.', status: code || 500 };
}

export async function runAdminAction<T = unknown>(
  action: string,
  payload: Record<string, any> = {}
): Promise<T> {
  let execution: any;
  try {
    execution = await functions.createExecution(
      getServerFunctionId(),
      JSON.stringify({ action, payload })
    );
  } catch (error: any) {
    const { message } = classifyError(error);
    throw new Error(message);
  }

  const statusCode = execution?.responseStatusCode ?? 0;

  const parseBody = () => {
    if (!execution?.responseBody) return null;
    try {
      return JSON.parse(execution.responseBody);
    } catch {
      return null;
    }
  };

  const parsedBody = parseBody();

  if (execution?.status === 'failed' || statusCode >= 400) {
    const { message } = classifyError(new Error(parsedBody?.error || ''), statusCode);
    throw new Error(message);
  }

  if (!execution?.responseBody) {
    throw new Error('Something went wrong. Please try again.');
  }

  if (parsedBody?.error) {
    const { message } = classifyError(new Error(parsedBody.error), statusCode);
    throw new Error(message);
  }

  if (parsedBody && typeof parsedBody === 'object' && 'data' in parsedBody) {
    return (parsedBody as { data: T }).data;
  }

  return parsedBody as T;
}
