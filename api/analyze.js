import { GoogleGenerativeAI } from '@google/generative-ai';

// Vercel Serverless Function
export default async function handler(req, res) {
  // CORS設定（ブラウザからのアクセスを許可）
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // OPTIONSリクエスト（プリフライト）の処理
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { base64Image, mode } = req.body;
  const API_KEY = process.env.VITE_GOOGLE_API_KEY; // 環境変数からキーを取得

  if (!API_KEY) {
    return res.status(500).json({ error: 'API Key not configured' });
  }

  try {
    let resultText = '';

    // --- Geminiの処理 ---
    if (['gemini', 'celebrity', 'mood', 'haiku'].includes(mode)) {
      const prompts = {
        gemini: 'Describe this image in 10 words or less. Be direct and poetic. Reply in uppercase.',
        celebrity: 'If there is a famous person in this image, tell me who they are. If not, describe who you see. Be brief, 10 words max. Reply in uppercase.',
        mood: 'Describe the mood or atmosphere of this image in 5 words or less. Reply in uppercase.',
        haiku: 'Write a haiku about this image. Reply in uppercase.',
      };

      const genAI = new GoogleGenerativeAI(API_KEY);
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash-latest' });
      
      const prompt = prompts[mode];
      const imagePart = {
        inlineData: {
          data: base64Image,
          mimeType: 'image/jpeg',
        },
      };

      const result = await model.generateContent([prompt, imagePart]);
      const response = await result.response;
      resultText = response.text().toUpperCase();
    } 
    // --- Vision API (Legacy) の処理 ---
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
        resultText = resData.faceAnnotations.map((face) => {
          const emotions = [];
          if (['VERY_LIKELY', 'LIKELY'].includes(face.joyLikelihood)) emotions.push('HAPPY');
          if (['VERY_LIKELY', 'LIKELY'].includes(face.sorrowLikelihood)) emotions.push('SAD');
          if (['VERY_LIKELY', 'LIKELY'].includes(face.angerLikelihood)) emotions.push('ANGRY');
          if (['VERY_LIKELY', 'LIKELY'].includes(face.surpriseLikelihood)) emotions.push('SURPRISED');
          return emotions.length > 0 ? emotions.join(' ') : 'NEUTRAL';
        }).join('\n');
      } else {
        resultText = "NO DATA FOUND";
      }
    }

    res.status(200).json({ result: resultText });

  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ error: error.message });
  }
}