const endpoint = process.env.APPWRITE_ENDPOINT || 'https://fra.cloud.appwrite.io/v1';
const projectId = process.env.APPWRITE_PROJECT_ID;
const apiKey = process.env.APPWRITE_API_KEY;
const databaseId = process.env.APPWRITE_DATABASE_ID || 'autofix-ai-db';
const geminiApiKey = process.env.GEMINI_API_KEY || '';

async function appwriteRequest(path, options = {}) {
  if (!projectId || !apiKey) {
    throw new Error('Missing APPWRITE_PROJECT_ID or APPWRITE_API_KEY.');
  }

  const response = await fetch(`${endpoint}${path}`, {
    ...options,
    headers: {
      'X-Appwrite-Project': projectId,
      'X-Appwrite-Key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!response.ok) {
    throw new Error(data?.message || data?.error || text || `Appwrite request failed with ${response.status}`);
  }

  return data;
}