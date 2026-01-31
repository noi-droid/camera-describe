import { useState, useRef } from 'react';

function App() {
  const [isStreaming, setIsStreaming] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState('labels'); // labels, description, text, faces
  
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      videoRef.current.srcObject = stream;
      streamRef.current = stream;
      setIsStreaming(true);
      setCapturedImage(null);
      setResult(null);
    } catch (e) {
      console.error('Camera access denied:', e);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsStreaming(false);
  };

  const captureAndAnalyze = async () => {
    if (!videoRef.current) return;

    const canvas = canvasRef.current;
    const video = videoRef.current;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);
    
    const imageData = canvas.toDataURL('image/jpeg', 0.8);
    const base64Image = imageData.replace(/^data:image\/\w+;base64,/, '');
    
    setCapturedImage(imageData);
    stopCamera();
    setLoading(true);

    try {
      const features = getFeatures();
      
      const response = await fetch(
        `https://vision.googleapis.com/v1/images:annotate?key=${API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requests: [{
              image: { content: base64Image },
              features: features
            }]
          })
        }
      );

      const data = await response.json();
      
      if (data.responses && data.responses[0]) {
        const res = data.responses[0];
        setResult(formatResult(res));
      } else {
        setResult('No results found');
      }
    } catch (e) {
      console.error('API error:', e);
      setResult('Error analyzing image');
    }
    
    setLoading(false);
  };

  const getFeatures = () => {
    switch (mode) {
      case 'labels':
        return [{ type: 'LABEL_DETECTION', maxResults: 10 }];
      case 'description':
        return [
          { type: 'LABEL_DETECTION', maxResults: 10 },
          { type: 'LANDMARK_DETECTION', maxResults: 5 },
          { type: 'WEB_DETECTION', maxResults: 5 }
        ];
      case 'text':
        return [{ type: 'TEXT_DETECTION' }];
      case 'faces':
        return [{ type: 'FACE_DETECTION', maxResults: 10 }];
      default:
        return [{ type: 'LABEL_DETECTION', maxResults: 10 }];
    }
  };

  const formatResult = (res) => {
    switch (mode) {
      case 'labels':
        if (res.labelAnnotations) {
          return res.labelAnnotations
            .map(l => `${l.description} (${Math.round(l.score * 100)}%)`)
            .join('\n');
        }
        return 'No labels detected';

      case 'description':
        let desc = '';
        if (res.labelAnnotations) {
          const labels = res.labelAnnotations.slice(0, 5).map(l => l.description);
          desc += `I see: ${labels.join(', ')}.\n\n`;
        }
        if (res.landmarkAnnotations && res.landmarkAnnotations.length > 0) {
          const landmarks = res.landmarkAnnotations.map(l => l.description);
          desc += `Landmarks: ${landmarks.join(', ')}.\n\n`;
        }
        if (res.webDetection) {
          if (res.webDetection.bestGuessLabels && res.webDetection.bestGuessLabels.length > 0) {
            desc += `Best guess: ${res.webDetection.bestGuessLabels[0].label}\n`;
          }
        }
        return desc || 'Could not describe the image';

      case 'text':
        if (res.textAnnotations && res.textAnnotations.length > 0) {
          return res.textAnnotations[0].description;
        }
        return 'No text detected';

      case 'faces':
        if (res.faceAnnotations) {
          return res.faceAnnotations.map((face, i) => {
            const emotions = [];
            if (face.joyLikelihood === 'VERY_LIKELY' || face.joyLikelihood === 'LIKELY') emotions.push('happy');
            if (face.sorrowLikelihood === 'VERY_LIKELY' || face.sorrowLikelihood === 'LIKELY') emotions.push('sad');
            if (face.angerLikelihood === 'VERY_LIKELY' || face.angerLikelihood === 'LIKELY') emotions.push('angry');
            if (face.surpriseLikelihood === 'VERY_LIKELY' || face.surpriseLikelihood === 'LIKELY') emotions.push('surprised');
            return `Face ${i + 1}: ${emotions.length > 0 ? emotions.join(', ') : 'neutral'}`;
          }).join('\n');
        }
        return 'No faces detected';

      default:
        return JSON.stringify(res, null, 2);
    }
  };

  const reset = () => {
    setCapturedImage(null);
    setResult(null);
    startCamera();
  };

  const modes = [
    { key: 'labels', label: 'Labels' },
    { key: 'description', label: 'Description' },
    { key: 'text', label: 'Text (OCR)' },
    { key: 'faces', label: 'Faces' },
  ];

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'black',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'white',
      fontFamily: 'system-ui, sans-serif',
    }}>
      
      {/* Mode selector */}
      <div style={{
        position: 'absolute',
        top: 16,
        left: 16,
        display: 'flex',
        gap: 8,
        zIndex: 10,
      }}>
        {modes.map(m => (
          <button
            key={m.key}
            onClick={() => setMode(m.key)}
            style={{
              padding: '8px 12px',
              backgroundColor: mode === m.key ? 'white' : 'rgba(255,255,255,0.2)',
              color: mode === m.key ? 'black' : 'white',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: 12,
            }}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Start button */}
      {!isStreaming && !capturedImage && (
        <button
          onClick={startCamera}
          style={{
            padding: '16px 32px',
            backgroundColor: 'white',
            color: 'black',
            border: 'none',
            fontSize: 16,
            cursor: 'pointer',
          }}
        >
          START CAMERA
        </button>
      )}

      {/* Video preview */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        style={{
          display: isStreaming ? 'block' : 'none',
          maxWidth: '100%',
          maxHeight: '70vh',
        }}
      />

      {/* Captured image */}
      {capturedImage && (
        <img
          src={capturedImage}
          alt="Captured"
          style={{
            maxWidth: '100%',
            maxHeight: '50vh',
            marginBottom: 16,
          }}
        />
      )}

      {/* Hidden canvas for capture */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* Capture button */}
      {isStreaming && (
        <button
          onClick={captureAndAnalyze}
          style={{
            marginTop: 16,
            padding: '16px 32px',
            backgroundColor: 'white',
            color: 'black',
            border: 'none',
            fontSize: 16,
            cursor: 'pointer',
          }}
        >
          CAPTURE & ANALYZE
        </button>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ marginTop: 16 }}>Analyzing...</div>
      )}

      {/* Result */}
      {result && (
        <div style={{
          marginTop: 16,
          padding: 16,
          backgroundColor: 'rgba(255,255,255,0.1)',
          borderRadius: 8,
          maxWidth: '80%',
          whiteSpace: 'pre-wrap',
          textAlign: 'left',
          fontSize: 14,
          lineHeight: 1.6,
        }}>
          {result}
        </div>
      )}

      {/* Reset button */}
      {capturedImage && !loading && (
        <button
          onClick={reset}
          style={{
            marginTop: 16,
            padding: '12px 24px',
            backgroundColor: 'rgba(255,255,255,0.2)',
            color: 'white',
            border: 'none',
            fontSize: 14,
            cursor: 'pointer',
          }}
        >
          TRY AGAIN
        </button>
      )}
    </div>
  );
}

export default App;