const friendlyErrorMessage = () => 'Diagnostic service unavailable. Please try again.';

function toStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item) => typeof item === 'string' && item.trim().length > 0
  );
}

function toPossibleCauses(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const cause = item;
      if (typeof cause.title !== 'string' || !cause.title.trim()) return null;
      return {
        title: cause.title.trim(),
        description: typeof cause.description === 'string' ? cause.description.trim() : '',
        probability:
          typeof cause.probability === 'number'
            ? Math.min(1, Math.max(0, cause.probability))
            : 0.5,
      };
    })
    .filter((item) => item != null);
}

function toRecommendedChecks(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const check = item;
      if (typeof check.title !== 'string' || !check.title.trim()) return null;
      return {
        title: check.title.trim(),
        description:
          typeof check.description === 'string' ? check.description.trim() : '',
        toolsRequired: toStringArray(check.toolsRequired),
      };
    })
    .filter((item) => item != null);
}

/** 
 * Parse the structured diagnostic JSON returned by the Gemini API.
 * Falls back gracefully if the response is chat-style or malformed.
 */
function parseStructuredDiagnosis(reply) {
  const cleaned = reply
    .trim()
    .replace(/^```(?:json)?\\s*/i, '')
    .replace(/\\s*\\*\\*\\*$/i, '')
    .trim();

  if (!cleaned.startsWith('{')) return null;

  try {
    const data = JSON.parse(cleaned);
    if (!data || typeof data !== 'object' || typeof data.summary !== 'string') return null;

    const confidence =
      typeof data.confidence === 'number'
        ? Math.min(1, Math.max(0, data.confidence))
        : 0.5;

    return {
      summary: data.summary.trim(),
      possibleCauses: toPossibleCauses(data.possibleCauses),
      recommendedChecks: toRecommendedChecks(data.recommendedChecks),
      nextSteps: toStringArray(data.nextSteps),
      safetyNotes: toStringArray(data.safetyNotes),
      confidence,
      disclaimer:
        typeof data.disclaimer === 'string' && data.disclaimer.trim()
          ? data.disclaimer.trim()
          : 'Diagnostic disclaimer: This AI-generated analysis is for informational purposes only and not a substitute for professional mechanical inspection. Always consult a qualified mechanic for vehicle repairs.',
    };
  } catch {
    return null;
  }
}

function toDiagnosticResponse(reply) {
  const structured = parseStructuredDiagnosis(reply);
  if (structured) return structured;

  return {
    summary: reply,
    possibleCauses: [],
    recommendedChecks: [],
    nextSteps: [],
    safetyNotes: [],
    confidence: 0.5,
    disclaimer:
      'Diagnostic disclaimer: This AI-generated analysis is for informational purposes only and not a substitute for professional mechanical inspection. Always consult a qualified mechanic for vehicle repairs.',
  };
}
const friendlyErrorMessage = () => 'Diagnostic service unavailable. Please try again.';
const friendlyErrorMessage = () => 'Diagnostic service unavailable. Please try again.';
"
"
const friendlyErrorMessage = () => 'Diagnostic service unavailable. Please try again.';
"
/** 
 * Appwrite Function: diagnostic-ai (existing, now re-enabled for vehicle diagnostics).
 * Project ID: 6a771db30008e6017e74
 * Function ID: 6a7743a8001a7c995501
 * 
 * This function handles vehicle diagnostics ONLY. It rejects any request 
 * containing an `action` field, keeping diagnostic-ai dedicated exclusively 
 * to vehicle diagnostics. Never trust caller-supplied user IDs or roles.
 */
const DIAGNOSTIC_FUNCTION_ID = '6a7743a8001a7c995501';

const friendlyErrorMessage = () => 'Diagnostic service unavailable. Please try again.';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';

function toStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item) => typeof item === 'string' && item.trim().length > 0
  );
}

function toPossibleCauses(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const cause = item;
      if (typeof cause.title !== 'string' || !cause.title.trim()) return null;
      return {
        title: cause.title.trim(),
        description: typeof cause.description === 'string' ? cause.description.trim() : '',
        probability:
          typeof cause.probability === 'number'
            ? Math.min(1, Math.max(0, cause.probability))
            : 0.5,
      };
    })
    .filter((item) => item != null);
}

function toRecommendedChecks(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const check = item;
      if (typeof check.title !== 'string' || !check.title.trim()) return null;
      return {
        title: check.title.trim(),
        description:
          typeof check.description === 'string' ? check.description.trim() : '',
        toolsRequired: toStringArray(check.toolsRequired),
      };
    })
    .filter((item) => item != null);
}

/** 
 * Parse the structured diagnostic JSON returned by the Gemini API.
 * Falls back gracefully if the response is chat-style or malformed.
 */
function parseStructuredDiagnosis(reply) {
  const cleaned = reply
    .trim()
    .replace(/^```(?:json)?\\s*/i, '')
    .replace(/\\s*\\*\\*\\*$/i, '')
    .trim();

  if (!cleaned.startsWith('{')) return null;

  try {
    const data = JSON.parse(cleaned);
    if (!data || typeof data !== 'object' || typeof data.summary !== 'string') return null;

    const confidence =
      typeof data.confidence === 'number'
        ? Math.min(1, Math.max(0, data.confidence))
        : 0.5;

    return {
      summary: data.summary.trim(),
      possibleCauses: toPossibleCauses(data.possibleCauses),
      recommendedChecks: toRecommendedChecks(data.recommendedChecks),
      nextSteps: toStringArray(data.nextSteps),
      safetyNotes: toStringArray(data.safetyNotes),
      confidence,
      disclaimer:
        typeof data.disclaimer === 'string' && data.disclaimer.trim()
          ? data.disclaimer.trim()
          : 'Diagnostic disclaimer: This AI-generated analysis is for informational purposes only and not a substitute for professional mechanical inspection. Always consult a qualified mechanic for vehicle repairs.',
    };
  } catch {
    return null;
  }
}

function toDiagnosticResponse(reply) {
  const structured = parseStructuredDiagnosis(reply);
  if (structured) return structured;

  return {
    summary: reply,
    possibleCauses: [],
    recommendedChecks: [],
    nextSteps: [],
    safetyNotes: [],
    confidence: 0.5,
    disclaimer:
      'Diagnostic disclaimer: This AI-generated analysis is for informational purposes only and not a substitute for professional mechanical inspection. Always consult a qualified mechanic for vehicle repairs.',
  };
}
import { account, client } from '../../lib/appwrite/client';
import { Functions, ExecutionMethod } from 'appwrite';

const functions = new Functions(client');

/** 
 * Appwrite Function: diagnostic-ai (existing, now re-enabled for vehicle diagnostics).
 * Project ID: 6a771db30008e6017e74
 * Function ID: 6a7743a8001a7c995501
 * 
 * This function handles vehicle diagnostics ONLY. It rejects any request 
 * containing an `action` field, keeping diagnostic-ai dedicated exclusively 
 * to vehicle diagnostics. Never trust caller-supplied user IDs or roles.
 */
const DIAGNOSTIC_FUNCTION_ID = '6a7743a8001a7c995501';

const friendlyErrorMessage = () => 'Diagnostic service unavailable. Please try again.';

function toStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item) => typeof item === 'string' && item.trim().length > 0
  );
}

function toPossibleCauses(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const cause = item;
      if (typeof cause.title !== 'string' || !cause.title.trim()) return null;
      return {
        title: cause.title.trim(),
        description: typeof cause.description === 'string' ? cause.description.trim() : '',
        probability:
          typeof cause.probability === 'number'
            ? Math.min(1, Math.max(0, cause.probability))
            : 0.5,
      };
    })
    .filter((item) => item != null);
}

function toRecommendedChecks(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const check = item;
      if (typeof check.title !== 'string' || !check.title.trim()) return null;
      return {
        title: check.title.trim(),
        description:
          typeof check.description === 'string' ? check.description.trim() : '',
        toolsRequired: toStringArray(check.toolsRequired),
      };
    })
    .filter((item) => item != null);
}

/** 
 * Parse the structured diagnostic JSON returned by the Gemini API.
 * Falls back gracefully if the response is chat-style or malformed.
 */
function parseStructuredDiagnosis(reply) {
  const cleaned = reply
    .trim()
    .replace(/^```(?:json)?\\s*/i, '')
    .replace(/\\s*\\*\\*\\*$/i, '')
    .trim();

  if (!cleaned.startsWith('{')) return null;

  try {
    const data = JSON.parse(cleaned);
    if (!data || typeof data !== 'object' || typeof data.summary !== 'string') return null;

    const confidence =
      typeof data.confidence === 'number'
        ? Math.min(1, Math.max(0, data.confidence))
        : 0.5;

    return {
      summary: data.summary.trim(),
      possibleCauses: toPossibleCauses(data.possibleCauses),
      recommendedChecks: toRecommendedChecks(data.recommendedChecks),
      nextSteps: toStringArray(data.nextSteps),
      safetyNotes: toStringArray(data.safetyNotes),
      confidence,
      disclaimer:
        typeof data.disclaimer === 'string' && data.disclaimer.trim()
          ? data.disclaimer.trim()
          : 'Diagnostic disclaimer: This AI-generated analysis is for informational purposes only and not a substitute for professional mechanical inspection. Always consult a qualified mechanic for vehicle repairs.',
    };
  } catch {
    return null;
  }
}

function toDiagnosticResponse(reply) {
  const structured = parseStructuredDiagnosis(reply);
  if (structured) return structured;

  return {
    summary: reply,
    possibleCauses: [],
    recommendedChecks: [],
    nextSteps: [],
    safetyNotes: [],
    confidence: 0.5,
    disclaimer:
      'Diagnostic disclaimer: This AI-generated analysis is for informational purposes only and not a substitute for professional mechanical inspection. Always consult a qualified mechanic for vehicle repairs.',
  );
}
import { account, client } from '../../lib/appwrite/client';
const friendlyErrorMessage = () => 'Diagnostic service unavailable. Please try again.';
/** 
export const diagnosticService = {
  async analyzeSymptoms(request) {
    try {
      const geminiApiKey = process.env.GEMINI_API_KEY;
      if (!geminiApiKey) {
        throw new Error('Gemini API key not configured. Please add GEMINI_API_KEY to the function environment.');
      }

      const modelId = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

      const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent', {
        method: 'POST',
        headers: {
          'x-goog-api-key': geminiApiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                { role: 'user', content: prompt }
              ],
            ],
            ,
            ,
          }),
        };

        const statusCode = response.statusCode ?? 0;
        if (response.status >= 400) {
          throw new Error('Gemini API call failed.');
        }

        const result = await response.json();
        const directResponse = parseStructuredDiagnosis(result.text);
        if (structuredResponse) {
          return structuredResponse;
        }

        // Fallback to chat-style response
        const parsed = JSON.parse(result.text);
        if (reply.summary) {
          return {
            summary: reply.summary,
            possibleCauses: reply.possibleCauses || [],
            recommendedChecks: reply.recommendedChecks || [],
            nextSteps: reply.nextSteps || [],
            safetyNotes: reply.safetyNotes || [],
            confidence: reply.confidence !== undefined ? reply.confidence : 0.5,
            disclaimer: reply.disclaimer || friendlyErrorMessage(),
          };
        } else {
          return toDiagnosticResponse(result.text);
        }
      } catch (error) {
        console.error('[diagnostics] AI service error:', error);
        throw new Error('Diagnostic service unavailable. Please try again.');
      }
    } catch (error) {
      console.error('[diagnostics] AI service error:', error);
      throw new Error('Diagnostic service unavailable. Please try again.');
    }
  },
};
 * Parse the structured diagnostic JSON returned by the Gemini API.
 * Falls back gracefully if the response is chat-style or malformed.
 */
function parseStructuredDiagnosis(reply) {
  const cleaned = reply
    .trim()
    .replace(/^```(?:json)?\\s*/i, '')
    .replace(/\\s*\\*\\*\\*$/i, '')
    .trim();

  if (!cleaned.startsWith('{')) return null;

  try {
    const data = JSON.parse(cleaned);
    if (!data || typeof data !== 'object' || typeof data.summary !== 'string') return null;

    const confidence =
      typeof data.confidence === 'number'
        ? Math.min(1, Math.max(0, data.confidence))
        : 0.5;

    return {
      summary: data.summary.trim(),
      possibleCauses: toPossibleCauses(data.possibleCauses),
      recommendedChecks: toRecommendedChecks(data.recommendedChecks),
      nextSteps: toStringArray(data.nextSteps),
      safetyNotes: toStringArray(data.safetyNotes),
      confidence,
      disclaimer:
        typeof data.disclaimer === 'string' && data.disclaimer.trim()
          ? data.disclaimer.trim()
          : 'Diagnostic disclaimer: This AI-generated analysis is for informational purposes only and not a substitute for professional mechanical inspection. Always consult a qualified mechanic for vehicle repairs.',
    };
  } catch {
    return null;
  }
}

function toDiagnosticResponse(reply) {
  const structured = parseStructuredDiagnosis(reply);
  if (structured) return structured;

  return {
    summary: reply,
    possibleCauses: [],
    recommendedChecks: [],
    nextSteps: [],
    safetyNotes: [],
    confidence: 0.5,
    disclaimer:
      'Diagnostic disclaimer: This AI-generated analysis is for informational purposes only and not a substitute for professional mechanical inspection. Always consult a qualified mechanic for vehicle repairs.',
  };
}

function toStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item) => typeof item === 'string' && item.trim().length > 0
  );
}

function toPossibleCauses(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const cause = item;
      if (typeof cause.title !== 'string' || !cause.title.trim()) return null;
      return {
        title: cause.title.trim(),
        description: typeof cause.description === 'string' ? cause.description.trim() : '',
        probability:
          typeof cause.probability === 'number'
            ? Math.min(1, Math.max(0, cause.probability))
            : 0.5,
      };
    })
    .filter((item) => item != null);
}

function toRecommendedChecks(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const check = item;
      if (typeof check.title !== 'string' || !check.title.trim()) return null;
      return {
        title: check.title.trim(),
        description:
          typeof check.description === 'string' ? check.description.trim() : '',
        toolsRequired: toStringArray(check.toolsRequired),
      };
    })
    .filter((item) => item != null);
}
import { Functions, ExecutionMethod } from 'appwrite';

const functions = new Functions(client);

/** 
 * Appwrite Function: diagnostic-ai (existing, now re-enabled for vehicle diagnostics).
 * Project ID: 6a771db30008e6017e74
 * Function ID: 6a7743a8001a7c995501
 * 
 * This function handles vehicle diagnostics ONLY. It rejects any request 
 * containing an `action` field, keeping diagnostic-ai dedicated exclusively 
 * to vehicle diagnostics. Never trust caller-supplied user IDs or roles.
 */
const DIAGNOSTIC_FUNCTION_ID = '6a7743a8001a7c995501';

const friendlyErrorMessage = () => 'Diagnostic service unavailable. Please try again.';

function toStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item) => typeof item === 'string' && item.trim().length > 0
  );
}

function toPossibleCauses(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const cause = item;
      if (typeof cause.title !== 'string' || !cause.title.trim()) return null;
      return {
        title: cause.title.trim(),
        description: typeof cause.description === 'string' ? cause.description.trim() : '',
        probability:
          typeof cause.probability === 'number'
            ? Math.min(1, Math.max(0, cause.probability))
            : 0.5,
      };
    })
    .filter((item) => item != null);
}

function toRecommendedChecks(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const check = item;
      if (typeof check.title !== 'string' || !check.title.trim()) return null;
      return {
        title: check.title.trim(),
        description:
          typeof check.description === 'string' ? check.description.trim() : '',
        toolsRequired: toStringArray(check.toolsRequired),
      };
    })
    .filter((item) => item != null);
}

/** 
 * Parse the structured diagnostic JSON returned by the Gemini API.
 * Falls back gracefully if the response is chat-style or malformed.
 */
function parseStructuredDiagnosis(reply) {
  const cleaned = reply
    .trim()
    .replace(/^```(?:json)?\\s*/i, '')
    .replace(/\\s*```$/i, '')
    .trim();

  if (!cleaned.startsWith('{')) return null;

  try {
    const data = JSON.parse(cleaned);
    if (!data || typeof data !== 'object' || typeof data.summary !== 'string') return null;

    const confidence =
      typeof data.confidence === 'number'
        ? Math.min(1, Math.max(0, data.confidence))
        : 0.5;

    return {
      summary: data.summary.trim(),
      possibleCauses: toPossibleCauses(data.possibleCauses),
      recommendedChecks: toRecommendedChecks(data.recommendedChecks),
      nextSteps: toStringArray(data.nextSteps),
      safetyNotes: toStringArray(data.safetyNotes),
      confidence,
      disclaimer:
        typeof data.disclaimer === 'string' && data.disclaimer.trim()
          ? data.disclaimer.trim()
          : 'Diagnostic disclaimer: This AI-generated analysis is for informational purposes only and not a substitute for professional mechanical inspection. Always consult a qualified mechanic for vehicle repairs.',
    };
  } catch {
    return null;
  }
}

function toDiagnosticResponse(reply) {
  const structured = parseStructuredDiagnosis(reply);
  if (structured) return structured;

  return {
    summary: reply,
    possibleCauses: [],
    recommendedChecks: [],
    nextSteps: [],
    safetyNotes: [],
    confidence: 0.5,
    disclaimer:
      'Diagnostic disclaimer: This AI-generated analysis is for informational purposes only and not a substitute for professional mechanical inspection. Always consult a qualified mechanic for vehicle repairs.',
  );
}
/*
  APPWRITE FUNCTION: diagnostic-ai

  This function handles vehicle diagnostics using an AI provider.
  It does NOT handle admin actions, role management, or privileged operations.
  It rejects any request that contains an `action` field, keeping diagnostic-ai
*/
*/
// Removed appwriteRequest helper - unused in diagnostic flow.
// Diagnostic-ai now uses Google Gemini API directly.

/**/
*/
/*
*/
/**/
  dedicated exclusively to vehicle diagnostics.
*/

const endpoint = process.env.APPWRITE_ENDPOINT || 'https://fra.cloud.appwrite.io/v1';
const projectId = process.env.APPWRITE_PROJECT_ID;
const apiKey = process.env.AUTOFIX_APPWRITE_API_KEY;
const databaseId = process.env.APPWRITE_DATABASE_ID || 'autofix-ai-db';
const geminiApiKey = process.env.GEMINI_API_KEY;

async function appwriteRequest(path, options = {}) {
  if (!projectId || !apiKey) {
    throw new Error('Missing APPWRITE_PROJECT_ID or AUTOFIX_APPWRITE_API_KEY.');
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

function queryEqual(field, value) {
  return encodeURIComponent(JSON.stringify({
    method: 'equal',
    attribute: field,
    values: [String(value)],
  }));
}


async function runDiagnostic(payload) {
  if (!geminiApiKey) {
    throw new Error('AI diagnostics is not configured yet. Please add GEMINI_API_KEY to the function environment.');
  }

  const vehicleId = payload?.vehicleId;
  const description = payload?.description || payload?.message;
  const symptoms = payload?.symptoms;
  const warningLights = payload?.warningLights;
  const timing = payload?.timing;

  if (!description) {
    throw new Error('Problem description is required.');
  }

  const prompt = `
    You are a professional automotive diagnostic assistant providing guidance in JSON format.
    Analyze the following vehicle problem and provide a structured JSON response.

    Vehicle ID: ${vehicleId}
    Problem Description: ${description}
    Symptoms: ${symptoms?.join?.(', ') || symptoms || 'None specified'}
    Warning Lights: ${warningLights?.join?.(', ') || warningLights || 'None'}
    Timing: ${timing}

    Respond with valid JSON having these fields: summary, possibleCauses, recommendedChecks, nextSteps, safetyNotes, confidence, disclaimer.
    {
      "summary": "Short overview of the issue",
      "possibleCauses": [
        { "title": "Cause Name", "description": "Short explanation", "probability": 0.0-1.0 }
      ],
      "recommendedChecks": [
        { "title": "Check Name", "description": "What to do", "toolsRequired": ["Tool 1", "Tool 2"] }
      ],
      "nextSteps": ["Step 1", "Step 2"],
      "safetyNotes": ["Safety Warning 1"],
      "confidence": 0.0-1.0,
      "disclaimer": "Safety disclaimer text"
    }
  `;

  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/v1generateContent', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${geminiApiKey}`,
    },
    body: JSON.stringify({
      model: 'gemini-1.5-flash',
      messages: [
        { role: 'system', content: 'You are an expert automotive mechanic providing diagnostic guidance in JSON format.' },
        { role: 'user', content: prompt },
      ],
      ,
      ,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData?.error?.message || 'Failed to communicate with AI provider.');
  }

  const aiData = await response.json();
  return JSON.parse(aiData.choices[0].message.content);
}

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

  // Diagnostic-ai is EXCLUSIVELY for vehicle diagnostics.
  // Any request containing an `action` field is rejected immediately.
  if (payload?.action) {
    return res.json({ error: 'Method not allowed. Diagnostic-ai handles vehicle diagnostics only.' }, 405);
  }

  // Diagnostic flow.
  try {
    if (!geminiApiKey) {
      return res.json(
        { error: 'AI diagnostics is not configured yet. Please add GEMINI_API_KEY to the function environment.' },
        500
      );
    }

    const result = await runDiagnostic(payload);
    return res.json(result);
  } catch (err) {
    error(err?.message || 'Diagnostic failed.');
    return res.json({ error: err?.message || 'An internal error occurred during analysis.' }, 500);
  }
};
export const diagnosticService = {
  async analyzeSymptoms(request) {
    try {
      const geminiApiKey = process.env.GEMINI_API_KEY || '';
      const geminiModel = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

      if (!geminiApiKey) {
        return {
          summary: 'AI diagnostics not configured.',
          possibleCauses: [],
          recommendedChecks: [],
          nextSteps: ['Please configure GEMINI_API_KEY in the function environment.'],
          safetyNotes: [],
          confidence: 0.0,
          disclaimer:
            'Diagnostic disclaimer: This AI-generated analysis is for informational purposes only and not a substitute for professional mechanical inspection. Always consult a qualified mechanic for vehicle repairs.',
        };
      }

      const prompt = String(
        `You are a professional automotive diagnostic assistant. Analyze the following vehicle problem and provide a structured JSON response with these exact fields: summary, possibleCauses (array with title, description, probability), recommendedChecks (array with title, description, toolsRequired), nextSteps (array of steps), safetyNotes (array), confidence (number 0-1), disclaimer (string).

Vehicle ID: ${request.vehicleId}
Problem Description: ${request.description}
Symptoms: ${Array.isArray(request.symptoms) ? request.symptoms.join(', ') : request.symptoms || 'None specified'}
Warning Lights: ${Array.isArray(request.warningLights) ? request.warningLights.join(', ') : request.warningLights || 'None'}
Timing: ${request.timing}

Respond ONLY with valid JSON having these fields: summary, possibleCauses, recommendedChecks, nextSteps, safetyNotes, confidence, disclaimer. No explanatory text.`
;

      const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + geminiModel + ':generateContent';

      const result = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': geminiApiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: prompt }],
            },
          ],
        }),
      });

      if (!result.ok) {
        const errorText = await result.text();
        throw new Error('AI service unavailable. Please try again.');
      }

      const resultData = await result.json();

      if (!resultData.candidates || !resultData.candidates[0] || !resultData.candidates[0].content) {
        return {
          summary: 'No diagnostic analysis available.',
          possibleCauses: [],
          recommendedChecks: [],
          nextSteps: [],
          safetyNotes: [],
          confidence: 0.0,
          disclaimer:
            'Diagnostic disclaimer: This AI-generated analysis is for informational purposes only and not a substitute for professional mechanical inspection. Always consult a qualified mechanic for vehicle repairs.',
        };
      }

      const text = resultData.candidates[0].content.parts[0].text || '';

      return toDiagnosticResponse(text);
    } catch (err) {
      console.error('[diagnostics] AI service error:', err);
      return {
        summary: 'Diagnostic failed.',
        possibleCauses: [],
        recommendedChecks: [],
        nextSteps: ['Please try again later.'],
        safetyNotes: [],
        confidence: 0.0,
        disclaimer:
          'Diagnostic disclaimer: This AI-generated analysis is for informational purposes only and not a substitute for professional mechanical inspection. Always consult a qualified mechanic for vehicle repairs.',
      };
    }
  },
};

export function toPossibleCauses(value) { return toPossibleCauses(value); }
export function toRecommendedChecks(value) { return toRecommendedChecks(value); }
export function toStringArray(value) { return toStringArray(value); }
export function parseStructuredDiagnosis(value) { return parseStructuredDiagnosis(value); }
export function toDiagnosticResponse(value) { return toDiagnosticResponse(value); }
export * from './types';
export * from './provider';
"