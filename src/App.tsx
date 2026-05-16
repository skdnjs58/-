import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  BarChart3, 
  AlertCircle,
  ShieldCheck,
  Activity,
  User as UserIcon,
  Camera,
  LayoutDashboard,
  Trophy,
  History,
  Home
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PostureStatus, PomodoroState, Mission } from './types';
import { MISSIONS, POMODORO, POSTURE_THRESHOLDS } from './constants';
import { cn } from './lib/utils';
import { analyzePosture, usePoseDetection } from './hooks/usePoseDetection';
import { auth, db, googleProvider } from './lib/firebase';
import { signInWithPopup, onAuthStateChanged, signOut, User } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, collection } from 'firebase/firestore';

// Components
import PostureMonitor from './components/PostureMonitor';
import StatsOverview from './components/StatsOverview';
import PomodoroControl from './components/PomodoroControl';
import MissionOverlay from './components/MissionOverlay';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [baseline, setBaseline] = useState<number | undefined>();
  const [isInitialSetup, setIsInitialSetup] = useState(false);
  const [status, setStatus] = useState<PostureStatus>('off');
  const [posData, setPosData] = useState<any>(null);
  const [pomodoroState, setPomodoroState] = useState<PomodoroState>('idle');
  const [warnings, setWarnings] = useState(0);
  const sessionStartRef = useRef<number | null>(null);

  useEffect(() => {
    if (pomodoroState === 'work' && !sessionStartRef.current) {
      sessionStartRef.current = Date.now();
    } else if (pomodoroState === 'idle' && sessionStartRef.current && user) {
      const duration = Math.floor((Date.now() - sessionStartRef.current) / 1000);
      if (duration > 60) { // Only log sessions longer than 1 minute
        setDoc(doc(collection(db, 'users', user.uid, 'sessions')), {
          uid: user.uid,
          startTime: new Date(sessionStartRef.current),
          duration,
          warnings,
          baseline,
          createdAt: serverTimestamp()
        });
      }
      sessionStartRef.current = null;
    }
  }, [pomodoroState, user, warnings, baseline]);
  const [activeMission, setActiveMission] = useState<Mission | null>(null);
  const [isMissionVerified, setIsMissionVerified] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [activeTab, setActiveTab] = useState<'camera' | 'stats' | 'control'>('camera');

  const [hasStarted, setHasStarted] = useState(false);
  const [showHome, setShowHome] = useState(true);
  const hasStartedRef = useRef(false);
  
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Fetch user profile from Firestore
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          if (data.baseline) {
            setBaseline(data.baseline);
            setIsInitialSetup(false);
          } else {
            setIsInitialSetup(true);
          }
        } else {
          // New user
          setIsInitialSetup(true);
          await setDoc(doc(db, 'users', currentUser.uid), {
            uid: currentUser.uid,
            email: currentUser.email,
            displayName: currentUser.displayName,
            photoURL: currentUser.photoURL,
            createdAt: serverTimestamp()
          });
        }
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setBaseline(undefined);
    setHasStarted(false);
    setShowHome(true);
  };

  useEffect(() => {
    hasStartedRef.current = hasStarted;
  }, [hasStarted]);

  // Update clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const statusRef = useRef<PostureStatus>(status);
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const handlePostureChange = useCallback((results: any) => {
    if (!hasStartedRef.current) return;
    const data = analyzePosture(results, baseline);
    setPosData(data);
    
    if (data) {
      const newStatus = data.score < 70 ? 'bad' : data.score < 90 ? 'warning' : 'good';
      if (newStatus !== statusRef.current) setStatus(newStatus);

      // Verify Active Mission
      if (activeMission && !isMissionVerified && data.gestures) {
        const target = activeMission.targetGesture;
        if (target && data.gestures[target]) {
          setIsMissionVerified(true);
        }
      }
    }
  }, [activeMission, isMissionVerified, baseline]);

  const { 
    videoRef, 
    canvasRef, 
    isReady, 
    hasFrames, 
    isCalibrating, 
    calibrationCountdown, 
    baselineHeight,
    cameraError,
    startCalibration 
  } = usePoseDetection(handlePostureChange);

  // Sync baseline from hook to App state
  useEffect(() => {
    if (baselineHeight) {
      setBaseline(baselineHeight);
      
      // Save to Firebase if user is logged in
      if (user) {
        updateDoc(doc(db, 'users', user.uid), {
          baseline: baselineHeight,
          updatedAt: serverTimestamp()
        }).then(() => {
          setIsInitialSetup(false);
        });
      }
    }
  }, [baselineHeight, user]);

  // Warning Accumulation Logic: 3 seconds of continuous bad posture
  const badPostureTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    if (status === 'bad' && pomodoroState === 'work' && !activeMission) {
      if (!badPostureTimerRef.current) {
        console.log(`Started ${POSTURE_THRESHOLDS.BAD_POSTURE_DURATION_MS}ms bad posture timer`);
        badPostureTimerRef.current = setTimeout(() => {
          triggerMission();
          badPostureTimerRef.current = null;
        }, POSTURE_THRESHOLDS.BAD_POSTURE_DURATION_MS);
      }
    } else {
      if (badPostureTimerRef.current) {
        console.log("Posture fixed or status changed, clearing timer");
        clearTimeout(badPostureTimerRef.current);
        badPostureTimerRef.current = null;
      }
    }
    return () => {
      if (badPostureTimerRef.current) clearTimeout(badPostureTimerRef.current);
    };
  }, [status, pomodoroState, activeMission]);

  const triggerMission = () => {
    const randomMission = MISSIONS[Math.floor(Math.random() * MISSIONS.length)];
    setActiveMission({ ...randomMission, completed: false });
    setIsMissionVerified(false);
    setPomodoroState('mission');
    setWarnings(prev => prev + 1);
  };

  const completeMission = () => {
    setActiveMission(null);
    setIsMissionVerified(false);
    setPomodoroState('work');
    setWarnings(0);
  };

  if (loading) {
    return (
      <div className="h-screen w-full bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center">
          <Activity className="w-12 h-12 text-indigo-600 animate-pulse mb-4" />
          <p className="text-white/40 text-xs font-black uppercase tracking-[0.3em]">시스템 로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-slate-50 font-sans text-slate-900 overflow-hidden flex-col">
      {/* Header - Hidden in immersive mode to focus on camera */}
      <AnimatePresence>
        {!hasStarted && (
          <motion.header 
            initial={{ y: -100 }} 
            animate={{ y: 0 }} 
            exit={{ y: -100 }}
            className="h-16 px-8 bg-white border-b border-slate-200 flex items-center justify-between shrink-0 z-20"
          >
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-100">
                <Activity className="h-5 w-5" />
              </div>
              <span className="text-xl font-black tracking-tight text-slate-800">포스처펄스 <span className="text-indigo-500 font-bold">EDU</span></span>
            </div>
            
            <nav className="hidden lg:flex items-center space-x-10 text-[13px] font-bold text-slate-400 uppercase tracking-widest">
              <button className="text-indigo-600 border-b-2 border-indigo-600 h-16 flex items-center transition-all">대시보드</button>
              <button className="hover:text-slate-600 transition-colors h-16 flex items-center">분석</button>
              <button className="hover:text-slate-600 transition-colors h-16 flex items-center">루틴</button>
              <button className="hover:text-slate-600 transition-colors h-16 flex items-center">설정</button>
            </nav>

            <div className="flex items-center space-x-6">
              <div className="text-right hidden sm:block">
                <p className="text-[9px] text-slate-400 font-black uppercase tracking-[0.2em]">오늘의 진행률</p>
                <p className="text-sm font-black text-slate-700">4시간 목표의 74%</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-slate-100 border-2 border-white shadow-sm overflow-hidden flex items-center justify-center">
                <UserIcon className="w-5 h-5 text-slate-400" />
              </div>
            </div>
          </motion.header>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        
        {/* Entry Portal / Home Screen */}
        <AnimatePresence>
          {(showHome || !user) && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, scale: 1.1, filter: 'blur(10px)' }}
              className="absolute inset-0 z-[100] bg-slate-950 flex items-center justify-center p-6 overflow-y-auto"
            >
              <div className="max-w-4xl w-full flex flex-col items-center">
                <motion.div 
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.1 }}
                  className="text-center mb-12"
                >
                  <div className="w-20 h-20 bg-indigo-600 rounded-[2rem] flex items-center justify-center text-white mx-auto mb-6 shadow-2xl shadow-indigo-500/40">
                    <Activity className="w-10 h-10" />
                  </div>
                  <h1 className="text-4xl md:text-5xl font-black text-white tracking-tighter italic mb-4 leading-none">포스처가드 AI</h1>
                  <p className="text-indigo-200/40 text-xs font-black uppercase tracking-[0.3em]">인공지능 건강 모니터링 시스템</p>
                </motion.div>

                {!user ? (
                  <motion.div 
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="bg-slate-900 border-2 border-white/5 p-12 rounded-[3rem] text-center w-full max-w-md shadow-2xl"
                  >
                    <h2 className="text-2xl font-black text-white mb-2 italic">시작하기</h2>
                    <p className="text-slate-400 text-sm mb-8 font-medium">자세 데이터를 저장하고 맞춤형 코칭을 받으려면 로그인하세요.</p>
                    <button 
                      onClick={handleLogin}
                      className="w-full py-5 bg-white text-slate-900 font-black rounded-2xl text-sm uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-indigo-50 transition-all active:scale-95"
                    >
                      <UserIcon className="w-5 h-5" />
                      Google 계정으로 로그인
                    </button>
                  </motion.div>
                ) : isInitialSetup ? (
                  <motion.div 
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="bg-slate-900 border-2 border-white/5 p-10 rounded-[3rem] text-center w-full max-w-2xl shadow-2xl"
                  >
                    <div className="w-16 h-16 bg-amber-500/20 rounded-2xl flex items-center justify-center text-amber-500 mx-auto mb-6">
                      <ShieldCheck className="w-8 h-8" />
                    </div>
                    <h2 className="text-3xl font-black text-white mb-4 italic">최초 자세 보정 (1분)</h2>
                    <p className="text-slate-400 text-sm mb-8 font-medium leading-relaxed">
                      안녕하세요, {user.displayName}님! 정확한 분석을 위해 1분 동안 바른 자세로 앉아주세요.<br />
                      이 데이터는 당신의 기준 자세가 되어 실시간 모니터링에 사용됩니다.
                    </p>
                    
                    <button 
                      onClick={() => {
                        setShowHome(false);
                        setHasStarted(true);
                        setActiveTab('camera');
                        startCalibration(60); // 1 minute calibration
                      }}
                      className="w-full py-6 bg-indigo-600 text-white font-black rounded-2xl text-sm uppercase tracking-widest shadow-xl shadow-indigo-500/20 hover:bg-indigo-500 transition-all active:scale-95 mb-4"
                    >
                      1분 보정 시작하기
                    </button>
                    
                    <button onClick={handleLogout} className="text-slate-500 text-xs font-bold uppercase tracking-widest hover:text-slate-400">로그아웃</button>
                  </motion.div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full">
                    {/* Path A: Camera / Vision */}
                    <motion.button 
                      initial={{ x: -20, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      transition={{ delay: 0.2 }}
                      onClick={() => {
                        setShowHome(false);
                        setHasStarted(true);
                        setActiveTab('camera');
                        setStatus('good');
                        startCalibration(5); // Quick recalibration
                      }}
                      className="group bg-slate-900 border-2 border-white/5 p-8 rounded-[3rem] text-left hover:border-indigo-500/50 transition-all active:scale-95 shadow-2xl"
                    >
                      <div className="w-14 h-14 bg-indigo-500/20 rounded-2xl flex items-center justify-center text-indigo-400 mb-6 group-hover:bg-indigo-500 group-hover:text-white transition-colors">
                        <Camera className="w-7 h-7" />
                      </div>
                      <h3 className="text-2xl font-black text-white tracking-tight italic mb-2">AI 비전 가드</h3>
                      <p className="text-slate-400 text-sm font-medium leading-relaxed">실시간 신체 스캔 및 자세 교정 알람을 시작합니다.</p>
                    </motion.button>

                    {/* Path B: Analysis / Metrics */}
                    <motion.button 
                      initial={{ x: 20, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      transition={{ delay: 0.3 }}
                      onClick={() => {
                        setShowHome(false);
                        setHasStarted(true);
                        setActiveTab('stats');
                      }}
                      className="group bg-slate-900 border-2 border-white/5 p-8 rounded-[3rem] text-left hover:border-emerald-500/50 transition-all active:scale-95 shadow-2xl"
                    >
                      <div className="w-14 h-14 bg-emerald-500/20 rounded-2xl flex items-center justify-center text-emerald-400 mb-6 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                        <BarChart3 className="w-7 h-7" />
                      </div>
                      <h3 className="text-2xl font-black text-white tracking-tight italic mb-2">신체 통계</h3>
                      <p className="text-slate-400 text-sm font-medium leading-relaxed">자세 일관성과 성과 분석 데이터를 확인합니다.</p>
                    </motion.button>

                    <div className="col-span-1 md:col-span-2 flex flex-col items-center">
                      <motion.div 
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.4 }}
                        className="text-center mt-4 mb-4 text-[10px] font-black uppercase tracking-widest text-slate-600"
                      >
                        시스템 체크: 모든 AI 센서 정상 작동 중
                      </motion.div>
                      <button onClick={handleLogout} className="text-slate-500 text-xs font-bold uppercase tracking-widest hover:text-slate-400">로그아웃</button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Dynamic Focus Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden p-4 md:p-6 pb-24 md:pb-28">
          
          <AnimatePresence mode="wait">
            {/* Camera / Vision Tab */}
            {(activeTab === 'camera' || !hasStarted) && (
              <motion.div 
                key="camera"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="flex-1 bg-slate-900 rounded-[2rem] md:rounded-[3rem] relative overflow-hidden shadow-2xl border-2 md:border-4 border-white"
              >
                <PostureMonitor 
                  status={status} 
                  videoRef={videoRef}
                  canvasRef={canvasRef}
                  isReady={isReady}
                  hasFrames={hasFrames}
                  isCalibrating={isCalibrating}
                  calibrationCountdown={calibrationCountdown}
                  cameraError={cameraError}
                  onCalibrate={() => startCalibration()}
              />

              <div className="absolute top-6 left-6 md:top-10 md:left-10 flex space-x-3 z-10">
                <div className={cn(
                  "backdrop-blur-xl border px-4 py-2 md:px-6 md:py-3 rounded-2xl flex items-center space-x-3 transition-all duration-700",
                  status === 'good' ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" :
                  status === 'bad' ? "bg-rose-500/10 border-rose-500/30 text-rose-400" :
                  "bg-slate-800/40 border-slate-700/40 text-slate-300"
                )}>
                  <div className={cn(
                    "w-2.5 h-2.5 rounded-full",
                    status === 'good' ? "bg-emerald-500 animate-pulse" : status === 'bad' ? "bg-rose-500 animate-bounce" : "bg-slate-500"
                  )} />
                  <span className="text-[10px] md:text-xs font-black uppercase tracking-[0.15em]">
                    {posData?.description || (status === 'calibrating' ? '보정 중' : '시스템 대기 중')}
                  </span>
                </div>
              </div>

                {status === 'bad' && !activeMission && (
                  <div className="absolute bottom-10 left-10 right-10 z-10 hidden md:block">
                    <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-indigo-600 rounded-[2rem] p-6 flex items-center justify-between shadow-2xl">
                      <div className="flex items-center space-x-4 text-white">
                        <AlertCircle className="w-8 h-8" />
                        <div>
                          <p className="font-black text-xl italic leading-none">자세 불량 감지</p>
                          <p className="text-[10px] opacity-70 uppercase font-bold tracking-[0.2em] mt-1.5">자세를 바로잡기 위한 스트레칭 미션이 권장됩니다.</p>
                        </div>
                      </div>
                      <button onClick={triggerMission} className="px-8 py-4 bg-white text-indigo-600 font-black rounded-2xl text-[11px] uppercase tracking-[0.2em] hover:bg-slate-50">시작하기</button>
                    </motion.div>
                  </div>
                )}

                <AnimatePresence>
                  {activeMission && (
                    <MissionOverlay 
                      mission={activeMission} 
                      isVerified={isMissionVerified}
                      onComplete={completeMission} 
                    />
                  )}
                </AnimatePresence>
              </motion.div>
            )}

            {/* Timer Tab */}
            {hasStarted && activeTab === 'control' && (
              <motion.div 
                key="timer" 
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
                className="flex-1 flex flex-col justify-center items-center space-y-8"
              >
                <div className="w-full max-w-xl">
                  <PomodoroControl state={pomodoroState} onChangeState={setPomodoroState} warnings={warnings} />
                </div>
              </motion.div>
            )}

            {/* Stats Tab */}
            {hasStarted && activeTab === 'stats' && (
              <motion.div 
                key="stats" 
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
                className="flex-1 flex flex-col space-y-6 max-w-4xl mx-auto w-full overflow-y-auto custom-scrollbar"
              >
                <div className="bg-indigo-600 rounded-[3rem] p-10 text-white shadow-2xl flex flex-col justify-between min-h-[250px]">
                  <div className="flex justify-between items-start">
                    <span className="text-[11px] font-black tracking-[0.2em] opacity-70 uppercase">일일 자세 리포트</span>
                    <div className="bg-white/20 px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border border-white/20 italic">
                      AI 실시간 분석 진행 중
                    </div>
                  </div>
                  <div className="mt-6 flex items-end justify-between">
                    <div>
                      <span className="text-7xl md:text-8xl font-black tracking-tighter italic leading-none block">
                        {posData?.description || "대기 중"}
                      </span>
                      <span className="text-[12px] font-black uppercase tracking-[0.2em] opacity-40 italic mt-4 block">
                        현재 신체 상태 지표
                      </span>
                    </div>
                    <div className="text-right">
                      <p className="text-5xl font-black italic tracking-tighter">{warnings}</p>
                      <p className="text-[9px] font-black uppercase tracking-widest opacity-50">오늘의 경고</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-[3rem] p-10 shadow-sm border border-slate-200 flex flex-col flex-1 min-h-[400px]">
                  <div className="flex items-center justify-between mb-10">
                    <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">생체 데이터 분석 트렌드</h3>
                    <BarChart3 className="w-6 h-6 text-indigo-500 opacity-20" />
                  </div>
                  <StatsOverview />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Global Navigation Dock (Floating) */}
        {hasStarted && (
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 w-[98%] max-w-xl bg-slate-900/90 backdrop-blur-2xl border border-white/10 h-20 rounded-[2.5rem] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] flex items-center justify-around px-6 z-[60]">
            <button 
              onClick={() => {
                setShowHome(true);
                setHasStarted(false);
              }}
              className="flex flex-col items-center justify-center space-y-1.5 transition-all duration-300 w-16 text-white/40 hover:text-white/70"
            >
              <Home className="w-6 h-6" />
              <span className="text-[9px] font-black uppercase tracking-[0.15em]">홈</span>
            </button>
            <div className="w-px h-6 bg-white/10 mx-1" />
            <button 
              onClick={() => setActiveTab('camera')}
              className={cn(
                "flex flex-col items-center justify-center space-y-1.5 transition-all duration-300 w-16",
                activeTab === 'camera' ? "text-indigo-400 scale-110" : "text-white/40 hover:text-white/70"
              )}
            >
              <Camera className={cn("w-6 h-6 transition-transform", activeTab === 'camera' && "animate-pulse")} />
              <span className="text-[9px] font-black uppercase tracking-[0.15em]">비전</span>
            </button>
            <button 
              onClick={() => setActiveTab('control')}
              className={cn(
                "flex flex-col items-center justify-center space-y-1.5 transition-all duration-300 w-16",
                activeTab === 'control' ? "text-indigo-400 scale-110" : "text-white/40 hover:text-white/70"
              )}
            >
              <Activity className="w-6 h-6" />
              <span className="text-[9px] font-black uppercase tracking-[0.15em]">타이머</span>
            </button>
            <button 
              onClick={() => setActiveTab('stats')}
              className={cn(
                "flex flex-col items-center justify-center space-y-1.5 transition-all duration-300 w-16",
                activeTab === 'stats' ? "text-indigo-400 scale-110" : "text-white/40 hover:text-white/70"
              )}
            >
              <BarChart3 className="w-6 h-6" />
              <span className="text-[9px] font-black uppercase tracking-[0.15em]">분석</span>
            </button>
            <div className="w-px h-8 bg-white/10 mx-2" />
            <button 
              onClick={triggerMission}
              className="flex flex-col items-center justify-center space-y-1.5 text-rose-400 hover:text-rose-300 active:scale-110 transition-all duration-300 w-16"
            >
              <Trophy className="w-6 h-6" />
              <span className="text-[9px] font-black uppercase tracking-[0.15em]">미션</span>
            </button>
          </div>
        )}
      </main>

      {/* Footer - Hidden in immersive mode */}
      <AnimatePresence>
        {!hasStarted && (
          <motion.footer 
            initial={{ y: 100 }} 
            animate={{ y: 0 }} 
            exit={{ y: 100 }}
            className="h-14 px-10 bg-slate-900 text-white flex items-center justify-between text-[11px] font-black tracking-widest shrink-0"
          >
            <div className="flex items-center space-x-14 uppercase">
              <span className="flex items-center space-x-3">
                 <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse shadow-[0_0_10px_#6366f1]" />
                 <span>AI 엔진: 활성</span>
              </span>
              <span className="text-slate-500">처리 지연 시간: 12ms</span>
            </div>
            <div className="text-indigo-400/60 uppercase">{currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
          </motion.footer>
        )}
      </AnimatePresence>
    </div>
  );
}
