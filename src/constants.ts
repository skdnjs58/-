
export const COLORS = {
  primary: 'indigo-600',
  secondary: 'indigo-500',
  background: 'slate-50',
  surface: 'white',
  text: 'slate-900',
  muted: 'slate-400',
  warning: 'amber-500',
  danger: 'red-500',
  success: 'green-500'
};

export const MISSIONS = [
  { id: 'stretch_neck_left', label: '목 스트레칭 (좌)', instruction: '고개를 왼쪽으로 깊게 젖히세요.', completed: false, targetGesture: 'neckStretchLeft' },
  { id: 'stretch_neck_right', label: '목 스트레칭 (우)', instruction: '고개를 오른쪽으로 깊게 젖히세요.', completed: false, targetGesture: 'neckStretchRight' },
  { id: 'stretch_arms_up', label: '기지개 켜기', instruction: '양팔을 머리 위로 높이 드세요.', completed: false, targetGesture: 'armsUp' },
  { id: 'stretch_arms_wide', label: '가슴 펴기', instruction: '양팔을 옆으로 넓게 벌리세요.', completed: false, targetGesture: 'armsWide' }
];

export const POMODORO = {
  WORK: 25 * 60,
  BREAK: 5 * 60,
  WARNING_THRESHOLD: 5, // Warning count before forcing a mission
};

export const POSTURE_THRESHOLDS = {
  EMA_ALPHA: 0.2, // Smoothing factor (lower = smoother but slower)
  MIN_SHOULDER_WIDTH: 0.12, // For filtering side rotations
  BAD_POSTURE_DURATION_MS: 7000, // Duration to sustain bad posture before alert (7 seconds)
  VIBRATION_COOLDOWN_MS: 10000,
  BASELINE_FALLBACK: 0.7,
  SLUMP_FACTOR: 0.65, // More lenient: value < baseline * SLUMP_FACTOR = bad
  NECK_TENSION_FACTOR: 0.8,
  GOOD_POSTURE_FACTOR: 0.95,
};
