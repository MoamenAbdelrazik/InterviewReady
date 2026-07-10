/**
 * ═══════════════════════════════════════════════════════════════════
 * BehaviorData — ML-ready 3-level behavioral telemetry payload.
 * Schema defined in new_feature.md (Webcam Behavior Analysis Spec).
 * Produced by ProctorService.generateBehaviorData().
 * Consumed by Report charts + LLM narrative generation.
 * ═══════════════════════════════════════════════════════════════════
 */
export interface BehaviorData {
  // ─── SESSION METADATA ───
  sessionDurationSec: number;
  totalFrames:        number;
  fps:                number;       // always 5
  windowSizeSec:      number;

  // ─── LEVEL A: SESSION AGGREGATION ───
  cameraHealth: {
    cameraCoveredPct:       number;
    cameraCoveredEvents:    number;
    maxCameraCoveredSec:    number;
  };

  facePresence: {
    faceMissingPct:         number;
    faceMissingEvents:      number;
    maxFaceMissingSec:      number;
  };

  attention: {
    eyesClosedPct:          number;
    lookingAwaySidePct:     number;
    lookingDownPct:         number;
    lookingUpPct:           number;
    attentionScore:         number;   // 0.0–1.0
  };

  headBehavior: {
    avgYaw:                 number;
    avgPitch:               number;
    avgRoll:                number;
    yawVariance:            number;   // → ch9 Yaw axis
    pitchVariance:          number;   // → ch9 Pitch axis
    rollVariance:           number;   // → ch9 Roll axis
    movementStability:      number;
    irregularMovementScore: number;
  };

  expressions: {                      // → donut chart
    neutral:   number;
    happy:     number;
    sad:       number;
    angry:     number;
    fearful:   number;
    disgusted: number;
    surprised: number;
  };

  behaviorEvents: {                   // → ch8 (Suspicious Events bar chart)
    suspiciousLookingEvents: number;
    faceLossEvents:          number;
    longEyeClosureEvents:   number;
    cameraCoveredEvents:     number;
  };

  riskFeatures: {
    maxContinuousLookingAwaySec: number;
    maxContinuousFaceMissingSec: number;
    maxContinuousEyeClosedSec:  number;
    irregularMovementScore:     number;
    rapidGazeSwitchCount:       number;
  };

  // ─── LEVEL B: TIME-WINDOW AGGREGATION ───
  // Feeds: ch1 Behavior Timeline, ch7 Attention Profile, ch13 Emotion–Accuracy
  timeWindows: TimeWindow[];

  // ─── LEVEL C: PER-QUESTION BEHAVIORAL EVENTS ───
  // Feeds: ch14 Proctoring Timeline scatter
  perQuestionBehavior: PerQuestionBehavior[];

  // ─── CHEATING ANALYSIS ───
  cheatingAnalysis: CheatingAnalysis;
}

/**
 * Time-window aggregation (~14 windows per session).
 * Each window covers windowSizeSec seconds.
 */
export interface TimeWindow {
  windowIndex:      number;
  startSec:         number;
  endSec:           number;
  framesInWindow:   number;

  expressions: {                      // → ch1 (each emotion as 0–100%)
    neutral:   number;
    happy:     number;
    fearful:   number;
    surprised: number;
    sad:       number;
    angry:     number;
  };

  gazeOnScreenPct:  number;           // → ch7 Gaze on Screen line
  facePresencePct:  number;           // → ch7 Face Presence line
  eyeClosurePct:    number;           // → ch7 Eye Closure line

  stressIndex:      number;           // → ch13 red area
  accuracyPct:      number;           // → ch13 green line (cross-source)

  questionsActive:  number[];         // which Q IDs were active during this window
}

/**
 * Per-question behavioral snapshot (one per question).
 * Tracks which behavioral events occurred while each question was active.
 */
export interface PerQuestionBehavior {
  questionId:            number;
  gazeBreaks:            number;      // → ch14 "Gaze Break" dots
  eyeCloseEvents:        number;      // → ch14 "Eye Close" dots
  tabSwitches:           number;      // → ch14 "Tab Switch" dots
  copyAttempts:          number;      // → ch14 "Copy Attempt" dots
  pasteAttempts:         number;      // → ch14 "Paste Attempt" dots
  cameraCoveredEvents:   number;
  stressIndex:           number;      // per-Q stress for future ML use
  dominantEmotion:       string;      // most frequent expression on this Q
  timeOnQuestionSec:     number;
  viewCount:             number;      // how many times candidate visited this question
}

/**
 * 8-signal weighted cheating probability.
 */
export interface CheatingAnalysis {
  cheatingProbability:   number;      // 0.0–1.0 composite score
  cheatingTier:          string;      // "LOW" | "MODERATE" | "HIGH" | "CRITICAL"
  signals: {
    tabSwitchSignal:          number; // 0–1, saturates at 5 switches
    gazeDeviationSignal:      number; // 0–1, saturates at 15% side-gaze
    faceAbsenceSignal:        number; // 0–1, saturates at 10% missing
    cameraCoverSignal:        number; // 0–1, saturates at 5% covered
    rapidGazeSwitchSignal:    number; // 0–1, saturates at 8 rapid switches
    irregularMovementSignal:  number; // 0–1, jerk-based
    copyPasteSignal:          number; // 0–1, saturates at 3 attempts
    multiTabSignal:           number; // binary 0 or 1
  };
  weights:               string;      // human-readable weight formula
  llmNote:               string;      // guidance for LLM interpretation
}
