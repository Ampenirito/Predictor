// Vercel Serverless Function: Gemini API Proxy for Win/Loss Pattern Analysis & Multimodal Vision Scanning

async function fetchGeminiWithFallback(apiKey, bodyPayload) {
  // Model fallbacks in order of preference
  const models = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash-latest', 'gemini-1.5-flash'];
  let lastError = null;

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload)
      });

      if (response.ok) {
        return await response.json();
      }

      const errText = await response.text();
      lastError = `[${model}] Error (${response.status}): ${errText}`;
      
      // If error is not 404, throw or break
      if (response.status !== 404) {
        throw new Error(lastError);
      }
    } catch (e) {
      lastError = e.message;
    }
  }

  throw new Error(lastError || 'All Gemini model endpoints failed.');
}

module.exports = async (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    const { mode, history, imageBase64, mimeType, userApiKey } = req.body || {};

    // Determine API Key (Vercel Environment Variable or Client-Provided Key)
    const apiKey = process.env.GEMINI_API_KEY || userApiKey;
    if (!apiKey) {
      return res.status(401).json({ 
        error: 'Missing Gemini API Key. Please enter your API key in System Settings or set GEMINI_API_KEY on Vercel.' 
      });
    }

    // --- MODE 1: MULTIMODAL VISION SCANNING ---
    if (mode === 'vision') {
      if (!imageBase64) {
        return res.status(400).json({ error: 'Missing imageBase64 data for vision scan.' });
      }

      // Strip data URL prefix if present (e.g. data:image/png;base64,)
      const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
      const imageMime = mimeType || 'image/png';

      const visionPrompt = `You are an expert OCR and Computer Vision pattern extractor.
Look at this image containing a game history, scoreboard, bead plate, chart, grid, or numbered sequence of outcomes.

Task:
1. Scan the image carefully for win/loss results or colored tokens/icons/numbers representing game outcomes.
2. Typically:
   - Red circles, 'R', 'Player', 'Banker', 'P', 'B', or red numbers represent Red outcome -> "R".
   - Blue circles, 'B', 'Player', 'Banker', 'P', 'B', or blue numbers represent Blue outcome -> "B".
3. Read the sequence in exact chronological order (from oldest to newest, following the numbers or grid layout top-to-bottom/left-to-right).
4. Map EVERY single detected outcome to either "R" or "B".

Respond ONLY with valid JSON in this exact structure without markdown backticks:
{
  "detectedSequence": ["R", "B", "R", "R", "B", "R"],
  "summary": "Detected 6 consecutive outcomes (4 Red, 2 Blue) in chronological order."
}
Note: "detectedSequence" MUST be an array containing strictly string values "R" or "B".`;

      const payload = {
        contents: [
          {
            parts: [
              { text: visionPrompt },
              {
                inline_data: {
                  mime_type: imageMime,
                  data: cleanBase64
                }
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json'
        }
      };

      const data = await fetchGeminiWithFallback(apiKey, payload);
      const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!candidateText) {
        return res.status(500).json({ error: 'No response text received from Gemini Vision.' });
      }

      const cleanJson = candidateText.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanJson);

      return res.status(200).json({
        success: true,
        detectedSequence: parsed.detectedSequence || [],
        summary: parsed.summary || 'Vision scan completed successfully.'
      });
    }

    // --- MODE 2: TEXT PATTERN ADVISOR (DEFAULT) ---
    if (!history || !Array.isArray(history) || history.length === 0) {
      return res.status(400).json({ error: 'History sequence must be a non-empty array.' });
    }

    const sequenceStr = history.slice(-40).join(', ');

    const prompt = `You are a statistical pattern recognition AI. Analyze this sequence of Red ('R') and Blue ('B') game outcomes:
Sequence (chronological, latest at end): [${sequenceStr}]
Total games recorded: ${history.length}

Task:
Analyze recurring sub-sequences, streak lengths, alternation frequency, and momentum shifts.
Predict which outcome ('R' or 'B') has the highest probability of winning the NEXT game.

Respond ONLY with valid JSON in this exact structure without markdown backticks:
{
  "predictedColor": "R",
  "confidencePercent": 75,
  "reasoning": "A short, 2-sentence explanation of why this outcome is statistically favoured."
}
Note: "predictedColor" MUST be either "R" or "B". "confidencePercent" MUST be an integer between 50 and 99.`;

    const payload = {
      contents: [
        {
          parts: [{ text: prompt }]
        }
      ],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: 'application/json'
      }
    };

    const data = await fetchGeminiWithFallback(apiKey, payload);
    const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!candidateText) {
      return res.status(500).json({ error: 'Empty response from Gemini API.' });
    }

    const cleanJson = candidateText.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanJson);

    return res.status(200).json({
      success: true,
      prediction: parsed
    });

  } catch (error) {
    console.error('Gemini Handler Error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};
