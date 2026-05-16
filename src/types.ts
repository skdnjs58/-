export type PostureStatus = 'good' | 'bad' | 'warning' | 'calibrating' | 'off';

export interface PostureData {
  shoulderAngle: number;
  neckForwardness: number; // Distance or angle between ear and shoulder
  eyeAlignment: number;
  isSlumped: boolean;
  score: number;
  description: string;
  gestures: {
    armsUp: boolean;
    armsWide: boolean;
    neckStretchLeft: boolean;
    neckStretchRight: boolean;
  };
}

export interface StudySession {
  id: string;
  startTime: number;
  endTime: number;
  duration: number; // in seconds
  goodPostureDuration: number; // in seconds
  score: number; // 0-100
}

export interface DailyStats {
  date: string; // YYYY-MM-DD
  totalStudyTime: number;
  avgScore: number;
  sessions: StudySession[];
}

export interface Mission {
  id: 'stretch_neck' | 'roll_shoulders' | 'raise_arms';
  label: string;
  instruction: string;
  completed: boolean;
  targetGesture?: keyof PostureData['gestures'];
}

export type PomodoroState = 'idle' | 'work' | 'break' | 'mission';
