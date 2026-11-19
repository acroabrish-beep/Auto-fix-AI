/*
 * Appwrite Function: chat-ai
 * Secure Gemini proxy for the AutoFix AI chat assistant.
 *
 * Required Appwrite Function secret:
 *   GEMINI_API_KEY
 *
 * Optional:
 *   GEMINI_MODEL (defaults to gemini-2.5-flash)
 *
 * Request:  POST { "message": "My car cranks but won't start" }
 * Response: { "reply": "..." }
 */

const SYSTEM_INSTRUCTION =
  "You are AutoFix AI, an automotive learning, diagnosis, and repair assistant. " +
  "Give practical, clear, concise guidance. Ask clarifying questions when vehicle details are missing. " +
  "Prioritize safety: do not encourage dangerous tests or repairs, explain when a task requires proper tools, " +
  "and recommend a qualified mechanic for safety-critical work. Never present a remote diagnosis as certain.";

export default async ({ req, res, log, error }) => {
  if (req.method !== "POST") {
    return res.json({ error: "Method not allowed. Use POST." }, 405);
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    error("GEMINI_API_KEY is not configured for chat-ai.");
    return res.json(
      { error: "Chat AI is not configured. Add GEMINI_API_KEY to the Appwrite Function secrets." },
      503
    );
  }

  let payload;
  try {
    payload = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  } catch {
    return res.json({ error: "Invalid JSON payload." }, 400);
  }

  const message = typeof payload?.message === "string" ? payload.message.trim() : "";
  if (!message) {
    return res.json({ error: 'A non-empty "message" string is required.' }, 400);
  }
  if (message.length > 6000) {
    return res.json({ error: "Message is too long. Maximum length is 6000 characters." }, 413);
  }

  log(`Chat request accepted (messageLength=${message.length}).`);

  try {
    const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
    const endpoint =
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: SYSTEM_INSTRUCTION }],
        },
        contents: [
          {
            role: "user",
            parts: [{ text: message }],
          },
        ],
        generationConfig: {
          temperature: 0.5,
          maxOutputTokens: 500,
        },
      }),
      signal: AbortSignal.timeout(25000),
    });

    const responseText = await response.text();
    let providerData = null;
    try {
      providerData = responseText ? JSON.parse(responseText) : null;
    } catch {
      providerData = null;
    }

    if (!response.ok) {
      const providerCode =
        providerData?.error?.status || providerData?.error?.code || "unknown";
      error(`Gemini request failed (status=${response.status}, code=${providerCode}).`);
      return res.json(
        { error: "The AI provider could not complete the request. Please try again." },
        502
      );
    }

    const reply = (providerData?.candidates?.[0]?.content?.parts || [])
      .map((part) => (typeof part.text === "string" ? part.text : ""))
      .filter(Boolean)
      .join("\n")
      .trim();

    if (!reply) {
      error("Gemini returned an empty or unexpected chat response.");
      return res.json({ error: "The AI provider returned an empty response." }, 502);
    }

    return res.json({ reply });
  } catch (err) {
    const timedOut = err?.name === "TimeoutError" || err?.name === "AbortError";
    error(
      `Gemini request failed (${timedOut ? "timeout" : err?.name || "unknown error"}).`
    );
    return res.json(
      {
        error: timedOut
          ? "The AI provider took too long to respond. Please try again."
          : "An internal error occurred.",
      },
      timedOut ? 504 : 500
    );
  }
};
