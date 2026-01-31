import { useState, useRef } from 'react';

function App() {
  const [isStreaming, setIsStreaming] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState('gemini');
  
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

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

  // ★修正箇所: 自分のバックエンドAPI (/api/analyze) を呼ぶ関数に変更
  const analyzeImage = async (base64Image) => {
    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base64Image, mode }),
    });

    if (!response.ok) {
      throw new Error('Server error');
    }

    const data = await response.json();
    return data.result;
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
    // Base64のヘッダー部分を削除してデータだけ送る
    const base64Image = imageData.replace(/^data:image\/\w+;base64,/, '');
    
    setCapturedImage(imageData);
    stopCamera();
    setLoading(true);

    try {
      // ★ここでサーバーへの問い合わせを実行
      const resultText = await analyzeImage(base64Image);
      setResult(resultText);
    } catch (e) {
      console.error('API error:', e);
      setResult('ERROR');
    }
    
    setLoading(false);
  };

  const reset = () => {
    setCapturedImage(null);
    setResult(null);
    startCamera();
  };

  const cycleMode = () => {
    const modes = ['gemini', 'celebrity', 'mood', 'haiku', 'labels', 'text', 'faces'];
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
            fontWeight: 900,
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
                letterSpacing: '-0.01em',
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
                letterSpacing: '-0.01em',
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