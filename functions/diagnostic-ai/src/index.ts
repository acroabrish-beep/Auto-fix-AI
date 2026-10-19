/*
  APPWRITE FUNCTION: diagnostic-ai
  This function handles secure requests to OpenAI.
  The OPENAI_API_KEY must be stored in the Appwrite Function environment variables.
*/

export default async (context: any) => {
  const { req, res, log, error } = context;

  // 1. Get Private API Key from environment
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

  if (!OPENAI_API_KEY) {
    error('Missing OPENAI_API_KEY environment variable.');
    return res.json({
      error: 'AI diagnostics is not configured yet. Please add OPENAI_API_KEY to the function environment.'
    }, 500);
  }

  // 2. Validate Request
  if (req.method !== 'POST') {
    return res.json({ error: 'Method not allowed. Use POST.' }, 405);
  }

  let payload;
  try {
    payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch (e) {
    return res.json({ error: 'Invalid JSON payload' }, 400);
  }

  const { vehicleId, description, symptoms, warningLights, timing } = payload;

  if (!description) {
    return res.json({ error: 'Problem description is required.' }, 400);
  }

  log('Analyzing symptoms for vehicle: ' + vehicleId);

  // 3. Call OpenAI
  try {
    const prompt = `
      You are a professional automotive diagnostic assistant.
      Analyze the following vehicle problem and provide a structured JSON response.

      Vehicle ID: ${vehicleId}
      Problem Description: ${description}
      Symptoms: ${symptoms?.join(', ') || 'None specified'}
      Warning Lights: ${warningLights?.join(', ') || 'None'}
      Timing: ${timing}

      Respond ONLY with a valid JSON object following this structure:
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

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // Efficient and reliable for structured data
        messages: [
          { role: 'system', content: 'You are an expert automotive mechanic providing diagnostic guidance in JSON format.' },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      error('OpenAI API Error: ' + JSON.stringify(errorData));
      return res.json({ error: 'Failed to communicate with AI provider.' }, 502);
    }

    const aiData = await response.json();
    const diagnosticResponse = JSON.parse(aiData.choices[0].message.content);

    return res.json(diagnosticResponse);

  } catch (err: any) {
    error('Internal Function Error: ' + err.message);
    return res.json({ error: 'An internal error occurred during analysis.' }, 500);
  }
};
