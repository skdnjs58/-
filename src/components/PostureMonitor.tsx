import React from 'react';
import { usePoseDetection } from '../hooks/usePoseDetection';
import { PostureStatus } from '../types';
import { cn } from '../lib/utils';

interface PostureMonitorProps {
  status: PostureStatus;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  isReady: boolean;
  hasFrames: boolean;
  isCalibrating: boolean;
  calibrationCountdown: number;
  cameraError: string | null;
  onCalibrate: () => void;
  onRefreshCamera: () => void;
}

const PostureMonitor: React.FC<PostureMonitorProps> = ({ 
  status, 
  videoRef, 
  canvasRef, 
  isReady, 
  hasFrames, 
  isCalibrating, 
  calibrationCountdown,
  cameraError,
  onCalibrate 
}) => {

  return (
    <div className={cn(
      "relative w-full h-full overflow-hidden flex items-center justify-center transition-colors duration-300",
      status === 'bad' ? "bg-red-900/40" : "bg-slate-900"
    )}>
      <video 
        ref={videoRef} 
        className="absolute inset-0 w-full h-full opacity-0 pointer-events-none object-cover z-0"
        autoPlay
        playsInline
        muted
      />
      <canvas 
        ref={canvasRef}
        className="relative w-full h-full object-cover scale-x-[-1] z-10"
        width={640}
        height={480}
      />
      
      {/* Red Alert Overlay for Bad Posture */}
      {status === 'bad' && (
        <div className="absolute inset-0 border-[16px] border-red-600/50 pointer-events-none animate-pulse z-20" />
      )}
      
      {/* Calibration Countdown Overlay */}
      {isCalibrating && (
        <div className="absolute inset-0 bg-indigo-600/60 backdrop-blur-md flex items-center justify-center z-50">
          <div className="text-center">
            <div className="text-8xl font-black text-white italic mb-4 animate-bounce">
              {calibrationCountdown}
            </div>
            <h3 className="text-white font-black text-2xl tracking-tighter uppercase mb-2">이상적인 자세를 유지하세요</h3>
            <p className="text-white/60 text-[10px] font-black uppercase tracking-[0.2em]">사용자의 체형에 맞게 센서를 최적화하는 중입니다</p>
          </div>
        </div>
      )}
      
      {/* Decorative Guide Frame */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-[50%] h-[70%] border-2 border-dashed border-indigo-400/20 rounded-[4rem] animate-pulse" />
      </div>

      {/* Manual Calibration Button */}
      <div className="absolute bottom-6 right-6 z-40">
        <button 
          onClick={onCalibrate}
          className="bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/10 px-4 py-2 rounded-xl text-white text-[10px] font-black uppercase tracking-wider transition-all active:scale-95"
        >
          기준 자세 재설정
        </button>
      </div>

      {(!isReady || !hasFrames) && !isCalibrating && (
        <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center z-40">
          <div className="text-center p-8 max-w-md">
            {cameraError ? (
              <>
                <div className="w-16 h-16 bg-rose-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                  <div className="w-8 h-8 rounded-full border-4 border-rose-500 border-t-transparent animate-spin" />
                </div>
                <h3 className="text-white font-black text-lg tracking-tight mb-2">
                  카메라 연결 오류
                </h3>
                <p className="text-rose-400 text-xs font-bold uppercase tracking-widest mb-4">
                  {cameraError}
                </p>
                <p className="text-slate-400 text-[10px] leading-relaxed">
                  카메라가 연결되어 있는지 확인하거나, 브라우저의 카메라 권한 설정을 확인해 주세요. 시스템이 자동으로 재시도 중입니다.
                </p>
              </>
            ) : (
              <>
                <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-6 shadow-xl shadow-indigo-500/20" />
                <h3 className="text-white font-black text-lg tracking-tight mb-2">
                  {!isReady ? 'AI 센서 초기화 중...' : '보안 피드 연결 중...'}
                </h3>
                <p className="text-indigo-300/60 text-xs font-bold uppercase tracking-widest">
                  {!isReady ? '카메라 연결을 시작합니다' : '사용자 환경에 최적화 중입니다'}
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PostureMonitor;
