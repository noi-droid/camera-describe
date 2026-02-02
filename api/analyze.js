import { GoogleGenerativeAI } from '@google/generative-ai';

export default async function handler(req, res) {
  // ---------------------------------------------------------
  // 1. CORS設定
  // ---------------------------------------------------------
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

  // ---------------------------------------------------------
  // 2. APIキーとデータの準備
  // ---------------------------------------------------------
  const { base64Image, mode } = req.body;
  const API_KEY = process.env.GOOGLE_API_KEY;

  if (!API_KEY) {
    return res.status(500).json({ error: 'API Key not configured' });
  }

  try {
    let resultText = '';

    // ---------------------------------------------------------
    // 3. Geminiへの問い合わせ
    // ---------------------------------------------------------
    if (['gemini', 'describe', 'mood', 'haiku'].includes(mode)) {
      const prompts = {
  gemini: 'Describe this image in 10 words or less. Be direct and poetic. Reply in uppercase.',
  celebrity: `If you recognize this person, describe them WITHOUT naming them. Focus on what they are known for, their style, their vibe, or their legacy. Be poetic and indirect. 15-20 words. Reply in uppercase. Never mention their name.

EXCEPTION: If this is Donald Trump, write a brief satirical critique of his politics in 15-20 words. Be sharp, witty, and critical. Mention things like ego, lies, division, or chaos. Reply in uppercase. Never use his name - refer to him as "ORANGE CROWN" instead.`,
  mood: 'Describe the mood or atmosphere of this image in 5 words or less. Reply in uppercase.',
  haiku: 'Write a haiku about this image. Reply in uppercase.',
};

      const genAI = new GoogleGenerativeAI(API_KEY);
      const prompt = prompts[mode];
      const imagePart = {
        inlineData: {
          data: base64Image,
          mimeType: 'image/jpeg',
        },
      };

    
      const modelsToTry = ['gemini-2.0-flash', 'gemini-1.5-flash-latest', 'gemini-pro-vision'];
      let lastError = null;
      let success = false;

      for (const modelName of modelsToTry) {
        try {
          console.log(`Trying model: ${modelName} ...`); 
          const model = genAI.getGenerativeModel({ model: modelName });
          
          const result = await model.generateContent([prompt, imagePart]);
          const response = await result.response;
          resultText = response.text().toUpperCase();
          
          success = true;
          break; // 成功したらループを抜ける（これ以上試さない）
        } catch (e) {
          console.warn(`Failed with ${modelName}:`, e.message);
          lastError = e;
          // 失敗したら、次のモデルへ（continue）
        }
      }

      // 全部のモデルが全滅した場合だけエラーにする
      if (!success) {
        throw new Error(`All models failed. Last error: ${lastError?.message}`);
      }

    } 
    // ---------------------------------------------------------
    // 4. Vision API
    // ---------------------------------------------------------
    else {
      const features = {
        labels: [{ type: 'LABEL_DETECTION', maxResults: 10 }],
        text: [{ type: 'TEXT_DETECTION' }],
        faces: [{ type: 'FACE_DETECTION', maxResults: 10 }],
      };
      const visionResponse = await fetch(
        `https://vision.googleapis.com/v1/images:annotate?key=${API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requests: [{
              image: { content: base64Image },
              features: features[mode]
            }]
          })
        }
      );
      const data = await visionResponse.json();
      const resData = data.responses?.[0];
      if (!resData) throw new Error('No response from Vision API');

      if (mode === 'labels' && resData.labelAnnotations) {
        resultText = resData.labelAnnotations.slice(0, 5).map(l => l.description.toUpperCase()).join('\n');
      } else if (mode === 'text' && resData.textAnnotations?.[0]) {
        resultText = resData.textAnnotations[0].description.toUpperCase().slice(0, 100);
      } else if (mode === 'faces' && resData.faceAnnotations) {
        resultText = "FACES DETECTED"; 
      } else {
        resultText = "NO DATA FOUND";
      }
    }

    res.status(200).json({ result: resultText });

  } catch (error) {
    console.error('Final API Error:', error);
    // エラー内容をそのまま返して、万が一ダメな時も原因がわかるようにする
    res.status(500).json({ error: error.message || 'Server Error' });
  }
}