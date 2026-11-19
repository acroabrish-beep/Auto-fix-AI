/*
 * Appwrite Function: chat-ai
 * Secure server-side proxy for the AutoFix AI chat assistant.
 *
 * Required Appwrite Function secret:
 *   OPENAI_API_KEY
 *
 * Optional:
 *   OPENAI_MODEL (defaults to gpt-4o-mini)
 *
 * Request:  POST { "message": "My car cranks but won't start" }
 * Response: { "reply": "..." }
 */

export default async ({ req, res, log, error }) => {
  if (req.method !== "POST") {
    return res.json({ error: "Method not allowed. Use POST." }, 405);
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    error("OPENAI_API_KEY is not configured for chat-ai.");
    return res.json(
      { error: "Chat AI is not configured. Add OPENAI_API_KEY to the Appwrite Function secrets." },
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

  // Never write the user's actual message or API key to execution logs.
  log(`Chat request accepted (messageLength=${message.length}).`);

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are AutoFix AI, an automotive learning, diagnosis, and repair assistant. " +
              "Give practical, clear, concise guidance. Ask clarifying questions when vehicle details are missing. " +
              "Prioritize safety: do not encourage dangerous tests or repairs, explain when a task requires proper tools, " +
              "and recommend a qualified mechanic for safety-critical work. Never present a remote diagnosis as certain.",
          },
          { role: "user", content: message },
        ],
        temperature: 0.5,
        max_tokens: 500,
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
      const providerCode = providerData?.error?.code || providerData?.error?.type || "unknown";
      error(`OpenAI request failed (status=${response.status}, code=${providerCode}).`);
      return res.json(
        { error: "The AI provider could not complete the request. Please try again." },
        502
      );
    }

    const reply = providerData?.choices?.[0]?.message?.content;
    if (typeof reply !== "string" || !reply.trim()) {
      error("OpenAI returned an empty or unexpected chat response.");
      return res.json({ error: "The AI provider returned an empty response." }, 502);
    }

    return res.json({ reply: reply.trim() });
  } catch (err) {
    const timedOut = err?.name === "TimeoutError" || err?.name === "AbortError";
    error(`Chat provider request failed (${timedOut ? "timeout" : (err?.name || "unknown error")}).`);
    return res.json(
      { error: timedOut ? "The AI provider took too long to respond. Please try again." : "An internal error occurred." },
      timedOut ? 504 : 500
    );
  }
};
