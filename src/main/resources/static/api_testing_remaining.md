
---

## Step 3 — Domain Knowledge Analysis

### POST `/api/llm/domain`
**Content-Type:** `application/json`

> **Schema source:** `workflow.md` §2.3 — `MCQSolution` interface

```json
[
  {
    "question": "Which of the following is NOT one of the core OOP principles?",
    "isSolved": true,
    "isRight": true,
    "questionScore": 5,
    "timeTakenByUser": 22
  },
  {
    "question": "Which Spring Boot annotation is used to define a REST controller?",
    "isSolved": true,
    "isRight": true,
    "questionScore": 5,
    "timeTakenByUser": 18
  },
  {
    "question": "Which HTTP method is considered idempotent?",
    "isSolved": true,
    "isRight": false,
    "questionScore": 0,
    "timeTakenByUser": 25
  },
  {
    "question": "Which Docker command lists all currently running containers?",
    "isSolved": true,
    "isRight": true,
    "questionScore": 5,
    "timeTakenByUser": 28
  },
  {
    "question": "In a Spring Boot project, which starter provides actuator endpoints for health and metrics?",
    "isSolved": true,
    "isRight": true,
    "questionScore": 10,
    "timeTakenByUser": 48
  },
  {
    "question": "Which design pattern helps a microservice avoid cascading failures when a downstream service is unavailable?",
    "isSolved": true,
    "isRight": true,
    "questionScore": 10,
    "timeTakenByUser": 55
  },
  {
    "question": "In PostgreSQL, which isolation level permits non-repeatable reads?",
    "isSolved": true,
    "isRight": false,
    "questionScore": 0,
    "timeTakenByUser": 52
  },
  {
    "question": "What is the primary purpose of a Kubernetes Service of type LoadBalancer?",
    "isSolved": true,
    "isRight": true,
    "questionScore": 10,
    "timeTakenByUser": 61
  },
  {
    "question": "Which creational design pattern is most appropriate for creating families of related objects without specifying their concrete classes?",
    "isSolved": true,
    "isRight": false,
    "questionScore": 0,
    "timeTakenByUser": 82
  },
  {
    "question": "A Java application uses a fixed thread pool of size 5 with an unbounded work queue. If 10 tasks are submitted at once, what will happen?",
    "isSolved": false,
    "isRight": false,
    "questionScore": 0,
    "timeTakenByUser": 76
  }
]
```

**Candidate Profile:** 6/10 correct (45/90 pts). Strong on Spring/Docker. Failed DB isolation, design patterns. Skipped concurrency.

**Expected Response:** `DomainAnalysisDTO` with topicPerformance[4-6]. ~15-20 sec.

---

## Step 4 — Coding Proficiency Analysis

### POST `/api/llm/coding`
**Content-Type:** `application/json`

> **Schema source:** `workflow.md` §2.4 — `CodingSolution` interface

```json
[
  {
    "question": "Implement a function that returns the length of the Longest Increasing Subsequence (LIS) in an integer array. The solution must run in O(n log n) time.\n\nInput: [10, 9, 2, 5, 3, 7, 101, 18]\nOutput: 4\n\nConstraints:\n- 1 <= array length <= 100,000\n- Each integer fits in a signed 32-bit range\n- Time complexity O(n log n), Memory O(n)\n- Use only standard Java libraries",
    "userCode": "import java.util.ArrayList;\nimport java.util.Collections;\nimport java.util.List;\n\npublic class LIS {\n    public static int lengthOfLIS(int[] nums) {\n        if (nums == null || nums.length == 0) return 0;\n        \n        List<Integer> tails = new ArrayList<>();\n        \n        for (int num : nums) {\n            int pos = Collections.binarySearch(tails, num);\n            if (pos < 0) pos = -(pos + 1);\n            \n            if (pos == tails.size()) {\n                tails.add(num);\n            } else {\n                tails.set(pos, num);\n            }\n        }\n        \n        return tails.size();\n    }\n    \n    public static void main(String[] args) {\n        int[] arr = {10, 9, 2, 5, 3, 7, 101, 18};\n        System.out.println(lengthOfLIS(arr));\n    }\n}",
    "questionScore": 16,
    "isSolved": true
  },
  {
    "question": "Write a Java program that simulates a simple container-orchestration scheduler using First-Fit Decreasing (FFD) heuristic.\n\nInput:\n3\n8 16\n4 8\n10 10\n4\n5 5\n3 7\n6 4\n2 2\n\nOutput:\n1\n2\n3\n1\n\nConstraints:\n- First-Fit Decreasing heuristic\n- Sort pods by (cpu+mem) descending, output in original order\n- Time O((N+M) log N), Memory O(N+M)\n- Use only standard Java collections",
    "userCode": "import java.util.*;\n\npublic class Scheduler {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        int n = sc.nextInt();\n        int[][] nodes = new int[n][2];\n        for (int i = 0; i < n; i++) {\n            nodes[i][0] = sc.nextInt();\n            nodes[i][1] = sc.nextInt();\n        }\n        \n        int m = sc.nextInt();\n        int[][] pods = new int[m][2];\n        int[] originalOrder = new int[m];\n        for (int i = 0; i < m; i++) {\n            pods[i][0] = sc.nextInt();\n            pods[i][1] = sc.nextInt();\n            originalOrder[i] = i;\n        }\n        \n        // Sort by cpu+mem descending\n        // BUG: not sorting originalOrder array along with pods\n        Arrays.sort(pods, (a, b) -> (b[0] + b[1]) - (a[0] + a[1]));\n        \n        int[] result = new int[m];\n        for (int i = 0; i < m; i++) {\n            result[i] = -1;\n            for (int j = 0; j < n; j++) {\n                if (nodes[j][0] >= pods[i][0] && nodes[j][1] >= pods[i][1]) {\n                    nodes[j][0] -= pods[i][0];\n                    nodes[j][1] -= pods[i][1];\n                    result[i] = j + 1;\n                    break;\n                }\n            }\n        }\n        \n        // BUG: printing sorted order instead of original\n        for (int r : result) {\n            System.out.println(r);\n        }\n    }\n}",
    "questionScore": 12,
    "isSolved": false
  }
]
```

**Candidate Profile:** LIS solved well (16/20), scheduler has index-tracking bug (12/30). Total coding: 28/50.

**Expected Response:** `CodingAnalysisDTO` with codeQualityRadar (7 axes). ~15-20 sec.

---

## Step 5 — Final Comprehensive Report

### POST `/api/llm/final-report`
**Content-Type:** `application/json`

> **Schema source:** `workflow.md` §5 — Final Report Assembly. Frontend sends this after Steps 2-4 complete.

```json
{
  "behaviorAnalysis": {
    "summary": "The candidate displayed generally stable focus early but exhibited increased anxiety during mid-session HARD MCQs, with gaze stability dropping and fearful emotion spiking. Cheating risk is MODERATE — tab switching and copy-paste activity concentrated during coding problems.",
    "tag": "Anxious",
    "areasOfDevelopment": [
      { "topic": "Stress and anxiety management", "priority": "HIGH", "description": "Develop strategies to mitigate fear during challenging segments." },
      { "topic": "Gaze consistency under pressure", "priority": "MEDIUM", "description": "Improve sustained eye contact when cognitive load increases." },
      { "topic": "Emotional expression control", "priority": "LOW", "description": "Maintain neutral baseline to avoid fear spikes." }
    ],
    "actionPlan": [
      { "priority": "HIGH", "title": "Pre-interview breathing routine", "description": "5-minute diaphragmatic breathing before each interview." },
      { "priority": "MEDIUM", "title": "Eye-tracking practice", "description": "Mock drills for >0.85 gaze stability in 10-min blocks." },
      { "priority": "LOW", "title": "Emotional journal", "description": "Record fear triggers and plan coping cues." }
    ]
  },
  "domainAnalysis": {
    "summary": "Solid Spring Boot and Docker fundamentals. Significant gaps in database theory and design patterns. Skipping the concurrency question is a red flag for a senior role.",
    "tag": "Competent",
    "areasOfDevelopment": [
      { "topic": "Database internals", "priority": "HIGH", "description": "Misidentified PostgreSQL isolation levels." },
      { "topic": "Java concurrency", "priority": "HIGH", "description": "Skipped thread pool question entirely." },
      { "topic": "Creational design patterns", "priority": "MEDIUM", "description": "Confused Abstract Factory with Builder." }
    ],
    "actionPlan": [
      { "priority": "HIGH", "title": "DB isolation deep-dive", "description": "Study MVCC and isolation levels in PostgreSQL docs." },
      { "priority": "HIGH", "title": "Concurrency mastery", "description": "Complete Java Concurrency in Practice — Executors chapters." },
      { "priority": "MEDIUM", "title": "Design pattern kata", "description": "Implement all 5 creational patterns with real use cases." }
    ],
    "topicPerformance": [
      { "topic": "Spring Boot / REST", "candidatePct": 100.0, "averagePct": 78.0 },
      { "topic": "Docker / Kubernetes", "candidatePct": 83.3, "averagePct": 65.0 },
      { "topic": "Microservices Patterns", "candidatePct": 100.0, "averagePct": 55.0 },
      { "topic": "Database Theory", "candidatePct": 0.0, "averagePct": 52.0 },
      { "topic": "Design Patterns", "candidatePct": 0.0, "averagePct": 48.0 },
      { "topic": "Java Concurrency", "candidatePct": 0.0, "averagePct": 42.0 }
    ]
  },
  "codingAnalysis": {
    "summary": "Strong algorithmic thinking on LIS with clean O(n log n) solution. Struggled with scheduler — sorting bug reveals gap in multi-step algorithm implementation.",
    "tag": "Competent",
    "areasOfDevelopment": [
      { "topic": "Index tracking in sort operations", "priority": "HIGH", "description": "Failed to maintain original order when sorting pods." },
      { "topic": "Edge case handling", "priority": "MEDIUM", "description": "Scheduler -1 output case not handled correctly." },
      { "topic": "Code structure", "priority": "LOW", "description": "Monolithic main method needs refactoring." }
    ],
    "actionPlan": [
      { "priority": "HIGH", "title": "Sorting with auxiliary arrays", "description": "Practice index-preservation problems." },
      { "priority": "MEDIUM", "title": "Greedy algorithm drills", "description": "10 medium+ LeetCode greedy problems." },
      { "priority": "LOW", "title": "Code refactoring", "description": "Extract scheduling into separate classes." }
    ],
    "codeQualityRadar": {
      "correctnessPct": 62.5,
      "patternPct": 45.0,
      "readabilityPct": 70.0,
      "timeComplexityPct": 75.0,
      "spaceComplexityPct": 80.0,
      "edgeCasePct": 40.0,
      "optimizationPct": 55.0
    }
  },
  "timeTaken": 2847,
  "securityFlags": {
    "tabSwitches": 13,
    "copyAttempts": 3,
    "pasteAttempts": 5,
    "multipleTabsDetected": true,
    "totalFlags": 22
  },
  "finalScore": 73
}
```

**Expected Response:** `FinalReportDTO` with interviewSummary, confidenceDistribution (sums to 100%), difficultyAnalysis. ~15-20 sec.

---

## Endpoint Summary

| # | Endpoint | Method | Input Source | Output DTO | ~Time |
|---|---|---|---|---|---|
| 0A | `/api/questions/generate-mcq` | POST | Job Description (text) | `McqGenerationDTO` | ~30-40s |
| 0B | `/api/questions/generate-coding` | POST | Job Description (text) | `CodingGenerationDTO` | ~30-40s |
| 1 | `/api/llm/behavior` | POST | `new_feature.md` §3 Final JSON | `BehaviorAnalysisDTO` | ~15-20s |
| 2 | `/api/llm/domain` | POST | `workflow.md` §2.3 MCQSolution[] | `DomainAnalysisDTO` | ~15-20s |
| 3 | `/api/llm/coding` | POST | `workflow.md` §2.4 CodingSolution[] | `CodingAnalysisDTO` | ~15-20s |
| 4 | `/api/llm/final-report` | POST | `workflow.md` §5 Composite | `FinalReportDTO` | ~15-20s |

### Frontend Parallel Execution Pattern

```
Phase 1 (Setup):
  Promise.all([generateMcq(jd), generateCoding(jd)])    // ~40 sec total

Phase 3 (Post-Interview):
  Promise.all([behavior(json), domain(mcqSol), coding(codeSol)])  // ~20 sec total

Phase 4 (Final):
  finalReport(composite)                                  // ~20 sec total
```
