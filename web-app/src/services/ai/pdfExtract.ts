import { client } from '../../lib/appwrite/client';
import { Functions } from 'appwrite';

const functions = new Functions(client);

const PDF_EXTRACT_FUNCTION_ID =
  (import.meta.env.VITE_APPWRITE_PDF_EXTRACT_FUNCTION_ID as string | undefined)?.trim() || '';

export interface PdfExtractionResult {
  success: boolean;
  text: string;
  length?: number;
  error?: string;
}

export async function extractPdfText(
  materialId: string,
  fileId?: string,
  bucketId?: string
): Promise<string> {
  if (!PDF_EXTRACT_FUNCTION_ID) {
    throw new Error('PDF extraction function is not configured.');
  }

  const execution = await functions.createExecution(
    PDF_EXTRACT_FUNCTION_ID,
    JSON.stringify({ materialId, fileId, bucketId })
  );

  const statusCode = execution.responseStatusCode ?? 0;
  if (execution.status === 'failed' || statusCode >= 400) {
    let message = 'PDF extraction failed.';
    try {
      const parsed = JSON.parse(execution.responseBody || '{}');
      if (parsed?.error) message = parsed.error;
    } catch {
      if (execution.responseBody) message = execution.responseBody;
    }
    throw new Error(message);
  }

  if (!execution.responseBody) {
    throw new Error('PDF extraction returned an empty response.');
  }

  const parsed = JSON.parse(execution.responseBody);
  if (!parsed?.success) {
    throw new Error(parsed?.error || 'PDF extraction failed.');
  }

  return parsed.text || '';
}
