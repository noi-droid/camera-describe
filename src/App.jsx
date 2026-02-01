import { useState, useRef, useEffect } from 'react';

function App() {
  const [isStreaming, setIsStreaming] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState('gemini');
  
  // カメラ設定
  const [facingMode, setFacingMode] = useState('environment'); // environment or user
  const [zoom, setZoom] = useState(1);
  const [exposure, setExposure] = useState(0);
  const [focus, setFocus] = useState('auto'); // auto or manual
  const [focusDistance, setFocusDistance] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [capabilities, setCapabilities] = useState({});
  
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const trackRef = useRef(null);

  const startCamera = async (facing = facingMode) => {
    try {
      // 既存のストリームを停止
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: facing,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        } 
      });
      
      videoRef.current.srcObject = stream;
      streamRef.current = stream;
      
      const track = stream.getVideoTracks()[0];
      trackRef.current = track;
      
      // カメラの機能を取得
      const caps = track.getCapabilities();
      setCapabilities(caps);
      console.log('Camera capabilities:', caps);
      
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
      trackRef.current = null;
    }
    setIsStreaming(false);
  };

  // カメラ設定を適用
  const applySettings = async (settings) => {
    if (!trackRef.current) return;
    
    try {
      await trackRef.current.applyConstraints({ advanced: [settings] });
    } catch (e) {
      console.warn('Failed to apply settings:', e);
    }
  };

  // ズーム変更
  const handleZoomChange = (value) => {
    setZoom(value);
    applySettings({ zoom: value });
  };

  // 露出変更
  const handleExposureChange = (value) => {
    setExposure(value);
    applySettings({ exposureCompensation: value });
  };

  // フォーカス変更
  const handleFocusChange = (mode) => {
    setFocus(mode);
    if (mode === 'auto') {
      applySettings({ focusMode: 'continuous' });
    } else {
      applySettings({ focusMode: 'manual' });
    }
  };

  // フォーカス距離変更
  const handleFocusDistanceChange = (value) => {
    setFocusDistance(value);
    applySettings({ focusDistance: value });
  };

  // カメラ切り替え
  const toggleCamera = () => {
    const newFacing = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(newFacing);
    startCamera(newFacing);
  };

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
    const base64Image = imageData.replace(/^data:image\/\w+;base64,/, '');
    
    setCapturedImage(imageData);
    stopCamera();
    setLoading(true);

    try {
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
          onClick={() => startCamera()}
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

      {/* Video preview */}
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
                fontWeight: 900,
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

      {/* Settings button */}
{isStreaming && (
  <button
    onClick={() => setShowSettings(!showSettings)}
    style={{
      position: 'absolute',
      top: 16,
      right: 16,
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
    SETTINGS
  </button>
)}

{/* Camera toggle button */}
{isStreaming && (
  <button
    onClick={toggleCamera}
    style={{
      position: 'absolute',
      top: 16,
      right: 100,
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
    FLIP
  </button>
)}

      {/* Settings panel */}
      {isStreaming && showSettings && (
        <div style={{
          position: 'absolute',
          top: 60,
          right: 16,
          backgroundColor: 'rgba(0,0,0,0.8)',
          padding: 16,
          borderRadius: 8,
          color: 'white',
          fontFamily: 'monospace',
          fontSize: 12,
          zIndex: 20,
          minWidth: 200,
        }}>
          {/* Zoom */}
          {capabilities.zoom && (
            <div style={{ marginBottom: 12 }}>
              <div>ZOOM: {zoom.toFixed(1)}x</div>
              <input
                type="range"
                min={capabilities.zoom.min}
                max={capabilities.zoom.max}
                step={capabilities.zoom.step || 0.1}
                value={zoom}
                onChange={(e) => handleZoomChange(parseFloat(e.target.value))}
                style={{ width: '100%' }}
              />
            </div>
          )}

          {/* Exposure */}
          {capabilities.exposureCompensation && (
            <div style={{ marginBottom: 12 }}>
              <div>EXPOSURE: {exposure.toFixed(1)}</div>
              <input
                type="range"
                min={capabilities.exposureCompensation.min}
                max={capabilities.exposureCompensation.max}
                step={capabilities.exposureCompensation.step || 0.1}
                value={exposure}
                onChange={(e) => handleExposureChange(parseFloat(e.target.value))}
                style={{ width: '100%' }}
              />
            </div>
          )}

          {/* Focus Mode */}
          {capabilities.focusMode && (
            <div style={{ marginBottom: 12 }}>
              <div>FOCUS:</div>
              <select
                value={focus}
                onChange={(e) => handleFocusChange(e.target.value)}
                style={{
                  width: '100%',
                  padding: 4,
                  backgroundColor: 'black',
                  color: 'white',
                  border: '1px solid white',
                }}
              >
                <option value="auto">AUTO</option>
                <option value="manual">MANUAL</option>
              </select>
            </div>
          )}

          {/* Focus Distance (only for manual) */}
          {capabilities.focusDistance && focus === 'manual' && (
            <div style={{ marginBottom: 12 }}>
              <div>FOCUS DISTANCE: {focusDistance.toFixed(2)}</div>
              <input
                type="range"
                min={capabilities.focusDistance.min}
                max={capabilities.focusDistance.max}
                step={capabilities.focusDistance.step || 0.01}
                value={focusDistance}
                onChange={(e) => handleFocusDistanceChange(parseFloat(e.target.value))}
                style={{ width: '100%' }}
              />
            </div>
          )}

          {/* No capabilities message */}
          {!capabilities.zoom && !capabilities.exposureCompensation && !capabilities.focusMode && (
            <div style={{ opacity: 0.5 }}>
              No adjustable settings available on this device
            </div>
          )}
        </div>
      )}

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