# LLM Service Layer — Implementation Plan (v3)

> Updated with: HuggingFace provider, DB question storage, difficulty levels, job profile relations.

---

## Provider Decision

| Item | Value |
|---|---|
| **Provider** | HuggingFace Inference API (Novita) |
| **Model** | openai/gpt-oss-120b:novita |
| **Auth** | Bearer token via HuggingFace API key |
| **Endpoint** | `https://router.huggingface.co/v1/chat/completions` |
| **API Key Location** | `application.properties → spring.ai.openai.api-key` |

---

## What's NOT Mine (Frontend Only — arrives as raw JSON)

| Model | Owner | Backend Action |
|---|---|---|
| `MCQ_Solution[]` | Frontend builds | Received as raw JSON → forwarded to LLM prompt |
| `Coding_Solution[]` | Frontend builds | Received as raw JSON → forwarded to LLM prompt |
| `SecurityFlags` | Frontend tracks | Received as raw JSON → forwarded to LLM prompt |
| `Final Behavioral JSON` | Frontend aggregates | Received as raw JSON → forwarded to LLM prompt |
| `qStats` | Frontend only | Never sent to backend |
| `FrameData` | Frontend only | Never sent to backend |
| `Countdown` | Frontend only | Never sent to backend |

**Key:** Backend receives these as `String` / `JsonNode`. No Java DTOs created for them.

---

## What IS Mine (Backend Responsibility)

### A. Question DTOs (Backend → Frontend)

Served to the frontend when an interview starts. These **match the DB entities** with proper FK relationships.

| DTO | Direction | DB Relations |
|---|---|---|
| `McqDTO` | Backend → Frontend | FK: `difficulty_level_id`, M:N: `job_profile` |
| `CodingDTO` | Backend → Frontend | FK: `difficulty_level_id` |

> When LLM generates questions (Option A: free-text JD), the backend:
> 1. Calls LLM → gets question JSON
> 2. **Saves to DB** with proper difficulty_level FK + job_profile M:N link
> 3. Returns DTOs to frontend

> When user picks predefined role (Option B), backend:
> 1. Loads from DB by job_profile
> 2. Returns DTOs to frontend

---

### B. LLM Response DTOs (LLM → Backend → Frontend)

Backend parses and validates LLM JSON output into these typed classes.

| DTO | LLM Call | Endpoint | Nested Objects |
|---|---|---|---|
| `BehaviorAnalysisDTO` | #1 (parallel) | `POST /api/llm/behavior` | AreaOfDevelopment, ActionPlanItem |
| `DomainAnalysisDTO` | #2 (parallel) | `POST /api/llm/domain` | AreaOfDevelopment, ActionPlanItem, TopicPerformance |
| `CodingAnalysisDTO` | #3 (parallel) | `POST /api/llm/coding` | AreaOfDevelopment, ActionPlanItem, CodeQualityRadar |
| `FinalReportDTO` | #4 (sequential) | `POST /api/llm/final-report` | ConfidenceDistribution, DifficultyAnalysis |

> All nested objects are **static inner classes** within their parent DTO. No separate files.

---

## DTO Schema Designs

### McqDTO (Backend → Frontend, stored in DB)

```json
{
  "question":        "String",
  "choices":         ["String", "String", "String", "String"],
  "answer":          0,
  "score":           10,
  "avgTimeSec":      60,
  "difficultyLevel": "EASY | MEDIUM | HARD",
  "jobProfileTitle": "Senior Java Developer"
}
```

| Field | Type | DB Mapping | Notes |
|---|---|---|---|
| question | String | `question_text` NN | Question text |
| choices | List\<String\> | `choices` JSONB NN | 4 answer options |
| answer | int | `correct_answer` NN | Correct answer index (0–3) |
| score | int | from `DifficultyLevel.defaultPoints` | Points for this question |
| avgTimeSec | int | `average_time_sec` NL | LLM-estimated benchmark time |
| difficultyLevel | String | FK → `difficulty_level_id` NN | Maps to DifficultyLevel entity |
| jobProfileTitle | String | M:N → `job_profile` | Links question to role |

---

### CodingDTO (Backend → Frontend, stored in DB)

```json
{
  "problem":         "String",
  "input":           "String",
  "output":          "String",
  "constraints":     ["String"],
  "score":           20,
  "avgTimeSec":      300,
  "difficultyLevel": "EASY | MEDIUM | HARD"
}
```

| Field | Type | DB Mapping | Notes |
|---|---|---|---|
| problem | String | `problem_statement` NN | Problem statement |
| input | String | `inputs` JSONB NN | Example input |
| output | String | `outputs` JSONB NN | Expected output |
| constraints | List\<String\> | `constraints_text` NL | Constraint lines |
| score | int | from `DifficultyLevel.defaultPoints` | Max points |
| avgTimeSec | int | `average_time_sec` NL | LLM-estimated benchmark time |
| difficultyLevel | String | FK → `difficulty_level_id` NN | Maps to DifficultyLevel entity |

---

### BehaviorAnalysisDTO (LLM Response #1)

```json
{
  "summary": "String — overall behavioral assessment",
  "tag":     "String — e.g. 'Focused', 'Distracted'",
  "areasOfDevelopment": [
    { "topic": "String", "priority": "HIGH/MEDIUM/LOW", "description": "String" }
  ],
  "actionPlan": [
    { "priority": "HIGH/MEDIUM/LOW", "title": "String", "description": "String" }
  ]
}
```

---

### DomainAnalysisDTO (LLM Response #2)

```json
{
  "summary": "String",
  "tag":     "String",
  "areasOfDevelopment": [ ... ],
  "actionPlan": [ ... ],
  "topicPerformance": [
    { "topic": "OOP", "candidatePct": 75.0, "averagePct": 68.0 }
  ]
}
```

---

### CodingAnalysisDTO (LLM Response #3)

```json
{
  "summary": "String",
  "tag":     "String",
  "areasOfDevelopment": [ ... ],
  "actionPlan": [ ... ],
  "codeQualityRadar": {
    "correctnessPct": 85.0, "patternPct": 70.0, "readabilityPct": 90.0,
    "timeComplexityPct": 65.0, "spaceComplexityPct": 80.0,
    "edgeCasePct": 55.0, "optimizationPct": 60.0
  }
}
```

---

### FinalReportDTO (LLM Response #4)

```json
{
  "interviewSummary": "String — comprehensive summary paragraph",
  "confidenceDistribution": {
    "highConfidencePct": 40.0, "moderatePct": 30.0,
    "hesitantPct": 15.0, "guessingPct": 10.0, "noAnswerPct": 5.0
  },
  "difficultyAnalysis": {
    "easy":   { "accuracyPct": 90.0, "avgTimeSec": 30 },
    "medium": { "accuracyPct": 65.0, "avgTimeSec": 75 },
    "hard":   { "accuracyPct": 40.0, "avgTimeSec": 120 }
  }
}
```

---

## Backend Workflow

```
QUESTION GENERATION → Interview (frontend) → 3 PARALLEL LLM Calls → FINAL REPORT → SAVE
```

---

## Prompt Templates

### Prompt #0 — Question Generation
System: Senior technical interview architect. JD → 10 MCQ (4E/4M/2H) + 2 Coding (1M/1H). Pure JSON only.

### Prompt #1 — Behavior Analysis
System: Senior I/O psychologist. Behavioral JSON → summary + tag + 3 areas + 3 actions. Pure JSON only.

### Prompt #2 — Domain Analysis
System: FAANG senior interviewer. MCQ solutions → summary + tag + 3 areas + 3 actions + topic performance. Pure JSON only.

### Prompt #3 — Coding Analysis
System: Principal engineer. Coding solutions → summary + tag + 3 areas + 3 actions + 7-axis radar. Pure JSON only.

### Prompt #4 — Final Report
System: Chief Assessment Officer. 3 DTOs + meta → executive summary + confidence distribution + difficulty analysis. Pure JSON only.

---

## Build Order

| Chunk | What | Depends On | Testable? |
|---|---|---|---|
| **1** | LLM Response DTOs (7 files) | Nothing | Compile only |
| **2** | LlmConfig + LlmService (Spring AI) | Chunk 1 + API key | Yes — Postman |
| **3** | Controllers (3 files) | Chunk 2 | Yes — Postman |
| **4** | QuestionController DB integration | Chunk 3 + JPA entities | Yes — Postman |
| **5** | ReportController DB integration | Chunk 4 + Interview entity | Yes — Postman |
