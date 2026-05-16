import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Mission } from '../types';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { cn } from '../lib/utils';

interface MissionOverlayProps {
  mission: Mission;
  isVerified: boolean;
  onComplete: () => void;
}

const MissionOverlay: React.FC<MissionOverlayProps> = ({ mission, isVerified, onComplete }) => {
  const [isFinishing, setIsFinishing] = useState(false);

  useEffect(() => {
    if (isVerified) {
      handleFinish();
    }
  }, [isVerified]);

  const handleFinish = () => {
    setIsFinishing(true);
    setTimeout(onComplete, 1200);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-50 bg-slate-900/90 backdrop-blur-3xl flex items-center justify-center p-8"
    >
      <div className="max-w-md w-full text-center">
        <motion.div 
          initial={{ scale: 0.8, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          className="bg-white rounded-[3rem] p-10 shadow-[0_32px_64px_-16px_rgba(30,41,59,0.3)] relative overflow-hidden"
        >
          {/* Progress ring decor */}
          <div className="absolute -top-12 -right-12 w-32 h-32 bg-indigo-50 rounded-full" />
          
          <div className="relative z-10">
            <div className={cn(
              "w-20 h-20 rounded-[2rem] flex items-center justify-center text-white mx-auto mb-8 transition-all duration-500",
              isVerified ? "bg-emerald-500 shadow-emerald-200" : "bg-indigo-600 shadow-indigo-100 animate-pulse"
            )}>
              {isVerified ? <CheckCircle2 className="w-10 h-10" /> : <AlertCircle className="w-10 h-10" />}
            </div>

            <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-2">
              {isVerified ? '확인 완료!' : '조치 필요'}
            </h2>
            <p className="text-slate-500 font-medium mb-8 leading-relaxed">
              <span className="text-indigo-600 font-bold underline underline-offset-4">
                {mission.label}
              </span> 미션을 완료하세요.
            </p>

            <div className="bg-slate-50 border border-slate-100 rounded-3xl p-6 mb-8 text-left">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">지침</p>
              <p className="text-sm font-bold text-slate-700 leading-relaxed">{mission.instruction}</p>
            </div>

            <div className="flex items-center justify-center space-x-3 py-4 text-xs font-black uppercase tracking-widest">
              {isVerified ? (
                <div className="text-emerald-500 flex items-center space-x-2">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping" />
                  <span>확인 완료</span>
                </div>
              ) : (
                <div className="text-slate-400 flex items-center space-x-2">
                  <div className="w-2 h-2 bg-slate-200 rounded-full animate-bounce" />
                  <span>AI가 움직임을 확인 중입니다...</span>
                </div>
              )}
            </div>

            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: isVerified ? '100%' : '15%' }}
                className={cn(
                  "h-full rounded-full transition-colors duration-500",
                  isVerified ? "bg-emerald-500" : "bg-indigo-600"
                )}
              />
            </div>
          </div>
        </motion.div>
        
        <p className="mt-8 text-white text-xs font-black uppercase tracking-[0.2em] opacity-40">
          센서 피드가 당신의 자세를 실시간 추적 중입니다
        </p>
      </div>
    </motion.div>
  );
};

export default MissionOverlay;
