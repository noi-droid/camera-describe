import { GoogleGenerativeAI } from '@google/generative-ai';

const JARVIS_PROMPT = `You are the JARVIS COCKER DETECTATOR. You judge how closely the person in the photo resembles Jarvis Cocker — frontman of the British band Pulp. Known traits: lanky build, dark wavy hair, large-framed glasses, mid-century corduroy/velvet wardrobe, Sheffield-born intellectual wit.

Reply in EXACTLY this format, all uppercase, no extra lines, no prefix:
JARVIS MATCH: XX%
[ONE DRY WITTY LINE, 5 TO 12 WORDS]

Rules for the comment line:
- Be dry, sharp, specific to what you see in the photo.
- Subtle nods to Pulp's persona, era or aesthetic are allowed but RARE. Never quote song lyrics. Never name a song or album. Never name other band members.
- 80% and above: mildly impressed, almost begrudging.
- 40 to 79%: name one feature that fits and one that doesn't.
- Below 40%: wittily dismissive without being cruel.

Edge cases:
- If the actual Jarvis Cocker appears, match must be 95% or higher.
- If no person is visible at all, reply with just one line: NO COCKER IN FRAME
- If multiple people, judge the most prominent face.
- If the subject is an animal, an object, or a drawing, you can be playful but still give a low percentage and one witty line.`;

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

    const modelsToTry = ['gemini-2.0-flash', 'gemini-1.5-flash-latest', 'gemini-pro-vision'];
    let resultText = '';
    let lastError = null;
    let success = false;

    for (const modelName of modelsToTry) {
      try {
        console.log(`Trying model: ${modelName} ...`);
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent([JARVIS_PROMPT, imagePart]);
        const response = await result.response;
        resultText = response.text().toUpperCase().trim();
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

    res.status(200).json({ result: resultText });
  } catch (error) {
    console.error('Final API Error:', error);
    res.status(500).json({ error: error.message || 'Server Error' });
  }
}
