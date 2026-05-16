import React, { useState, useEffect } from 'react';
import { Play, Pause, Square } from 'lucide-react';
import { PomodoroState } from '../types';
import { POMODORO } from '../constants';
import { cn } from '../lib/utils';

interface PomodoroControlProps {
  state: PomodoroState;
  onChangeState: (state: PomodoroState) => void;
  warnings: number;
}

const PomodoroControl: React.FC<PomodoroControlProps> = ({ state, onChangeState, warnings }) => {
  const [timeLeft, setTimeLeft] = useState(POMODORO.WORK);
  
  useEffect(() => {
    let interval: any;
    if (state === 'work' && timeLeft > 0) {
      interval = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    } else if (timeLeft === 0 && state === 'work') {
      onChangeState('break');
      setTimeLeft(POMODORO.BREAK);
    }
    return () => clearInterval(interval);
  }, [state, timeLeft, onChangeState]);

  const progress = (timeLeft / POMODORO.WORK) * 251.2;
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  return (
    <div className="h-40 bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100 flex items-center justify-between shrink-0 hover:border-indigo-100 transition-all">
      <div className="flex space-x-8 items-center">
        {/* Circular Progress */}
        <div className="relative w-24 h-24 group">
          <svg className="w-full h-full transform -rotate-90">
            <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="6" fill="transparent" className="text-slate-50" />
            <circle 
              cx="48" cy="48" r="40" 
              stroke="currentColor" strokeWidth="6" fill="transparent" 
              strokeDasharray="251.2" 
              strokeDashoffset={251.2 - progress} 
              className={cn(
                "transition-all duration-1000 ease-linear",
                state === 'work' ? "text-indigo-600" : "text-emerald-500"
              )} 
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center font-black text-xl tracking-tighter text-slate-800">
            {minutes.toString().padStart(2, '0')}:{seconds.toString().padStart(2, '0')}
          </div>
        </div>

        <div>
          <h3 className="text-lg font-black text-slate-800 tracking-tight">
            {state === 'work' ? '딥 워크 사이클' : state === 'break' ? '휴식 시간' : '시작할 준비가 되셨나요?'}
          </h3>
          <p className="text-slate-400 text-xs font-semibold mt-1">
            {state === 'work' ? `앞으로 ${minutes}분 ${seconds}초 동안 바른 자세를 유지하세요.` : '일어나서 어깨를 스트레칭하세요.'}
          </p>
          <div className="mt-3 flex space-x-2">
            <span className={cn(
              "px-2 py-1 text-[9px] font-black rounded-lg uppercase tracking-widest",
              state === 'work' ? "bg-indigo-50 text-indigo-600" : "bg-emerald-50 text-emerald-500"
            )}>
              {state === 'work' ? '집중 모드' : '회복 모드'}
            </span>
            <span className="px-2 py-1 bg-slate-50 text-slate-400 text-[9px] font-black rounded-lg uppercase tracking-widest border border-slate-100">
              경고 횟수: {warnings}/5
            </span>
          </div>
        </div>
      </div>

      <div className="flex space-x-3">
        {state === 'idle' ? (
          <button 
            onClick={() => onChangeState('work')}
            className="w-32 h-14 bg-slate-900 text-white font-black rounded-2xl shadow-xl shadow-slate-200 hover:bg-indigo-600 transition-all active:scale-95 text-xs uppercase tracking-widest flex items-center justify-center gap-2"
          >
            <Play className="w-4 h-4 fill-current" />
            시작
          </button>
        ) : (
          <>
            <button 
              onClick={() => onChangeState('idle')}
              className="w-14 h-14 rounded-2xl border border-slate-100 flex items-center justify-center hover:bg-slate-50 transition-all text-slate-400 hover:text-indigo-600"
            >
              {state === 'work' ? <Pause className="w-5 h-5 fill-current" /> : <Square className="w-5 h-5 fill-current" />}
            </button>
            <button 
              onClick={() => { onChangeState('idle'); setTimeLeft(POMODORO.WORK); }}
              className="w-32 h-14 bg-slate-900 text-white font-black rounded-2xl shadow-lg hover:bg-rose-600 transition-all text-xs uppercase tracking-widest"
            >
              중단
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default PomodoroControl;
