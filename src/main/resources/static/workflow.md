# 🏗️ InterviewReady — Full Platform Workflow & Data Structure Specification

> **Shared Contract** — This document is the single source of truth for both Frontend (Angular) and Backend (Spring Boot) teams.

---

## 📋 Table of Contents

1. [User Journey Workflow](#1-user-journey-workflow)
2. [Data Structures — Frontend Models](#2-data-structures--frontend-models)
3. [Data Structures — LLM Response DTOs](#3-data-structures--llm-response-dtos)
4. [LLM Processing Pipeline](#4-llm-processing-pipeline)
5. [Final Report Assembly](#5-final-report-assembly)
6. [API Contract Summary](#6-api-contract-summary)

---

## 1. User Journey Workflow

### Phase 1 — Interview Setup

```
User lands on Dashboard
       │
       ├── Option A: Enter Job Description (free text)
       │     └── Backend → LLM generates MCQ[] + Coding[]
       │
       └── Option B: Select Predefined Role
             └── Backend → Loads MCQ[] + Coding[] from Database
       │
       ▼
Frontend receives MCQ[] + Coding[] via DTOs
Interview page initializes
```

### Phase 2 — Interview In Progress

```
Interview Page Active
       │
       ├── Countdown timer starts
       ├── Webcam proctoring starts (5 FPS)
       │     ├── Frame-by-frame JSON → buffer
       │     └── Episode tracking (gaze, face, eyes)
       │
       ├── SecurityFlags tracks globally (tab/clipboard/multi-tab)
       │
       ├── User answers MCQ questions
       │     ├── qStats[id] tracks time per question
       │     └── MCQ_Solution[] built incrementally
       │
       ├── User solves Coding problems
       │     ├── qStats[id] tracks time
       │     └── Coding_Solution[] built incrementally
       │
       └── User clicks "Submit Exam"
             └── Triggers Phase 3
```

### Phase 3 — Post-Interview Processing (3 Parallel LLM Calls)

```
Submit Exam
       │
       ├── MCQ scoring (instant, frontend)
       │     └── Loop: compare userAnswer === answer → questionScore
       │
       ├── Generate Final Behavioral JSON (3-level aggregation)
       │
       └── Send 3 payloads to backend (parallel):
             │
             ├── POST /api/llm/behavior
             │     Payload: Final Behavioral JSON
             │     Returns: BehaviorAnalysisDTO
             │
             ├── POST /api/llm/domain
             │     Payload: MCQ_Solution[]
             │     Returns: DomainAnalysisDTO
             │
             └── POST /api/llm/coding
                   Payload: Coding_Solution[]
                   Returns: CodingAnalysisDTO
```

### Phase 4 — Final Report Generation (4th LLM Call)

```
All 3 DTOs received
       │
       ▼
Assemble Final Report Input JSON:
  ├── timeTaken (interview duration)
  ├── securityFlags
  ├── finalScore (MCQ + Coding combined)
  ├── behaviorAnalysisDTO
  ├── domainAnalysisDTO
  └── codingAnalysisDTO
       │
       ▼
POST /api/llm/final-report
       │
       ▼
Returns: FinalReportDTO
  ├── interviewSummary
  ├── confidenceDistribution
  └── difficultyAnalysis
```

### Phase 5 — Report Display & Storage

```
Merge all data into Final Comprehensive Report:
  FinalReportDTO + 3 Analysis DTOs + timeTaken + securityFlags + finalScore
       │
       ├── Render report.html with real data
       │
       └── POST /api/reports/save
             └── Persist to Database
```

---

## 2. Data Structures — Frontend Models

### 2.1 MCQ (from Backend)

```typescript
interface MCQ {
  question:   string;      // Question text
  choices:    string[];    // 4 answer options
  answer:     number;      // Correct answer index (0–3)
  score:      number;      // Points for this question
  avgTimeSec: number;      // LLM-estimated benchmark time
}
```

### 2.2 Coding (from Backend)

```typescript
interface Coding {
  problem:     string;     // Problem statement
  input:       string;     // Example input
  output:      string;     // Expected output
  constraints: string[];   // Constraint lines
  score:       number;     // Max points
  avgTimeSec:  number;     // LLM-estimated benchmark time
}
```

### 2.3 MCQ_Solution (built on Frontend)

```typescript
interface MCQSolution {
  question:        string;   // Full question text (for LLM context)
  isSolved:        boolean;  // Did the user submit an answer
  isRight:         boolean;  // Was the answer correct
  questionScore:   number;   // Points earned (0 if wrong)
  timeTakenByUser: number;   // Active seconds spent on this question
}
```

### 2.4 Coding_Solution (built on Frontend)

```typescript
interface CodingSolution {
  question:      string;   // Problem statement (for LLM context)
  userCode:      string;   // Submitted code
  questionScore: number;   // Score from LLM evaluation
  isSolved:      boolean;  // Did user submit code
}
```

### 2.5 qStats (carry over as-is)

```typescript
interface QStats {
  cumulativeTimeMs:  number;       // Total active ms on this question
  firstInteraction:  number | null; // Timestamp of first touch
  lastInteraction:   number | null; // Timestamp of last touch
  viewCount:         number;       // How many times navigated to this Q
}
```

> **Usage:** `timeTakenByUser = Math.round(qStats[id].cumulativeTimeMs / 1000)`

### 2.6 SecurityFlags (unified entity)

```typescript
interface SecurityFlags {
  tabSwitches:          number;   // Count of tab switches
  copyAttempts:         number;   // Count of copy events
  pasteAttempts:        number;   // Count of paste events
  multipleTabsDetected: boolean;  // BroadcastChannel detection
  totalFlags:           number;   // Computed: sum of all
}
```

### 2.7 Frame-by-Frame JSON (carry over as-is)

```typescript
interface FrameData {
  frame:         number;
  timestamp:     number;
  cameraCovered: boolean;
  faceDetected:  boolean;
  headPose:      { yaw: number; pitch: number; roll: number };
  eyesOpen:      boolean;
  looking:       { isLookingSide: boolean; isLookingDown: boolean; isLookingUp: boolean };
  expressions:   { neutral: number; happy: number; sad: number; angry: number; fearful: number; disgusted: number; surprised: number };
  statusFlags:   { faceMissing: boolean; suspiciousYaw: boolean; eyesClosed: boolean };
}
```

### 2.8 Final Behavioral JSON (carry over as-is)

> 3-level aggregation schema — full specification in `new_feature.md` §3.
> Levels: Session (A) → Time-Window (B) → Per-Question (C) + Cheating Analysis.

### 2.9 Countdown

```typescript
interface Countdown {
  totalSeconds:     number;   // Total exam duration
  remainingSeconds: number;   // Current remaining time
}
```

---

## 3. Data Structures — LLM Response DTOs

### 3.1 BehaviorAnalysisDTO

```json
{
  "summary": "string",
  "tag": "string",
  "areasOfDevelopment": [
    {
      "topic": "string",
      "priority": "string",
      "description": "string"
    }
  ],
  "actionPlan": [
    {
      "priority": "string",
      "title": "string",
      "description": "string"
    }
  ]
}
```

> **Input:** Final Behavioral JSON (3-level aggregation)
> **Feeds:** report.html → Behavioral Profile section

### 3.2 DomainAnalysisDTO

```json
{
  "summary": "string",
  "tag": "string",
  "areasOfDevelopment": [
    {
      "topic": "string",
      "priority": "string",
      "description": "string"
    }
  ],
  "actionPlan": [
    {
      "priority": "string",
      "title": "string",
      "description": "string"
    }
  ],
  "topicPerformance": [
    {
      "topic": "string",
      "candidatePct": "number",
      "averagePct": "number"
    }
  ]
}
```

> **Input:** MCQ_Solution[]
> **Feeds:** report.html → Domain Expertise section + ch10 Topic Performance

### 3.3 CodingAnalysisDTO

```json
{
  "summary": "string",
  "tag": "string",
  "areasOfDevelopment": [
    {
      "topic": "string",
      "priority": "string",
      "description": "string"
    }
  ],
  "actionPlan": [
    {
      "priority": "string",
      "title": "string",
      "description": "string"
    }
  ],
  "codeQualityRadar": {
    "correctnessPct": "number",
    "patternPct": "number",
    "readabilityPct": "number",
    "timeComplexityPct": "number",
    "spaceComplexityPct": "number",
    "edgeCasePct": "number",
    "optimizationPct": "number"
  }
}
```

> **Input:** Coding_Solution[]
> **Feeds:** report.html → Coding section + ch4 Code Quality Radar (7 axes)

### 3.4 FinalReportDTO

```json
{
  "interviewSummary": "string",
  "confidenceDistribution": {
    "highConfidencePct": "number",
    "moderatePct": "number",
    "hesitantPct": "number",
    "guessingPct": "number",
    "noAnswerPct": "number"
  },
  "difficultyAnalysis": {
    "easy":   { "accuracyPct": "number", "avgTimeSec": "number" },
    "medium": { "accuracyPct": "number", "avgTimeSec": "number" },
    "hard":   { "accuracyPct": "number", "avgTimeSec": "number" }
  }
}
```

> **Input:** All 3 DTOs + timeTaken + securityFlags + finalScore
> **Feeds:** report.html → Interview Summary + ch6 Confidence + ch11 Difficulty

---

## 4. LLM Processing Pipeline

```
                    ┌─────────────────────────────────────────────┐
                    │           INTERVIEW COMPLETE                 │
                    │                                              │
                    │  MCQ_Solution[]  Coding_Solution[]  Behav.JSON│
                    └──────┬──────────────┬───────────────┬────────┘
                           │              │               │
                     ┌─────▼─────┐  ┌─────▼─────┐  ┌─────▼──────┐
                     │  POST      │  │  POST      │  │  POST       │
                     │  /llm/     │  │  /llm/     │  │  /llm/      │
                     │  domain    │  │  coding    │  │  behavior   │
                     └─────┬─────┘  └─────┬─────┘  └─────┬──────┘
                           │              │               │
                     ┌─────▼─────┐  ┌─────▼─────┐  ┌─────▼──────┐
                     │  Domain    │  │  Coding   │  │  Behavior   │
                     │  Analysis  │  │  Analysis │  │  Analysis   │
                     │  DTO       │  │  DTO      │  │  DTO        │
                     └─────┬─────┘  └─────┬─────┘  └─────┬──────┘
                           │              │               │
                           └──────────────┼───────────────┘
                                          │
                              ┌───────────▼────────────┐
                              │  Assemble Input JSON    │
                              │  3 DTOs + timeTaken     │
                              │  + securityFlags        │
                              │  + finalScore           │
                              └───────────┬────────────┘
                                          │
                              ┌───────────▼────────────┐
                              │  POST /llm/final-report │
                              └───────────┬────────────┘
                                          │
                              ┌───────────▼────────────┐
                              │  FinalReportDTO         │
                              └───────────┬────────────┘
                                          │
                              ┌───────────▼────────────┐
                              │  MERGE → Final Report   │
                              │  POST /reports/save     │
                              │  Render report.html     │
                              └────────────────────────┘
```

### LLM Call Summary

| Call # | Endpoint | Input | Output | Blocking? |
|---|---|---|---|---|
| 1 | `POST /api/llm/domain` | `MCQ_Solution[]` | `DomainAnalysisDTO` | Parallel with 2 & 3 |
| 2 | `POST /api/llm/coding` | `Coding_Solution[]` | `CodingAnalysisDTO` | Parallel with 1 & 3 |
| 3 | `POST /api/llm/behavior` | Final Behavioral JSON | `BehaviorAnalysisDTO` | Parallel with 1 & 2 |
| 4 | `POST /api/llm/final-report` | 3 DTOs + meta | `FinalReportDTO` | Sequential (waits for 1–3) |

---

## 5. Final Report Assembly

```typescript
interface FinalComprehensiveReport {
  // ─── Meta ───
  timeTaken:      number;          // Total interview duration (seconds)
  finalScore:     number;          // MCQ score + Coding score
  securityFlags:  SecurityFlags;   // Unified security entity

  // ─── LLM Analysis (from calls 1–3) ───
  behavior:       BehaviorAnalysisDTO;
  domain:         DomainAnalysisDTO;
  coding:         CodingAnalysisDTO;

  // ─── LLM Final (from call 4) ───
  interviewSummary:        string;
  confidenceDistribution:  ConfidenceDistribution;
  difficultyAnalysis:      DifficultyAnalysis;
}
```

> This object:
> 1. Powers every chart and text block in `report.html`
> 2. Gets persisted to the database via `POST /api/reports/save`

---

## 6. API Contract Summary

| # | Endpoint | Method | Request Body | Response Body | Notes |
|---|---|---|---|---|---|
| 1 | `/api/questions/generate` | POST | Job description or role ID | `{ mcq: MCQ[], coding: Coding[] }` | LLM or DB source |
| 2 | `/api/llm/domain` | POST | `MCQ_Solution[]` | `DomainAnalysisDTO` | Parallel |
| 3 | `/api/llm/coding` | POST | `Coding_Solution[]` | `CodingAnalysisDTO` | Parallel |
| 4 | `/api/llm/behavior` | POST | Final Behavioral JSON | `BehaviorAnalysisDTO` | Parallel |
| 5 | `/api/llm/final-report` | POST | 3 DTOs + meta | `FinalReportDTO` | Sequential |
| 6 | `/api/reports/save` | POST | `FinalComprehensiveReport` | `{ reportId }` | Persist to DB |

---

## Chart → Data Source Mapping

| Chart | ID | Data Source | Owner |
|---|---|---|---|
| Behavior Timeline | ch1 | Final Behavioral JSON | Frontend (carry over) |
| Time Per Question | ch2 | qStats | Frontend (carry over) |
| Correctness Heatmap | ch3 | MCQ_Solution[].isRight | Frontend |
| Code Quality Radar | ch4 | CodingAnalysisDTO.codeQualityRadar | **LLM** |
| Category Breakdown | ch5 | Computed from scores | Frontend |
| Confidence Distribution | ch6 | FinalReportDTO.confidenceDistribution | **LLM** |
| Attention Profile | ch7 | Final Behavioral JSON | Frontend (carry over) |
| Suspicious Events | ch8 | Final Behavioral JSON | Frontend (carry over) |
| Head Stability | ch9 | Final Behavioral JSON | Frontend (carry over) |
| Topic Performance | ch10 | DomainAnalysisDTO.topicPerformance | **LLM** |
| Difficulty Analysis | ch11 | FinalReportDTO.difficultyAnalysis | **LLM** |
| Response Time Distribution | ch12 | qStats | Frontend |
| Emotion–Accuracy | ch13 | Behavioral JSON + MCQ_Solution | Cross-source |
| Proctoring Timeline | ch14 | Final Behavioral JSON | Frontend (carry over) |
| Navigation Pattern | ch17 | qStats.viewCount | Frontend |
| Emotion Donut | donut | Final Behavioral JSON | Frontend (carry over) |

---

> **📌 Document Status:** Living document — endpoints, persistence schemas, and Angular service mappings will be added as implementation progresses.
