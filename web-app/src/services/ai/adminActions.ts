import { client } from '../../lib/appwrite/client';
import { Functions } from 'appwrite';

const functions = new Functions(client);

function getServerFunctionId(): string {
  const functionId = (
    import.meta.env.VITE_APPWRITE_ADMIN_FUNCTION_ID ||
    import.meta.env.VITE_APPWRITE_DIAGNOSTIC_FUNCTION_ID ||
    ''
  ).trim();

  if (!functionId) {
    throw new Error(
      'VITE_APPWRITE_ADMIN_FUNCTION_ID is not configured. Set it to the deployed diagnostic-ai Function ID.'
    );
  }
  return functionId;
}

export async function runAdminAction<T = unknown>(
  action: string,
  payload: Record<string, any> = {}
): Promise<T> {
  const execution = await functions.createExecution(
    getServerFunctionId(),
    JSON.stringify({ action, payload })
  );

  const statusCode = execution.responseStatusCode ?? 0;

  const parseBody = () => {
    if (!execution.responseBody) return null;
    try {
      return JSON.parse(execution.responseBody);
    } catch {
      return null;
    }
  };

  const parsedBody = parseBody();

  if (execution.status === 'failed' || statusCode >= 400) {
    throw new Error(parsedBody?.error || execution.responseBody || 'Admin action failed.');
  }

  if (!execution.responseBody) {
    throw new Error('Admin action returned an empty response.');
  }

  if (parsedBody?.error) {
    throw new Error(parsedBody.error);
  }

  if (parsedBody && typeof parsedBody === 'object' && 'data' in parsedBody) {
    return (parsedBody as { data: T }).data;
  }

  return parsedBody as T;
}

