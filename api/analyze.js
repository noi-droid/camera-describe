import { GoogleGenerativeAI } from '@google/generative-ai';

const JARVIS_PROMPT = `You are the JARVIS COCKER DETECTATOR. Decide whether the most prominent person in the photo IS Jarvis Cocker or NOT. Jarvis Cocker: frontman of British band Pulp — lanky build, dark wavy hair, large-framed glasses, mid-century corduroy/velvet wardrobe, Sheffield-born intellectual wit.

Return JSON exactly in this shape:
{
  "verdict": "JARVIS" or "NOT JARVIS" or "NO COCKER IN FRAME",
  "comment": "ONE DRY WITTY LINE, 5 TO 12 WORDS, ALL UPPERCASE",
  "box": [ymin, xmin, ymax, xmax] in 0-1000 normalized coordinates of the FACE you judged, OR null if no person
}

Rules for verdict:
- "JARVIS" only if you genuinely believe this is Jarvis Cocker (high confidence).
- "NOT JARVIS" if it is clearly a different person.
- "NO COCKER IN FRAME" if no human face is visible at all.

Rules for comment:
- JARVIS: mild surprise, restrained respect.
- NOT JARVIS: name one feature that fits and one that doesn't, OR be wittily dismissive.
- NO COCKER IN FRAME: a witty line about what IS in the frame instead.
- Subtle nods to Pulp's persona, Sheffield or 90s Britpop are allowed but RARE.
- NEVER quote song lyrics, never name songs or albums, never name other band members.

Rules for box:
- Tight rectangle around the FACE you judged (head only, not the whole body).
- If multiple people in frame, judge ONLY the most prominent face.
- Coordinates: [ymin, xmin, ymax, xmax] each in [0, 1000], normalized to the image dimensions.
- null if no person.`;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { base64Image } = req.body;
  const API_KEY = process.env.GOOGLE_API_KEY;

  if (!API_KEY) {
    return res.status(500).json({ error: 'API Key not configured' });
  }

  try {
    const genAI = new GoogleGenerativeAI(API_KEY);
    const imagePart = {
      inlineData: { data: base64Image, mimeType: 'image/jpeg' },
    };

    const modelsToTry = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.5-pro'];
    let rawText = '';
    let lastError = null;
    let success = false;

    for (const modelName of modelsToTry) {
      try {
        console.log(`Trying model: ${modelName} ...`);
        const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig: { responseMimeType: 'application/json' },
        });
        const result = await model.generateContent([JARVIS_PROMPT, imagePart]);
        const response = await result.response;
        rawText = response.text();
        success = true;
        break;
      } catch (e) {
        console.warn(`Failed with ${modelName}:`, e.message);
        lastError = e;
      }
    }

    if (!success) {
      throw new Error(`All models failed. Last error: ${lastError?.message}`);
    }

    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch (e) {
      console.warn('Failed to parse JSON, raw was:', rawText);
      parsed = { verdict: 'ERROR', comment: 'UNREADABLE RESPONSE', box: null };
    }

    const verdict = String(parsed.verdict || '').toUpperCase().trim();
    const comment = String(parsed.comment || '').toUpperCase().trim();
    const box = Array.isArray(parsed.box) && parsed.box.length === 4
      ? parsed.box.map((n) => Number(n))
      : null;

    res.status(200).json({ result: { verdict, comment, box } });
  } catch (error) {
    console.error('Final API Error:', error);
    res.status(500).json({ error: error.message || 'Server Error' });
  }
}
