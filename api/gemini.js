// Vercel Serverless Function: Gemini API Proxy for Win/Loss Pattern Analysis

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
    const { history, userApiKey } = req.body || {};

    if (!history || !Array.isArray(history) || history.length === 0) {
      return res.status(400).json({ error: 'History sequence must be a non-empty array.' });
    }

    // Determine API Key (Vercel Environment Variable or Client-Provided Key)
    const apiKey = process.env.GEMINI_API_KEY || userApiKey;
    if (!apiKey) {
      return res.status(401).json({ 
        error: 'Missing Gemini API Key. Provide an API key in settings or set GEMINI_API_KEY in Vercel environment variables.' 
      });
    }

    const sequenceStr = history.slice(-40).join(', '); // Send up to last 40 games for detailed analysis

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

    // Call Gemini API using gemini-2.5-flash or gemini-1.5-flash
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }]
          }
        ],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: 'application/json'
        }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: `Gemini API Error: ${errText}` });
    }

    const data = await response.json();
    const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!candidateText) {
      return res.status(500).json({ error: 'Empty response from Gemini API.' });
    }

    // Clean JSON response
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
