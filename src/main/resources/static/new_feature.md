# 🧾 Webcam Behavior Analysis System — Full Pipeline Spec

## 🎯 Objective

Build a real-time webcam proctoring system that:

1. Captures facial data **frame-by-frame** (~5 FPS)
2. Logs behavior in real time (console + internal buffers)
3. Aggregates metrics at **three levels**: session, time-window, and per-question
4. Outputs a **final ML-ready JSON** that feeds all report charts

---

## 📷 1. Frame-by-Frame JSON (RAW LAYER)

Every frame (~5 FPS), generate:

```jsonc
{
  "frame": number,
  "timestamp": number,           // Date.now()

  "cameraCovered": boolean,      // luminance < 10 threshold
  "faceDetected": boolean,

  "headPose": {
    "yaw": number,               // degrees, negative=left, positive=right
    "pitch": number,             // degrees, positive=down, negative=up
    "roll": number               // degrees, head tilt
  },

  "eyesOpen": boolean,           // EAR (Eye Aspect Ratio) >= 0.21

  "looking": {
    "isLookingSide": boolean,    // |yaw| > 25°
    "isLookingDown": boolean,    // pitch > 20°
    "isLookingUp": boolean       // pitch < -15°
  },

  "expressions": {
    "neutral": number,           // 0.0 – 1.0 confidence
    "happy": number,
    "sad": number,
    "angry": number,
    "fearful": number,
    "disgusted": number,
    "surprised": number
  },

  "statusFlags": {
    "faceMissing": boolean,
    "suspiciousYaw": boolean,    // |yaw| > 25°
    "eyesClosed": boolean        // EAR < 0.21
  }
}
```

### 🔧 Detection Heuristics

#### Eye Closure — EAR (Eye Aspect Ratio)
Uses the 6-point eye landmarks from face-api.js 68-landmark model:
```
EAR = (|p1 - p5| + |p2 - p4|) / (2 · |p0 - p3|)
```
- **Threshold:** `EAR < 0.21` → eyes closed (Soukupová & Čech, 2016)
- **Long closure:** EAR stays below 0.21 for ≥ 3 consecutive frames (~600ms at 5 FPS)

#### Head Pose — Derived from 68-Landmark Geometry
```
Yaw   = ((noseTip.x - jawMidX) / jawWidth) × 90°
Pitch = ((noseTip.y - eyeMidY) / faceHeight - 0.55) × 120°
Roll  = atan2(rightEyeCenter.y - leftEyeCenter.y, rightEyeCenter.x - leftEyeCenter.x) × (180/π)
```

#### Directional Gaze Thresholds

| Behavior       | Axis    | Threshold | Rationale                                |
| -------------- | ------- | --------- | ---------------------------------------- |
| Looking side   | \|yaw\| | > 25°     | ~0.35 nose-offset ratio                  |
| Looking down   | pitch   | > 20°     | Candidate reading phone/notes below      |
| Looking up     | pitch   | < -15°    | Candidate reading monitor above webcam   |

#### Camera Covered — Luminance Check
```
avgBrightness = Σ(R×0.299 + G×0.587 + B×0.114) / totalPixels
cameraCovered = avgBrightness < 10
```

---

## 📊 2. Aggregation Rules (Three Levels)

Let:
- `N` = total frames in scope (session, window, or question)
- `FPS` = 5

### Level A — Session Aggregation

#### 🔒 Camera Health
```
cameraCoveredPct       = cameraCoveredFrames / N
cameraCoveredEvents    = count of continuous covered episodes
maxCameraCoveredSec    = longest continuous covered episode / FPS
```

#### 👁️ Face Presence
```
faceMissingPct         = faceMissingFrames / N
faceMissingEvents      = count of continuous missing episodes
maxFaceMissingSec      = longest continuous missing episode / FPS
```

#### 👀 Attention Metrics
```
eyesClosedPct          = eyesClosedFrames / N
lookingAwaySidePct     = frames(|yaw| > 25°) / N
lookingDownPct         = frames(pitch > 20°) / N
lookingUpPct           = frames(pitch < -15°) / N
```

#### 🎯 Attention Score (Enhanced)
```
rawAttention = 1 - (
  0.30 × lookingAwaySidePct +
  0.20 × eyesClosedPct      +
  0.20 × lookingDownPct      +
  0.15 × faceMissingPct      +
  0.15 × cameraCoveredPct
)
attentionScore = clamp(rawAttention, 0, 1)
```

#### 🧍 Head Behavior
```
avgYaw    = mean(yaw values where face detected)
avgPitch  = mean(pitch values)
avgRoll   = mean(roll values)
yawVariance   = variance(yaw)
pitchVariance = variance(pitch)
rollVariance  = variance(roll)
movementStability = 1 / (1 + sqrt(yawVariance) / 15)
```

#### Irregular Movement Score (Jerk-Based)
```
yawDeltas = [yaw[i] - yaw[i-1] for each consecutive frame pair]
jerk      = [|delta[i] - delta[i-1]| for each consecutive delta pair]
avgJerk   = mean(jerk)
irregularMovementScore = clamp(avgJerk / 5.0, 0, 1)
```

#### 🙂 Expressions (Session Average)
```
avgEmotion[e] = Σ(expression[e]) / N     for e in {neutral, happy, sad, angry, fearful, disgusted, surprised}
```

#### 🚨 Behavior Events (Episode-Based)
An **episode** = a sequence of ≥1 consecutive flagged frames.
```
suspiciousLookingEvents = count(lookingAway episodes)
faceLossEvents          = count(faceMissing episodes)
longEyeClosureEvents   = count(eyesClosed episodes where duration ≥ 3 frames)
cameraCoveredEvents     = count(cameraCovered episodes)
```

#### ⚠️ Risk Features
```
maxContinuousLookingAwaySec = max(lookingAway episode durations) / FPS
maxContinuousFaceMissingSec = max(faceMissing episode durations) / FPS
maxContinuousEyeClosedSec  = max(eyesClosed episode durations) / FPS
rapidGazeSwitchCount        = count(yaw reversals > 30° within 2 seconds)
```

---

### Level B — Time-Window Aggregation (NEW)

Divide the session into **N windows** of equal size. Target: ~14 windows.
```
windowSizeSec = ceil(sessionDurationSec / 14)
```

For each window, compute:
- **Expression percentages** — average of each emotion across frames in that window, scaled to 0–100
- **Attention metrics** — `gazeOnScreenPct`, `facePresencePct`, `eyeClosurePct` for frames in that window
- **Stress Index** — composite heuristic (see formula below)
- **Accuracy** — percentage of questions answered correctly whose first interaction falls within this window

#### 🔥 Stress Index Formula (Per Window)
```
stressIndex(window) = clamp(
  0.30 × fearfulPct   +
  0.20 × angryPct      +
  0.10 × sadPct         +
  0.20 × gazeAwayPct   +
  0.10 × eyeClosedPct  -
  0.10 × neutralBonus
, 0, 100)
```

Where:
- `fearfulPct`, `angryPct`, `sadPct` = expression average in window × 100
- `gazeAwayPct` = (1 - gazeOnScreenPct) × 100
- `eyeClosedPct` = eyeClosurePct in window
- `neutralBonus` = max(0, neutralPct - 50) (bonus only kicks in above 50% neutral)

---

### Level C — Per-Question Behavioral Events (NEW)

Track which behavioral events occurred while each question was active (using the current `cur` question ID). For every question:

- `gazeBreaks` — count of gaze-away episodes that started while this Q was active
- `eyeCloseEvents` — count of eye-closure episodes
- `tabSwitches` — count of tab switches
- `copyAttempts` — count of copy attempts (Ctrl+C / right-click)
- `pasteAttempts` — count of paste attempts (Ctrl+V / right-click)
- `cameraCoveredEvents` — count of camera obstruction episodes
- `stressIndex` — computed from expressions/attention during time spent on this Q
- `dominantEmotion` — most frequent expression class while on this Q
- `timeOnQuestionSec` — total active time on this Q (from qStats)

---

## 🧠 3. FINAL MODEL JSON (SESSION OUTPUT)

👉 This is what the ML model + report charts receive:

```jsonc
{
  // ─── SESSION METADATA ───
  "sessionDurationSec": number,
  "totalFrames": number,
  "fps": 5,
  "windowSizeSec": number,

  // ─── LEVEL A: SESSION AGGREGATION ───
  "cameraHealth": {
    "cameraCoveredPct": number,
    "cameraCoveredEvents": number,
    "maxCameraCoveredSec": number
  },

  "facePresence": {
    "faceMissingPct": number,
    "faceMissingEvents": number,
    "maxFaceMissingSec": number
  },

  "attention": {
    "eyesClosedPct": number,
    "lookingAwaySidePct": number,
    "lookingDownPct": number,
    "lookingUpPct": number,
    "attentionScore": number        // 0.0 – 1.0
  },

  "headBehavior": {
    "avgYaw": number,
    "avgPitch": number,
    "avgRoll": number,
    "yawVariance": number,          // → ch9 Yaw axis
    "pitchVariance": number,        // → ch9 Pitch axis
    "rollVariance": number,         // → ch9 Roll axis
    "movementStability": number,
    "irregularMovementScore": number
  },

  "expressions": {                   // → donut chart
    "neutral": number,
    "happy": number,
    "sad": number,
    "angry": number,
    "fearful": number,
    "disgusted": number,
    "surprised": number
  },

  "behaviorEvents": {                // → ch8 (Suspicious Events bar chart)
    "suspiciousLookingEvents": number,
    "faceLossEvents": number,
    "longEyeClosureEvents": number,
    "cameraCoveredEvents": number
  },

  "riskFeatures": {
    "maxContinuousLookingAwaySec": number,
    "maxContinuousFaceMissingSec": number,
    "maxContinuousEyeClosedSec": number,
    "irregularMovementScore": number,
    "rapidGazeSwitchCount": number
  },

  // ─── LEVEL B: TIME-WINDOW AGGREGATION ───
  // (feeds: ch1 Behavior Timeline, ch7 Attention Profile, ch13 Emotion–Accuracy)
  "timeWindows": [
    {
      "windowIndex": number,
      "startSec": number,
      "endSec": number,
      "framesInWindow": number,

      "expressions": {               // → ch1 (each emotion as 0–100%)
        "neutral": number,
        "happy": number,
        "fearful": number,
        "surprised": number,
        "sad": number,
        "angry": number
      },

      "gazeOnScreenPct": number,     // → ch7 Gaze on Screen line
      "facePresencePct": number,     // → ch7 Face Presence line
      "eyeClosurePct": number,       // → ch7 Eye Closure line

      "stressIndex": number,         // → ch13 red area
      "accuracyPct": number,         // → ch13 green line

      "questionsActive": [number]    // which Qs were active during this window
    }
    // ... 14 windows total (auto-calculated)
  ],

  // ─── LEVEL C: PER-QUESTION BEHAVIORAL EVENTS ───
  // (feeds: ch14 Proctoring Timeline scatter)
  "perQuestionBehavior": [
    {
      "questionId": number,
      "gazeBreaks": number,          // → ch14 "Gaze Break" dots
      "eyeCloseEvents": number,      // → ch14 "Eye Close" dots
      "tabSwitches": number,         // → ch14 "Tab Switch" dots
      "copyAttempts": number,        // → ch14 "Copy Attempt" dots
      "pasteAttempts": number,       // → ch14 "Paste Attempt" dots
      "cameraCoveredEvents": number,
      "stressIndex": number,         // per-Q stress for future ML use
      "dominantEmotion": string,     // most frequent expression on this Q
      "timeOnQuestionSec": number
    }
    // ... for all 22 questions
  ],

  // ─── CHEATING ANALYSIS ───
  "cheatingAnalysis": {
    "cheatingProbability": number,    // 0.0–1.0 composite score
    "cheatingTier": string,          // "LOW" | "MODERATE" | "HIGH" | "CRITICAL"
    "signals": {
      "tabSwitchSignal": number,     // 0–1, saturates at 5 switches
      "gazeDeviationSignal": number, // 0–1, saturates at 15% side-gaze
      "faceAbsenceSignal": number,   // 0–1, saturates at 10% missing
      "cameraCoverSignal": number,   // 0–1, saturates at 5% covered
      "rapidGazeSwitchSignal": number, // 0–1, saturates at 8 rapid switches
      "irregularMovementSignal": number, // 0–1, jerk-based
      "copyPasteSignal": number,     // 0–1, saturates at 3 attempts
      "multiTabSignal": number       // binary 0 or 1
    },
    "weights": string,               // human-readable weight formula
    "llmNote": string                // guidance for LLM interpretation
  }
}
```

### Cheating Probability Formula

```
cheatingProbability = clamp(
  0.20 × tabSwitchSignal      +     // Tab switches (most deliberate)
  0.18 × gazeDeviationSignal  +     // Looking away repeatedly
  0.15 × faceAbsenceSignal    +     // Face left the frame
  0.12 × cameraCoverSignal    +     // Camera was blocked
  0.12 × rapidGazeSwitchSignal +    // Snap look-snap back pattern
  0.08 × irregularMovementSignal +  // Erratic head jerks
  0.10 × copyPasteSignal      +     // Copy/paste attempts
  0.05 × multiTabSignal            // Multiple tabs detected
, 0, 1)
```

**Signal Saturation Thresholds:**

| Signal | Saturates at | Rationale |
|---|---|---|
| Tab switches | ≥ 5 | 5+ switches is almost certainly intentional |
| Gaze deviation | ≥ 15% of frames | 15% = ~6 minutes looking away in a 40-min exam |
| Face absence | ≥ 10% of frames | 10% = ~4 minutes face missing |
| Camera cover | ≥ 5% of frames | Any deliberate covering is severe |
| Rapid gaze switches | ≥ 8 events | Repeated snap-look pattern |
| Copy/paste | ≥ 3 attempts | 3+ attempts shows persistence |
| Multi-tab | Boolean | Binary detection |

**Risk Tiers:**

| Probability | Tier | LLM Guidance |
|---|---|---|
| < 0.15 | LOW | Normal behavior, no further investigation |
| 0.15 – 0.39 | MODERATE | Flag for human review, may be nervousness |
| 0.40 – 0.69 | HIGH | Likely external assistance, investigate answer patterns |
| ≥ 0.70 | CRITICAL | Strong evidence of cheating, cross-reference with code similarity |

---

## 📊 Chart → Schema Field Reference

| Report Chart               | ID     | Schema Field(s) Read                                                   | Can Populate? |
| -------------------------- | ------ | ---------------------------------------------------------------------- | ------------- |
| Behavior Timeline          | `ch1`  | `timeWindows[].expressions.*`                                          | ✅ YES        |
| Time Per Question           | `ch2`  | `perQuestion[].timeSpentSeconds` + avg benchmark                       | ✅ YES        |
| Correctness Heatmap        | `ch3`  | `perQuestion[].isCorrect`                                              | ✅ YES        |
| Code Quality Radar         | `ch4`  | Needs code judge scores (external)                                     | ❌ NO — requires code evaluation engine |
| Category Breakdown         | `ch5`  | `scoring.*` + per-category tagging                                     | ⚠️ PARTIAL — needs question-to-category mapping |
| Confidence Distribution    | `ch6`  | Derived from `timeToSolveSeconds` + `isCorrect` heuristic              | ⚠️ PARTIAL — confidence is inferred, not measured |
| Attention Profile          | `ch7`  | `timeWindows[].gazeOnScreenPct`, `.facePresencePct`, `.eyeClosurePct`  | ✅ YES        |
| Suspicious Events          | `ch8`  | `behaviorEvents.*`                                                     | ✅ YES        |
| Head Stability             | `ch9`  | `headBehavior.yawVariance`, `.pitchVariance`, `.rollVariance`          | ✅ YES        |
| Topic Performance          | `ch10` | `perQuestion[].isCorrect` grouped by topic tag                         | ⚠️ PARTIAL — needs question-to-topic mapping |
| Difficulty Analysis        | `ch11` | `perQuestion[].difficulty` + `isCorrect` + `timeSpentSeconds`          | ✅ YES        |
| Response Time Distribution | `ch12` | `perQuestion[].timeSpentSeconds` histogram                             | ✅ YES        |
| Emotion–Accuracy Link      | `ch13` | `timeWindows[].stressIndex`, `.accuracyPct`                            | ✅ YES        |
| Proctoring Timeline        | `ch14` | `perQuestionBehavior[].gazeBreaks`, `.eyeCloseEvents`, `.tabSwitches`  | ✅ YES        |
| Navigation Pattern         | `ch17` | `perQuestion[].viewCount` (from qStats)                                | ✅ YES        |
| Emotion Donut              | donut  | `expressions.*`                                                        | ✅ YES        |
| Attention Score stat card  | —      | `attention.attentionScore`                                             | ✅ YES        |
| Gaze Deviation stat card   | —      | `attention.lookingAwaySidePct`                                         | ✅ YES        |
| Tab Switches stat card     | —      | `securityFlags.tabSwitches`                                            | ✅ YES        |
| Copy Events stat card      | —      | `securityFlags.copyAttempts`                                           | ✅ YES        |
| Cheating Risk stat card    | —      | `cheatingAnalysis.cheatingProbability`, `.cheatingTier`                 | ✅ YES        |

**Summary: 16/21 fully populated ✅ · 3/21 partial ⚠️ · 2/21 need external data ❌**

---

## ⚙️ 4. SYSTEM FLOW

```
Camera Stream
   ↓
Frame Processing (5 FPS)
   ↓
Per-Frame JSON Logging
   ↓
┌─────────────────────────────────┐
│  Aggregation Engine             │
│  ├── Session-level counters     │
│  ├── Time-window buckets        │
│  ├── Per-question event tags    │
│  ├── Episode tracker            │
│  └── Cheating probability       │
└─────────────────────────────────┘
   ↓
FINAL JSON (3-level + cheating)
   ↓
┌──────────────┬──────────────┐
│  LLM Model   │  Report UI   │
│  (~3.3K tok)  │  (15 charts) │
└──────────────┴──────────────┘
```

---

## 🔥 5. KEY IDEA

```
Frame JSON        = raw perception (what the camera sees each frame)
Time Windows      = temporal behavior patterns (how emotions/attention shift over time)
Per-Question      = contextual behavior events (what happened during each question)
Session Summary   = ML-ready intelligence (overall behavioral profile)
Cheating Score    = composite probability from 8 signals (LLM uses as prior)
```

---

## ✅ 6. FINAL BEHAVIORAL AUDIT — Report ↔ Schema Verification

> **Purpose:** Close the behavioral/emotional chapter by mapping every visual element in `report.html` to its exact data source. After this section, all behavioral graphs, stat cards, bars, and text blocks are fully specified and implementable.

### A. Stat Cards (Top Row)

| Card | Display | JSON Field | Source |
|---|---|---|---|
| Correct Answers | `14/20` | MCQ scoring | Scoring engine |
| Tab Switches | `2` | `securityFlags.tabSwitches` | Event counter |
| **Gaze Deviation** | `8.1%` | **`attention.lookingAwaySidePct`** | **Frame-by-frame:** `Σ(|yaw| > 25° frames) / totalFrames` |
| Copy Events | `0` | `securityFlags.copyAttempts` | Event counter |
| Cheating Risk | `12%` | `cheatingAnalysis.cheatingProbability` × 100 | Frame-by-frame: weighted sum of 8 signals |

### B. Emotion Visuals (Donut + Bars)

| Element | JSON Field | Source |
|---|---|---|
| Emotion Donut (6 slices) | `expressions.neutral/happy/sad/angry/fearful/surprised` | Frame-by-frame: `Σ(expr[e]) / totalFrames` |
| Emotion Bars (6 rows + tags) | Same `expressions.*` | Same computation |

### C. Time-Window Charts (Level B)

| Chart | ID | Series | JSON Field | Source |
|---|---|---|---|---|
| Behavior Timeline | ch1 | Neutral, Happy, Fear, Surprise, Sad, Angry | `timeWindows[i].expressions.*` | Frame-by-frame: per-window expression averages × 100 |
| Attention Profile | ch7 | Gaze on Screen, Face Presence, Eye Closure | `timeWindows[i].gazeOnScreenPct`, `.facePresencePct`, `.eyeClosurePct` | Frame-by-frame: per-window frame ratios × 100 |
| Stress–Accuracy | ch13 | Stress Index, Accuracy % | `timeWindows[i].stressIndex`, `.accuracyPct` | **⚠️ CROSS-SOURCE** — see section below |

### D. Session-Level Charts (Level A)

| Chart | ID | Series | JSON Field | Source |
|---|---|---|---|---|
| Suspicious Events | ch8 | Look Away, Face Loss, Eye Close | `behaviorEvents.suspiciousLookingEvents`, `.faceLossEvents`, `.longEyeClosureEvents` | Frame-by-frame: episode transition counting |
| Head Stability | ch9 | Yaw, Pitch, Roll variance | `headBehavior.yawVariance`, `.pitchVariance`, `.rollVariance` | Frame-by-frame: `variance(history[])` |

### E. Per-Question Chart (Level C)

| Chart | ID | Series | JSON Field | Source |
|---|---|---|---|---|
| Proctoring Timeline | ch14 | Tab Switch, Gaze Break, Eye Close, Copy, Paste | `perQuestionBehavior[i].tabSwitches`, `.gazeBreaks`, `.eyeCloseEvents`, `.copyAttempts`, `.pasteAttempts` | **⚠️ CROSS-SOURCE** — behavioral events + question context (see below) |

### F. Text Blocks (LLM-Generated)

| Section | Data Referenced | JSON Fields Used |
|---|---|---|
| Interview Summary | "8.1% gaze deviation", "14/18 correct" | `attention.lookingAwaySidePct` + **scoring** (`perQuestion[].isCorrect`) |
| Behavioral Summary | "Neutral 62%", "Fear 7%", "2 tab switches" | `expressions.*`, `securityFlags.tabSwitches` |
| Stress Response | "Fear spiked to 18% during concurrency MCQs" | `perQuestionBehavior[].dominantEmotion` + **question metadata** (topic, difficulty) |
| Tab Switching | "2 tab switches at Q7, Q14" | `perQuestionBehavior[].tabSwitches` + **question IDs** |

---

### ⚠️ G. Cross-Source Dependencies

> **Critical:** Several charts and text blocks do NOT rely solely on the behavioral/webcam JSON. They combine proctoring data with **quiz/scoring data** from `generateFullReport()`. This section documents those cross-source dependencies.

#### ch13 — Emotion–Accuracy Link (Stress vs Accuracy)

| Series | Data Source | Origin |
|---|---|---|
| **Stress Index** (red area) | `timeWindows[i].stressIndex` | ✅ Behavioral — webcam proctoring engine |
| **Accuracy %** (green line) | `timeWindows[i].accuracyPct` | ❗ **Scoring engine** — NOT from webcam |

**How `accuracyPct` must be computed:**
```
For each time window [startSec, endSec]:
  1. Find all questions whose firstInteraction timestamp falls within this window
  2. Of those questions, count how many were answered correctly
  3. accuracyPct = (correctInWindow / totalInWindow) × 100
```

**Data needed from scoring/quiz side:**
- `qStats[qId].firstInteraction` — timestamp of first interaction with question
- `userAnswers[qId]` — candidate's selected answer
- `mcqQuestions[qId].correct` — correct answer index
- `perQuestion[qId].isCorrect` — boolean from `generateFullReport()`
- `perQuestion[qId].pts` — points scored (e.g., `20/25`)

#### ch14 — Proctoring Timeline

| Series | Data Source | Origin |
|---|---|---|
| Tab Switch, Gaze Break, Eye Close, Copy, Paste | `perQuestionBehavior[i].*` | ✅ Behavioral — webcam + event handlers |
| **Question identity** (x-axis: Q1–Q22) | Question IDs from `mcqQuestions` + `codeQuestions` | ❗ **Quiz engine** — question ordering |
| **Question metadata** (topic, difficulty for insights) | Question definitions | ❗ **Quiz engine** — question bank |

#### Stat Cards & Text Blocks

| Element | Behavioral Source | Non-Behavioral Source |
|---|---|---|
| Correct Answers stat card | — | `perQuestion[].isCorrect` + total count |
| Interview Summary text | `attention.lookingAwaySidePct` | `scoring.overallPct`, `perQuestion[].isCorrect` |
| Stress Response text | `perQuestionBehavior[].stressIndex` | Question topic/category mapping |

#### Cross-Source Data Flow

```
┌─────────────────────┐     ┌─────────────────────┐
│  Webcam Proctoring   │     │  Quiz/Scoring        │
│  (proctorMetrics)    │     │  (qStats, answers)   │
│  ├── expressions     │     │  ├── isCorrect       │
│  ├── gaze/attention  │     │  ├── pts / score     │
│  ├── episodes        │     │  ├── timestamps      │
│  └── cheating signals│     │  └── question meta   │
└──────────┬──────────┘     └──────────┬──────────┘
           │                           │
           └─────────┬─────────────────┘
                     ↓
           ┌─────────────────────┐
           │  generateFullReport()│
           │  Merges both sources │
           │  into unified JSON   │
           └──────────┬──────────┘
                      ↓
           ┌──────────────────────┐
           │  report.html charts   │
           │  ch13: stress(webcam) │
           │    + accuracy(quiz)   │
           │  ch14: events(webcam) │
           │    + question IDs     │
           └──────────────────────┘
```

---

### H. Verification Summary

```
Total behavioral/emotional visual elements:  15
Purely behavioral (webcam-only):             11  ✅
Cross-source (webcam + quiz/scoring):         4  ⚠️  (ch13, ch14, stat cards, text blocks)
Missing from schema:                          0  ❌
```

> **Gaze Deviation confirmation:** Present in final JSON at `attention.lookingAwaySidePct` (computed at `interview.html` line 1800). The stat card in `report.html` reads this field.

> **Key insight:** The proctoring engine produces all behavioral data independently. But 4 visual elements require a **merge** with quiz/scoring data at `generateFullReport()` time. The behavioral schema is complete — the merge logic is a separate implementation task.

### I. Remaining Work (Non-Behavioral)

The following items are **outside the behavioral/emotional scope** and will be addressed separately:

- `ch13.accuracyPct` — wire by cross-referencing `qStats[].firstInteraction` timestamps with time-window boundaries
- `report.html` wiring — replace hardcoded demo data with real data from `localStorage` / `generateFullReport()`
- LLM integration — feed the final merged JSON to the model for narrative generation
- Question metadata enrichment — category/topic tagging for cross-referencing stress with topic performance

---

**🔒 BEHAVIORAL CHAPTER CLOSED** — All behavioral detection, aggregation, charting schema, cross-source dependencies, and data flow are fully specified. The proctoring engine in `interview.html` implements the complete behavioral pipeline. Future work focuses on quiz/scoring integration and non-behavioral features.