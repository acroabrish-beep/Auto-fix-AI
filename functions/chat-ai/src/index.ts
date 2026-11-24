/*
  APPWRITE FUNCTION: chat-ai
  Secure proxy between the AutoFix AI chat UI and OpenAI.

  The OPENAI_API_KEY must be stored in the Appwrite Function environment
  variables (Appwrite Console → Functions → chat-ai → Settings → Environment
  variables). It must never be exposed to the browser.

  Input  (POST JSON): { "message": "My car cranks but won't start" }
  Output (JSON):      { "reply": "..." }
*/

export default async (context: any) => {
  const { req, res, log, error } = context;

  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

  if (!OPENAI_API_KEY) {
    error('Missing OPENAI_API_KEY environment variable.');
    return res.json(
      { error: 'Chat AI is not configured yet. Add OPENAI_API_KEY to the function environment.' },
      500
    );
  }

  if (req.method !== 'POST') {
    return res.json({ error: 'Method not allowed. Use POST.' }, 405);
  }

  let payload: any;
  try {
    payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.json({ error: 'Invalid JSON payload' }, 400);
  }

  const message: string | undefined = payload?.message;
  if (!message || typeof message !== 'string') {
    return res.json({ error: 'A "message" string is required.' }, 400);
  }

  log('Chat message received: ' + message.slice(0, 80));

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content:
              'You are AutoFix AI, an automotive learning, diagnosis and repair assistant. ' +
              'Give practical, safety-conscious guidance in clear, concise language. ' +
              'Always remind the user to consult a qualified mechanic for safety-critical work.',
          },
          { role: 'user', content: message },
        ],
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      error('OpenAI API Error: ' + JSON.stringify(errorData));
      return res.json({ error: 'Failed to communicate with AI provider.' }, 502);
    }

    const aiData = await response.json();
    const reply = aiData?.choices?.[0]?.message?.content?.trim();

    if (!reply) {
      return res.json({ error: 'AI provider returned an empty response.' }, 502);
    }

    return res.json({ reply });
  } catch (err: any) {
    error('Internal Function Error: ' + err.message);
    return res.json({ error: 'An internal error occurred.' }, 500);
  }
};
