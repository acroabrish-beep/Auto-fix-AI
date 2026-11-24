import { client } from "../../lib/appwrite/client";
import { Functions, ExecutionMethod } from "appwrite";
import { DiagnosticRequest, DiagnosticResponse } from "../../types";

const functions = new Functions(client);

const DIAGNOSTIC_FUNCTION_ID =
  (import.meta.env.VITE_APPWRITE_DIAGNOSTIC_FUNCTION_ID as string | undefined)?.trim() ||
  "6a7743a8001a7c995501";

const friendlyErrorMessage = () =>
  "Diagnostic service unavailable. Please try again.";

export function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function toPossibleCauses(value: unknown): { title: string; description: string; probability: number }[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const cause = item as Record<string, unknown>;
      if (typeof cause.title !== "string" || !cause.title.trim()) return null;
      return {
        title: cause.title.trim(),
        description: typeof cause.description === "string" ? cause.description.trim() : "",
        probability: typeof cause.probability === "number" ? Math.min(1, Math.max(0, cause.probability)) : 0.5,
      };
    })
    .filter((item): item is { title: string; description: string; probability: number } => item != null);
}

function toRecommendedChecks(value: unknown): { title: string; description: string; toolsRequired: string[] }[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const check = item as Record<string, unknown>;
      if (typeof check.title !== "string" || !check.title.trim()) return null;
      return {
        title: check.title.trim(),
        description: typeof check.description === "string" ? check.description.trim() : "",
        toolsRequired: toStringArray(check.toolsRequired),
      };
    })
    .filter((item): item is { title: string; description: string; toolsRequired: string[] } => item != null);
}

function parseStructuredDiagnosis(reply: string): DiagnosticResponse | null {
  const cleaned = reply.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  if (!cleaned.startsWith("{")) return null;
  try {
    const data = JSON.parse(cleaned);
    if (!data || typeof data !== "object" || typeof data.summary !== "string") return null;
    const confidence = typeof data.confidence === "number" ? Math.min(1, Math.max(0, data.confidence)) : 0.5;
    return {
      summary: data.summary.trim(),
      possibleCauses: toPossibleCauses(data.possibleCauses),
      recommendedChecks: toRecommendedChecks(data.recommendedChecks),
      nextSteps: toStringArray(data.nextSteps),
      safetyNotes: toStringArray(data.safetyNotes),
      confidence,
      disclaimer: typeof data.disclaimer === "string" && data.disclaimer.trim() ? data.disclaimer.trim() : "Diagnostic disclaimer: AI-generated analysis is for informational purposes only.",
    };
  } catch {
    return null;
  }
}

function toDiagnosticResponse(reply: string): DiagnosticResponse {
  const structured = parseStructuredDiagnosis(reply);
  if (structured) return structured;
  return {
    summary: reply,
    possibleCauses: [],
    recommendedChecks: [],
    nextSteps: [],
    safetyNotes: [],
    confidence: 0.5,
    disclaimer: "Diagnostic disclaimer: AI-generated analysis is for informational purposes only.",
  };
}

const MAX_DIAGNOSTIC_PAYLOAD_SIZE = 10 * 1024; // 10KB

function validateDiagnosticRequest(request: DiagnosticRequest): { valid: boolean; error?: string } {
  // payload size limit
  const payloadString = JSON.stringify(request);
  if (payloadString.length > MAX_DIAGNOSTIC_PAYLOAD_SIZE) {
    return { valid: false, error: 'Request payload exceeds maximum size (10KB).' };
  }

  // field-level validation
  if (!request.vehicleId || typeof request.vehicleId !== 'string' || request.vehicleId.trim().length === 0) {
    return { valid: false, error: 'vehicleId is required and must be a non-empty string.' };
  }
  if (!request.description || typeof request.description !== 'string' || request.description.trim().length === 0) {
    return { valid: false, error: 'description is required and must be a non-empty string.' };
  }
  if (!Array.isArray(request.symptoms) || request.symptoms.length > 10) {
    return { valid: false, error: 'symptoms must be an array with at most 10 items.' };
  }
  for (const s of request.symptoms) {
    if (typeof s !== 'string' || s.trim().length === 0) {
      return { valid: false, error: 'Each symptom must be a non-empty string.' };
    }
  }
  if (!request.timing || typeof request.timing !== 'string' || request.timing.trim().length === 0) {
    return { valid: false, error: 'timing is required and must be a non-empty string.' };
  }
  if (!Array.isArray(request.warningLights)) {
    return { valid: false, error: 'warningLights must be an array.' };
  }
  for (const wl of request.warningLights) {
    if (typeof wl !== 'string' || wl.trim().length === 0) {
      return { valid: false, error: 'Each warning light must be a non-empty string.' };
    }
  }
  return { valid: true };
}

export const diagnosticService = {
  async analyzeSymptoms(request: DiagnosticRequest): Promise<DiagnosticResponse> {
    // Input validation
    const validation = validateDiagnosticRequest(request);
    if (!validation.valid) {
      throw new Error(validation.error);
    }
    try {
      const execution = await functions.createExecution(DIAGNOSTIC_FUNCTION_ID, JSON.stringify({
        vehicleId: request.vehicleId,
        description: request.description,
        symptoms: request.symptoms,
        timing: request.timing,
        warningLights: request.warningLights,
      }))
      const reply = execution.responseBody ? execution.responseBody : "";
      try {
        const parsed = JSON.parse(reply);
        if (parsed && typeof parsed === "object" && typeof parsed.summary === "string") {
          return {
            summary: parsed.summary,
            possibleCauses: toPossibleCauses(parsed.possibleCauses),
            recommendedChecks: toRecommendedChecks(parsed.recommendedChecks),
            nextSteps: toStringArray(parsed.nextSteps),
            safetyNotes: toStringArray(parsed.safetyNotes),
            confidence: typeof parsed.confidence === "number" ? Math.min(1, Math.max(0, parsed.confidence)) : 0.5,
            disclaimer: typeof parsed.disclaimer === "string" && parsed.disclaimer.trim() ? parsed.disclaimer.trim() : friendlyErrorMessage(),
          };
        }
        if (parsed && typeof parsed === "object" && typeof parsed.reply === "string") {
          return toDiagnosticResponse(parsed.reply);
        }
      } catch { /* Not JSON — treat as chat-style reply. */ }
      return toDiagnosticResponse(reply);
    } catch (error) {
      console.error("[diagnostics] AI service error:", error);
      throw new Error(friendlyErrorMessage());
    }
  },
};
