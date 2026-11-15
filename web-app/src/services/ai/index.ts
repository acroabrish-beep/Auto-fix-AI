import { account, client } from "../../lib/appwrite/client";
/** 
function toStringArray(value) {
  if (!Array.isArray(value)) return [];
/** 
 * Parse the structured diagnostic JSON returned by the diagnostic-ai function.
export function toPossibleCauses(value) { return toPossibleCauses(value); }
export function toRecommendedChecks(value) { return toRecommendedChecks(value); }
export function toStringArray(value) { return toStringArray(value); }
export function parseStructuredDiagnosis(value) { return parseStructuredDiagnosis(value); }
export function toDiagnosticResponse(value) { return toDiagnosticResponse(value); }
export * from "./types";
export * from "./provider";
 * Falls back gracefully if the response is chat-style or malformed.
 */
function parseStructuredDiagnosis(reply) {
  const cleaned = reply
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  if (!cleaned.startsWith("{")) return null;

  try {
    const data = JSON.parse(cleaned);
    if (!data || typeof data !== "object" || typeof data.summary !== "string") return null;

    const confidence =
      typeof data.confidence === "number"
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
        typeof data.disclaimer === "string" && data.disclaimer.trim()
          ? data.disclaimer.trim()
          : "Diagnostic disclaimer: This AI-generated analysis is for informational purposes only and not a substitute for professional mechanical inspection. Always consult a qualified mechanic for vehicle repairs.",
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
      "Diagnostic disclaimer: This AI-generated analysis is for informational purposes only and not a substitute for professional mechanical inspection. Always consult a qualified mechanic for vehicle repairs.",
  };
}

export const diagnosticService = {
  async analyzeSymptoms(request) {
    try {
      const execution = await functions.createExecution({
        functionId: DIAGNOSTIC_FUNCTION_ID,
        body: JSON.stringify({
          vehicleId: request.vehicleId,
          description: request.description,
          symptoms: request.symptoms,
          timing: request.timing,
          warningLights: request.warningLights,
        }),
        method: ExecutionMethod.POST,
        headers: {
          "x-appwrite-function-id": DIAGNOSTIC_FUNCTION_ID,
          "x-appwrite-project": "6a771db30008e6017e74",
        },
      });

      const statusCode = execution.responseStatusCode ?? 0;
      if (execution.status === "failed" || statusCode >= 400) {
        console.warn("[diagnostics] AI function execution failed:", {
          status: execution.status,
          statusCode,
          body: execution.responseBody,
        });
        throw new Error(friendlyErrorMessage());
      }

      const reply = execution.responseBody ? JSON.parse(execution.responseBody) : {};

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
      } else if (reply.reply) {
        const d = toDiagnosticResponse(reply.reply);
        return d;
      } else {
        return toDiagnosticResponse(execution.responseBody ? execution.responseBody : "No response from diagnostic service");
      }
    } catch (error) {
      console.error("[diagnostics] AI service error:", error);
      throw new Error(friendlyErrorMessage());
    }
  },
};
  return value.filter(
    (item) => typeof item === "string" && item.trim().length > 0
  );
}

function toPossibleCauses(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const cause = item;
      if (typeof cause.title !== "string" || !cause.title.trim()) return null;
      return {
        title: cause.title.trim(),
        description: typeof cause.description === "string" ? cause.description.trim() : "",
        probability:
          typeof cause.probability === "number"
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
      if (!item || typeof item !== "object") return null;
      const check = item;
      if (typeof check.title !== "string" || !check.title.trim()) return null;
      return {
        title: check.title.trim(),
        description:
          typeof check.description === "string" ? check.description.trim() : "",
        toolsRequired: toStringArray(check.toolsRequired),
      };
    })
    .filter((item) => item != null);
}
 * Appwrite Function: diagnostic-ai (existing, now re-enabled for vehicle diagnostics).
 * Project ID: 6a771db30008e6017e74
 * Function ID: 6a7743a8001a7c995501
 * 
 * This function handles vehicle diagnostics ONLY. It rejects any request 
 * containing an `action` field, keeping diagnostic-ai dedicated exclusively 
 * to vehicle diagnostics. Never trust caller-supplied user IDs or roles.
 */
const DIAGNOSTIC_FUNCTION_ID = "6a7743a8001a7c995501";

const friendlyErrorMessage = () => "Diagnostic service unavailable. Please try again.";
import { Functions, ExecutionMethod } from "appwrite";

const functions = new Functions(client);
