import { useState, useRef } from 'react';

function App() {
  const [isStreaming, setIsStreaming] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState('labels');
  
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
        setResult('NO RESULTS');
      }
    } catch (e) {
      console.error('API error:', e);
      setResult('ERROR');
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
            .slice(0, 5)
            .map(l => l.description.toUpperCase())
            .join('\n');
        }
        return 'NO LABELS';

      case 'description':
        if (res.labelAnnotations) {
          const labels = res.labelAnnotations.slice(0, 5).map(l => l.description.toUpperCase());
          return labels.join('\n');
        }
        return 'NO DESCRIPTION';

      case 'text':
        if (res.textAnnotations && res.textAnnotations.length > 0) {
          return res.textAnnotations[0].description.toUpperCase().slice(0, 100);
        }
        return 'NO TEXT';

      case 'faces':
        if (res.faceAnnotations) {
          return res.faceAnnotations.map((face, i) => {
            const emotions = [];
            if (face.joyLikelihood === 'VERY_LIKELY' || face.joyLikelihood === 'LIKELY') emotions.push('HAPPY');
            if (face.sorrowLikelihood === 'VERY_LIKELY' || face.sorrowLikelihood === 'LIKELY') emotions.push('SAD');
            if (face.angerLikelihood === 'VERY_LIKELY' || face.angerLikelihood === 'LIKELY') emotions.push('ANGRY');
            if (face.surpriseLikelihood === 'VERY_LIKELY' || face.surpriseLikelihood === 'LIKELY') emotions.push('SURPRISED');
            return `FACE ${i + 1}: ${emotions.length > 0 ? emotions.join(' ') : 'NEUTRAL'}`;
          }).join('\n');
        }
        return 'NO FACES';

      default:
        return 'NO RESULTS';
    }
  };

  const reset = () => {
    setCapturedImage(null);
    setResult(null);
    startCamera();
  };

  const cycleMode = () => {
    const modes = ['labels', 'description', 'text', 'faces'];
    const currentIndex = modes.indexOf(mode);
    setMode(modes[(currentIndex + 1) % modes.length]);
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'black',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    }}>
      
      {/* Start button */}
      {!isStreaming && !capturedImage && (
        <button
          onClick={startCamera}
          style={{
            padding: '16px 32px',
            backgroundColor: 'white',
            color: 'black',
            fontFamily: '"OTR Grotesk", system-ui, sans-serif',
            fontSize: 14,
            fontWeight: 400,
            letterSpacing: '0.05em',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          TAP TO START
        </button>
      )}

      {/* Video preview - fullscreen */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        style={{
          display: isStreaming ? 'block' : 'none',
          width: '90vw',
          height: '90vh',
          objectFit: 'cover',
        }}
      />

      {/* Captured image with overlay */}
      {capturedImage && (
        <div style={{
          position: 'relative',
          width: '90vw',
          height: '90vh',
        }}>
          <img
            src={capturedImage}
            alt="Captured"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
          
          {/* Result overlay */}
          {result && (
            <div style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 32,
            }}>
              <div style={{
                fontFamily: '"OTR Grotesk", system-ui, sans-serif',
                fontWeight: 400,
                fontSize: 'clamp(36px, 12vw, 120px)',
                color: 'white',
                textAlign: 'center',
                lineHeight: 0.9,
                letterSpacing: '-0.02em',
                whiteSpace: 'pre-wrap',
                mixBlendMode: 'difference',
              }}>
                {result}
              </div>
            </div>
          )}

          {/* Loading overlay */}
          {loading && (
            <div style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(0,0,0,0.5)',
            }}>
              <div style={{
                fontFamily: '"OTR Grotesk", system-ui, sans-serif',
                fontWeight: 400,
                fontSize: 'clamp(36px, 12vw, 120px)',
                color: 'white',
                letterSpacing: '-0.02em',
              }}>
                ...
              </div>
            </div>
          )}
        </div>
      )}

      {/* Hidden canvas */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* Mode button */}
      <button
        onClick={cycleMode}
        style={{
          position: 'absolute',
          top: 16,
          left: 16,
          padding: '8px 16px',
          backgroundColor: 'rgba(255,255,255,0.0)',
          color: 'white',
          fontFamily: 'monospace',
          fontSize: 12,
          border: 'none',
          cursor: 'pointer',
          zIndex: 10,
          mixBlendMode: 'difference',
        }}
      >
        {mode.toUpperCase()}
      </button>

      {/* Capture button */}
      {isStreaming && (
        <button
          onClick={captureAndAnalyze}
          style={{
            position: 'absolute',
            bottom: 32,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 64,
            height: 64,
            borderRadius: '50%',
            backgroundColor: 'white',
            border: '4px solid rgba(255,255,255,0.5)',
            cursor: 'pointer',
            zIndex: 10,
          }}
        />
      )}

      {/* Reset button */}
      {capturedImage && !loading && (
        <button
          onClick={reset}
          style={{
            position: 'absolute',
            bottom: 32,
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '12px 24px',
            backgroundColor: 'rgba(255,255,255,0.2)',
            color: 'white',
            fontFamily: 'monospace',
            fontSize: 12,
            border: 'none',
            cursor: 'pointer',
            zIndex: 10,
            mixBlendMode: 'difference',
          }}
        >
          AGAIN
        </button>
      )}
    </div>
  );
}

export default App;