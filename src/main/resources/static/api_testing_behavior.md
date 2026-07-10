
## Step 2 — Behavioral Analysis

### POST `/api/llm/behavior`
**Content-Type:** `application/json`

> **Schema source:** `new_feature.md` §3 — Final Model JSON (3-level aggregation + cheating analysis)

```json
{
  "sessionDurationSec": 2847,
  "totalFrames": 14235,
  "fps": 5,
  "windowSizeSec": 204,

  "cameraHealth": {
    "cameraCoveredPct": 0.003,
    "cameraCoveredEvents": 1,
    "maxCameraCoveredSec": 1.8
  },

  "facePresence": {
    "faceMissingPct": 0.042,
    "faceMissingEvents": 8,
    "maxFaceMissingSec": 4.2
  },

  "attention": {
    "eyesClosedPct": 0.058,
    "lookingAwaySidePct": 0.081,
    "lookingDownPct": 0.12,
    "lookingUpPct": 0.034,
    "attentionScore": 0.78
  },

  "headBehavior": {
    "avgYaw": -2.3,
    "avgPitch": 8.1,
    "avgRoll": 0.7,
    "yawVariance": 48.6,
    "pitchVariance": 22.4,
    "rollVariance": 5.8,
    "movementStability": 0.69,
    "irregularMovementScore": 0.18
  },

  "expressions": {
    "neutral": 0.52,
    "happy": 0.07,
    "sad": 0.05,
    "angry": 0.02,
    "fearful": 0.14,
    "disgusted": 0.01,
    "surprised": 0.19
  },

  "behaviorEvents": {
    "suspiciousLookingEvents": 12,
    "faceLossEvents": 8,
    "longEyeClosureEvents": 3,
    "cameraCoveredEvents": 1
  },

  "riskFeatures": {
    "maxContinuousLookingAwaySec": 3.6,
    "maxContinuousFaceMissingSec": 4.2,
    "maxContinuousEyeClosedSec": 2.4,
    "irregularMovementScore": 0.18,
    "rapidGazeSwitchCount": 4
  },

  "timeWindows": [
    {
      "windowIndex": 0, "startSec": 0, "endSec": 204, "framesInWindow": 1020,
      "expressions": { "neutral": 68.2, "happy": 8.4, "fearful": 5.1, "surprised": 12.0, "sad": 3.2, "angry": 1.1 },
      "gazeOnScreenPct": 94.1, "facePresencePct": 98.7, "eyeClosurePct": 2.8,
      "stressIndex": 12.4, "accuracyPct": 100.0,
      "questionsActive": [0, 1]
    },
    {
      "windowIndex": 1, "startSec": 204, "endSec": 408, "framesInWindow": 1020,
      "expressions": { "neutral": 62.0, "happy": 7.1, "fearful": 8.3, "surprised": 14.5, "sad": 4.1, "angry": 1.5 },
      "gazeOnScreenPct": 91.2, "facePresencePct": 97.4, "eyeClosurePct": 3.5,
      "stressIndex": 18.7, "accuracyPct": 100.0,
      "questionsActive": [1, 2, 3]
    },
    {
      "windowIndex": 2, "startSec": 408, "endSec": 612, "framesInWindow": 1020,
      "expressions": { "neutral": 55.8, "happy": 6.0, "fearful": 11.4, "surprised": 16.2, "sad": 5.8, "angry": 2.0 },
      "gazeOnScreenPct": 87.5, "facePresencePct": 96.1, "eyeClosurePct": 4.2,
      "stressIndex": 24.1, "accuracyPct": 75.0,
      "questionsActive": [3, 4]
    },
    {
      "windowIndex": 3, "startSec": 612, "endSec": 816, "framesInWindow": 1020,
      "expressions": { "neutral": 48.3, "happy": 4.5, "fearful": 16.8, "surprised": 18.0, "sad": 6.9, "angry": 2.8 },
      "gazeOnScreenPct": 82.4, "facePresencePct": 94.8, "eyeClosurePct": 5.1,
      "stressIndex": 34.6, "accuracyPct": 50.0,
      "questionsActive": [4, 5, 6]
    },
    {
      "windowIndex": 4, "startSec": 816, "endSec": 1020, "framesInWindow": 1020,
      "expressions": { "neutral": 42.1, "happy": 3.8, "fearful": 21.2, "surprised": 19.4, "sad": 7.5, "angry": 3.2 },
      "gazeOnScreenPct": 78.6, "facePresencePct": 93.2, "eyeClosurePct": 6.0,
      "stressIndex": 42.8, "accuracyPct": 50.0,
      "questionsActive": [6, 7]
    },
    {
      "windowIndex": 5, "startSec": 1020, "endSec": 1224, "framesInWindow": 1020,
      "expressions": { "neutral": 38.5, "happy": 3.2, "fearful": 24.6, "surprised": 20.1, "sad": 8.0, "angry": 3.5 },
      "gazeOnScreenPct": 76.1, "facePresencePct": 92.0, "eyeClosurePct": 6.8,
      "stressIndex": 48.2, "accuracyPct": 0.0,
      "questionsActive": [7, 8]
    },
    {
      "windowIndex": 6, "startSec": 1224, "endSec": 1428, "framesInWindow": 1020,
      "expressions": { "neutral": 35.0, "happy": 2.8, "fearful": 26.1, "surprised": 22.3, "sad": 8.4, "angry": 3.8 },
      "gazeOnScreenPct": 74.2, "facePresencePct": 91.5, "eyeClosurePct": 7.2,
      "stressIndex": 52.0, "accuracyPct": 0.0,
      "questionsActive": [8, 9]
    },
    {
      "windowIndex": 7, "startSec": 1428, "endSec": 1632, "framesInWindow": 1020,
      "expressions": { "neutral": 45.0, "happy": 5.0, "fearful": 18.0, "surprised": 16.5, "sad": 6.5, "angry": 2.5 },
      "gazeOnScreenPct": 80.3, "facePresencePct": 94.0, "eyeClosurePct": 5.5,
      "stressIndex": 38.1, "accuracyPct": null,
      "questionsActive": [10]
    },
    {
      "windowIndex": 8, "startSec": 1632, "endSec": 1836, "framesInWindow": 1020,
      "expressions": { "neutral": 50.2, "happy": 6.1, "fearful": 15.2, "surprised": 14.8, "sad": 5.4, "angry": 2.1 },
      "gazeOnScreenPct": 83.5, "facePresencePct": 95.2, "eyeClosurePct": 4.8,
      "stressIndex": 30.4, "accuracyPct": null,
      "questionsActive": [10]
    },
    {
      "windowIndex": 9, "startSec": 1836, "endSec": 2040, "framesInWindow": 1020,
      "expressions": { "neutral": 40.0, "happy": 3.5, "fearful": 22.0, "surprised": 21.0, "sad": 7.8, "angry": 3.0 },
      "gazeOnScreenPct": 77.0, "facePresencePct": 92.5, "eyeClosurePct": 6.3,
      "stressIndex": 45.5, "accuracyPct": null,
      "questionsActive": [11]
    },
    {
      "windowIndex": 10, "startSec": 2040, "endSec": 2244, "framesInWindow": 1020,
      "expressions": { "neutral": 37.0, "happy": 2.9, "fearful": 25.0, "surprised": 22.0, "sad": 8.2, "angry": 3.6 },
      "gazeOnScreenPct": 74.8, "facePresencePct": 91.8, "eyeClosurePct": 7.0,
      "stressIndex": 50.8, "accuracyPct": null,
      "questionsActive": [11]
    },
    {
      "windowIndex": 11, "startSec": 2244, "endSec": 2448, "framesInWindow": 1020,
      "expressions": { "neutral": 42.5, "happy": 4.0, "fearful": 20.5, "surprised": 18.5, "sad": 7.0, "angry": 2.8 },
      "gazeOnScreenPct": 79.5, "facePresencePct": 93.5, "eyeClosurePct": 5.8,
      "stressIndex": 40.2, "accuracyPct": null,
      "questionsActive": [11]
    },
    {
      "windowIndex": 12, "startSec": 2448, "endSec": 2652, "framesInWindow": 1020,
      "expressions": { "neutral": 46.0, "happy": 5.2, "fearful": 17.0, "surprised": 16.0, "sad": 6.2, "angry": 2.3 },
      "gazeOnScreenPct": 81.0, "facePresencePct": 94.5, "eyeClosurePct": 5.0,
      "stressIndex": 35.0, "accuracyPct": null,
      "questionsActive": [11]
    },
    {
      "windowIndex": 13, "startSec": 2652, "endSec": 2847, "framesInWindow": 975,
      "expressions": { "neutral": 48.5, "happy": 5.5, "fearful": 15.5, "surprised": 15.0, "sad": 5.8, "angry": 2.0 },
      "gazeOnScreenPct": 82.5, "facePresencePct": 95.0, "eyeClosurePct": 4.5,
      "stressIndex": 31.2, "accuracyPct": null,
      "questionsActive": [11]
    }
  ],

  "perQuestionBehavior": [
    { "questionId": 0, "gazeBreaks": 0, "eyeCloseEvents": 0, "tabSwitches": 0, "copyAttempts": 0, "pasteAttempts": 0, "cameraCoveredEvents": 0, "stressIndex": 10.2, "dominantEmotion": "neutral", "timeOnQuestionSec": 22 },
    { "questionId": 1, "gazeBreaks": 0, "eyeCloseEvents": 0, "tabSwitches": 0, "copyAttempts": 0, "pasteAttempts": 0, "cameraCoveredEvents": 0, "stressIndex": 11.5, "dominantEmotion": "neutral", "timeOnQuestionSec": 18 },
    { "questionId": 2, "gazeBreaks": 1, "eyeCloseEvents": 0, "tabSwitches": 0, "copyAttempts": 0, "pasteAttempts": 0, "cameraCoveredEvents": 0, "stressIndex": 15.8, "dominantEmotion": "neutral", "timeOnQuestionSec": 25 },
    { "questionId": 3, "gazeBreaks": 1, "eyeCloseEvents": 0, "tabSwitches": 0, "copyAttempts": 0, "pasteAttempts": 0, "cameraCoveredEvents": 0, "stressIndex": 18.2, "dominantEmotion": "neutral", "timeOnQuestionSec": 28 },
    { "questionId": 4, "gazeBreaks": 2, "eyeCloseEvents": 0, "tabSwitches": 0, "copyAttempts": 0, "pasteAttempts": 0, "cameraCoveredEvents": 0, "stressIndex": 25.4, "dominantEmotion": "neutral", "timeOnQuestionSec": 48 },
    { "questionId": 5, "gazeBreaks": 2, "eyeCloseEvents": 1, "tabSwitches": 1, "copyAttempts": 0, "pasteAttempts": 0, "cameraCoveredEvents": 0, "stressIndex": 38.5, "dominantEmotion": "fearful", "timeOnQuestionSec": 55 },
    { "questionId": 6, "gazeBreaks": 1, "eyeCloseEvents": 0, "tabSwitches": 0, "copyAttempts": 0, "pasteAttempts": 0, "cameraCoveredEvents": 0, "stressIndex": 30.2, "dominantEmotion": "neutral", "timeOnQuestionSec": 52 },
    { "questionId": 7, "gazeBreaks": 2, "eyeCloseEvents": 1, "tabSwitches": 1, "copyAttempts": 0, "pasteAttempts": 0, "cameraCoveredEvents": 0, "stressIndex": 42.1, "dominantEmotion": "fearful", "timeOnQuestionSec": 61 },
    { "questionId": 8, "gazeBreaks": 3, "eyeCloseEvents": 1, "tabSwitches": 2, "copyAttempts": 0, "pasteAttempts": 0, "cameraCoveredEvents": 0, "stressIndex": 55.3, "dominantEmotion": "fearful", "timeOnQuestionSec": 82 },
    { "questionId": 9, "gazeBreaks": 2, "eyeCloseEvents": 0, "tabSwitches": 1, "copyAttempts": 0, "pasteAttempts": 0, "cameraCoveredEvents": 0, "stressIndex": 48.0, "dominantEmotion": "surprised", "timeOnQuestionSec": 76 },
    { "questionId": 10, "gazeBreaks": 1, "eyeCloseEvents": 0, "tabSwitches": 3, "copyAttempts": 2, "pasteAttempts": 3, "cameraCoveredEvents": 0, "stressIndex": 32.5, "dominantEmotion": "neutral", "timeOnQuestionSec": 385 },
    { "questionId": 11, "gazeBreaks": 3, "eyeCloseEvents": 1, "tabSwitches": 5, "copyAttempts": 1, "pasteAttempts": 2, "cameraCoveredEvents": 1, "stressIndex": 45.0, "dominantEmotion": "fearful", "timeOnQuestionSec": 892 }
  ],

  "cheatingAnalysis": {
    "cheatingProbability": 0.31,
    "cheatingTier": "MODERATE",
    "signals": {
      "tabSwitchSignal": 0.52,
      "gazeDeviationSignal": 0.54,
      "faceAbsenceSignal": 0.42,
      "cameraCoverSignal": 0.06,
      "rapidGazeSwitchSignal": 0.50,
      "irregularMovementSignal": 0.18,
      "copyPasteSignal": 0.67,
      "multiTabSignal": 1.0
    },
    "weights": "0.20*tab + 0.18*gaze + 0.15*face + 0.12*camera + 0.12*rapidGaze + 0.08*irregular + 0.10*copyPaste + 0.05*multiTab",
    "llmNote": "Moderate risk. Tab switching and copy-paste concentrated during coding problems. Gaze instability increased during HARD MCQ questions."
  }
}
```

**Candidate Story:** Starts focused (Q0-Q3 EASY), gets progressively anxious during MEDIUM/HARD MCQs (Q5-Q9), stabilizes during coding (Q10) but cheating signals spike during HARD coding (Q11 — 5 tab switches, camera covered once).

**Expected Response:** `BehaviorAnalysisDTO` — ~15-20 sec.
