import { useEffect, useRef, useState, useCallback } from 'react';
import { PostureData } from '../types';
import { POSTURE_THRESHOLDS } from '../constants';

declare global {
  interface Window {
    Pose: any;
    Camera: any;
    drawConnectors: any;
    drawLandmarks: any;
    POSE_CONNECTIONS: any;
  }
}

export function usePoseDetection(onResult: (results: any) => void) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isReady, setIsReady] = useState(false);
  const [hasFrames, setHasFrames] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  
  // Calibration State
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [calibrationCountdown, setCalibrationCountdown] = useState(0);
  const [baselineHeight, setBaselineHeight] = useState<number | null>(null);
  const samplesRef = useRef<number[]>([]);
  const smoothedHeightRef = useRef<number | null>(null);

  const startCalibration = useCallback((durationSeconds: number = 3) => {
    setIsCalibrating(true);
    setCalibrationCountdown(durationSeconds);
    samplesRef.current = [];
  }, []);

  useEffect(() => {
    let countdownInterval: any = null;
    if (isCalibrating && calibrationCountdown > 0) {
      countdownInterval = setInterval(() => {
        setCalibrationCountdown(prev => prev - 1);
      }, 1000);
    } else if (isCalibrating && calibrationCountdown === 0) {
      // Calculate average baseline
      if (samplesRef.current.length > 3) {
        const avg = samplesRef.current.reduce((a, b) => a + b, 0) / samplesRef.current.length;
        setBaselineHeight(avg);
      }
      setIsCalibrating(false);
    }
    return () => {
      if (countdownInterval) clearInterval(countdownInterval);
    };
  }, [isCalibrating, calibrationCountdown]);

  const [retryTrigger, setRetryTrigger] = useState(0);

  const refreshCamera = useCallback(() => {
    setCameraError(null);
    setRetryTrigger(prev => prev + 1);
  }, []);

  useEffect(() => {
    let active = true;
    let camera: any = null;
    let pose: any = null;
    let frameCount = 0;

    const init = async () => {
      try {
        if (!window.Pose || !window.Camera) {
          console.log("Waiting for MediaPipe scripts to load...");
          if (active) setTimeout(init, 1000);
          return;
        }

        // Reset global arguments to prevent MediaPipe/Emscripten collision
        (window as any).arguments = [];

        console.log("Initializing Pose Model...");
        pose = new window.Pose({
          locateFile: (file: string) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
          },
        });

        pose.setOptions({
          modelComplexity: 1,
          smoothLandmarks: true,
          enableSegmentation: false,
          smoothSegmentation: true,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });

        pose.onResults((results: any) => {
          if (!active) return;
          
          if (frameCount === 0) console.log("First MediaPipe results received!");
          
          if (frameCount >= 1) {
            setHasFrames(true);
          }
          frameCount++;

          if (results.poseLandmarks && results.poseLandmarks.length >= 13) {
            const landmarks = results.poseLandmarks;
            const nose = landmarks[0];
            const ls = landmarks[11]; // Left Shoulder
            const rs = landmarks[12]; // Right Shoulder
            
            if (nose && ls && rs) {
              const shoulderWidth = Math.abs(ls.x - rs.x);
              
              if (shoulderWidth < POSTURE_THRESHOLDS.MIN_SHOULDER_WIDTH) {
                onResult({ ...results, postureAnalysis: null });
                return;
              }

              const shoulderLineY = (ls.y + rs.y) / 2;
              const rawHeight = (shoulderLineY - nose.y) / shoulderWidth;

              if (smoothedHeightRef.current === null) {
                smoothedHeightRef.current = rawHeight;
              } else {
                const alpha = POSTURE_THRESHOLDS.EMA_ALPHA;
                smoothedHeightRef.current = (smoothedHeightRef.current * (1 - alpha)) + (rawHeight * alpha);
              }

              if (isCalibrating) {
                samplesRef.current.push(rawHeight);
              }

              const baseline = baselineHeight || POSTURE_THRESHOLDS.BASELINE_FALLBACK;
              const isBad = smoothedHeightRef.current < (baseline * POSTURE_THRESHOLDS.SLUMP_FACTOR);

              if (isBad) {
                const now = Date.now();
                const lastVibrate = (window as any).lastVibrateTime || 0;
                if (now - lastVibrate > POSTURE_THRESHOLDS.VIBRATION_COOLDOWN_MS && window.navigator.vibrate) {
                  window.navigator.vibrate([300, 100, 300]);
                  (window as any).lastVibrateTime = now;
                }
              }
            }
          }

          if (canvasRef.current && results.poseLandmarks) {
            const canvasCtx = canvasRef.current.getContext('2d');
            if (canvasCtx) {
              const { width, height } = canvasRef.current;
              canvasCtx.save();
              canvasCtx.clearRect(0, 0, width, height);
              
              if (results.image) {
                canvasCtx.drawImage(results.image, 0, 0, width, height);
              }

              const landmarks = results.poseLandmarks;
              const nose = landmarks[0];
              const ls = landmarks[11];
              const rs = landmarks[12];
              
              if (nose && ls && rs) {
                const baseline = baselineHeight || POSTURE_THRESHOLDS.BASELINE_FALLBACK;
                const isBad = smoothedHeightRef.current !== null && 
                             smoothedHeightRef.current < (baseline * POSTURE_THRESHOLDS.SLUMP_FACTOR);

                canvasCtx.lineWidth = 4;
                canvasCtx.strokeStyle = isBad ? '#ef4444' : '#6366f1';
                
                const points = [
                  { x: nose.x * width, y: nose.y * height },
                  { x: ((ls.x + rs.x)/2) * width, y: ((ls.y + rs.y)/2) * height },
                  { x: ls.x * width, y: ls.y * height },
                  { x: rs.x * width, y: rs.y * height },
                  { x: (landmarks[13]?.x || 0) * width, y: (landmarks[13]?.y || 0) * height },
                  { x: (landmarks[14]?.x || 0) * width, y: (landmarks[14]?.y || 0) * height },
                ];

                canvasCtx.beginPath();
                canvasCtx.moveTo(points[0].x, points[0].y);
                canvasCtx.lineTo(points[1].x, points[1].y);
                canvasCtx.stroke();

                canvasCtx.beginPath();
                canvasCtx.moveTo(points[2].x, points[2].y);
                canvasCtx.lineTo(points[3].x, points[3].y);
                canvasCtx.stroke();

                if (window.drawLandmarks) {
                  window.drawLandmarks(canvasCtx, [landmarks[0], landmarks[11], landmarks[12], landmarks[13], landmarks[14]].filter(Boolean),
                                      {color: '#ffffff', fillColor: isBad ? '#ef4444' : '#4f46e5', lineWidth: 2, radius: 5});
                }
              }
              canvasCtx.restore();
            }
          }
          
          const enhancedResults = {
            ...results,
            smoothedHeight: smoothedHeightRef.current
          };
          onResult(enhancedResults);
        });

        if (videoRef.current) {
          console.log("Starting Camera Request...");
          videoRef.current.width = 640;
          videoRef.current.height = 480;

          camera = new window.Camera(videoRef.current, {
            onFrame: async () => {
              if (active && videoRef.current && videoRef.current.readyState >= 2 && videoRef.current.videoWidth > 0) {
                try {
                  await pose.send({ image: videoRef.current });
                } catch (err) {
                  // Silent fail
                }
              }
            },
            width: 640,
            height: 480,
          });
          
          try {
            await camera.start();
            console.log("Pose and Camera Started Successfully");
            if (active) {
              setIsReady(true);
              setCameraError(null);
            }
          } catch (camErr: any) {
            console.error("Camera start failed:", camErr);
            if (active) {
              setCameraError(camErr.name === 'NotFoundError' ? '카메라를 찾을 수 없습니다. 연결 상태를 확인해주세요.' : (camErr.message || String(camErr)));
              // No auto-retry for NotFoundError to avoid infinite loops, wait for manual refresh
              if (camErr.name !== 'NotFoundError') {
                setTimeout(init, 5000);
              }
            }
          }
        } else {
          if (active) setTimeout(init, 1000);
        }
      } catch (error) {
        console.error("Critical Pose Error:", error);
        if (active) setTimeout(init, 3000);
      }
    };

    init();

    return () => {
      active = false;
      if (camera) {
        try {
          camera.stop();
        } catch (e) {}
      }
      if (pose) {
        try {
          pose.close();
        } catch (e) {}
      }
    };
  }, [onResult, retryTrigger]);

  return { 
    videoRef, 
    canvasRef, 
    isReady, 
    hasFrames, 
    cameraError,
    isCalibrating, 
    calibrationCountdown, 
    baselineHeight, 
    startCalibration,
    refreshCamera
  };
}

export function analyzePosture(results: any, baseline?: number): PostureData | null {
  if (!results.poseLandmarks || results.poseLandmarks.length < 13) return null;

  const landmarks = results.poseLandmarks;
  const ls = landmarks[11];
  const rs = landmarks[12];
  const le = landmarks[7]; // Left Ear
  const re = landmarks[8]; // Right Ear
  const nose = landmarks[0];

  if (!ls || !rs || !le || !re || !nose) return null;

  // 1. Physical Context Analysis
  const shoulderWidth = Math.abs(ls.x - rs.x);
  
  // Skip if user is rotated too much or too far from the camera
  if (shoulderWidth < POSTURE_THRESHOLDS.MIN_SHOULDER_WIDTH) return null;

  const shoulderCenterY = (ls.y + rs.y) / 2;
  const shoulderAngle = Math.atan2(rs.y - ls.y, rs.x - ls.x) * (180 / Math.PI);
  
  // 2. Optimized Height Metric
  // Use the EMA-smoothed height passed from the callback to avoid jittering scores
  const normalizedHeight = results.smoothedHeight !== undefined ? results.smoothedHeight : (shoulderCenterY - nose.y) / shoulderWidth;

  // 3. Alignment Checks
  const headAngle = Math.atan2(re.y - le.y, re.x - le.x) * (180 / Math.PI);

  // 4. Baseline Alignment
  // Compare current smoothed height to the user's calibrated baseline (or global fallback)
  const targetHeight = baseline || POSTURE_THRESHOLDS.BASELINE_FALLBACK;
  const isSlumped = normalizedHeight < targetHeight * POSTURE_THRESHOLDS.SLUMP_FACTOR;
  
  // 5. Dynamic Score Calculation
  let score = 100;

  // Slumping / Sinking Penalty (Turtle Neck indicator)
  if (normalizedHeight < targetHeight) {
    const diff = (targetHeight - normalizedHeight) / targetHeight;
    score -= diff * 250; // High weight for vertical alignment
  }
  
  // Symmetry Penalties
  if (Math.abs(shoulderAngle) > 8) score -= (Math.abs(shoulderAngle) - 8) * 2;
  if (Math.abs(headAngle) > 8) score -= (Math.abs(headAngle) - 8) * 1.5;

  // 6. Interaction / Exercise Gestures
  const lw = landmarks[15]; // Left Wrist
  const rw = landmarks[16]; // Right Wrist
  const armsUp = (lw && rw) ? (lw.y < nose.y && rw.y < nose.y) : false;
  const armsWide = (lw && rw) ? (Math.abs(lw.x - rw.x) > shoulderWidth * 2.5) : false;
  
  const shoulderCenterX = (ls.x + rs.x) / 2;
  const neckStretchLeft = nose.x > (shoulderCenterX + shoulderWidth * 0.3);
  const neckStretchRight = nose.x < (shoulderCenterX - shoulderWidth * 0.3);

  // 7. Human-Readable Status Mapping
  let description = "좋음";
  if (score < 70) {
    if (isSlumped) description = "구부정한 자세";
    else if (normalizedHeight < targetHeight * POSTURE_THRESHOLDS.NECK_TENSION_FACTOR) description = "목 긴장";
    else if (Math.abs(shoulderAngle) > 12) description = "어깨 불균형";
    else description = "자세 불량";
  } else if (score < 90) {
    if (Math.abs(shoulderAngle) > 8) description = "어깨 비대칭";
    else if (normalizedHeight < targetHeight * POSTURE_THRESHOLDS.GOOD_POSTURE_FACTOR) description = "거북목 주의";
    else description = "자세 주의";
  } else if (score > 96) {
    description = "집중 상태";
  }

  return {
    shoulderAngle,
    neckForwardness: normalizedHeight,
    eyeAlignment: headAngle,
    isSlumped,
    score: Math.min(100, Math.max(0, score)),
    description,
    gestures: {
      armsUp,
      armsWide,
      neckStretchLeft,
      neckStretchRight,
    }
  };
}
