package com.example.interviewReady.Service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.stereotype.Service;

import com.example.interviewReady.DTO.BehaviorAnalysisDTO;
import com.example.interviewReady.DTO.CodingAnalysisDTO;
import com.example.interviewReady.DTO.CodingGenerationDTO;
import com.example.interviewReady.DTO.DomainAnalysisDTO;
import com.example.interviewReady.DTO.FinalReportDTO;
import com.example.interviewReady.DTO.McqGenerationDTO;
import com.example.interviewReady.DTO.QuestionGenerationDTO;
import com.fasterxml.jackson.databind.ObjectMapper;

@Service
public class LlmService {

    private static final Logger log = LoggerFactory.getLogger(LlmService.class);

    private final ChatClient chatClient;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public LlmService(ChatClient chatClient) {
        this.chatClient = chatClient;
    }

    // ─────────────────────────────────────────────────────
    // Prompt #0A — MCQ Generation (JD → MCQ[])
    // ─────────────────────────────────────────────────────

    private static final String MCQ_GEN_SYSTEM = """
            You are a senior technical interview architect at a FAANG-level company. You specialize in crafting precise, role-specific technical assessments.

            You will receive a Job Description (JD). From it, generate exactly 10 MCQ questions.

            You MUST respond with ONLY valid JSON matching this exact schema. No markdown, no explanation, no wrapper text.

            {
              "jobProfileTitle": "string — clean, standardized role title in Title Case",
              "mcq": [
                {
                  "question": "string — clear, unambiguous technical question",
                  "choices": ["string", "string", "string", "string"],
                  "answer": 0,
                  "score": 10,
                  "avgTimeSec": 60,
                  "difficultyLevel": "EASY | MEDIUM | HARD",
                  "jobProfileTitle": "string — same as top-level jobProfileTitle"
                }
              ]
            }

            Rules:
            - mcq: exactly 10 questions
              - Distribution: 4 EASY, 4 MEDIUM, 2 HARD
              - score: EASY=5, MEDIUM=10, HARD=15
              - avgTimeSec: EASY=30, MEDIUM=60, HARD=90
              - choices: exactly 4 options per question, only 1 correct
              - answer: 0-indexed correct answer position
              - Topics must cover the core skills mentioned in the JD
            - jobProfileTitle rules (STRICT):
              - Use full words, NO abbreviations: "SWE" → "Software Engineer", "SRE" → "Site Reliability Engineer", "FE" → "Frontend Engineer", "BE" → "Backend Engineer", "ML" → "Machine Learning Engineer", "QA" → "Quality Assurance Engineer"
              - NO hyphens or underscores: "Back-End" → "Backend", "Full-Stack" → "Full Stack"
              - Title Case only: "backend engineer" → "Backend Engineer"
              - Keep it concise: max 4 words
            - All questions must be directly relevant to the JD — no generic filler
            """;

    // ─────────────────────────────────────────────────────
    // Prompt #0B — Coding Generation (JD → Coding[])
    // ─────────────────────────────────────────────────────

    private static final String CODING_GEN_SYSTEM = """
            You are a senior technical interview architect at a FAANG-level company. You specialize in crafting LeetCode-style algorithmic coding challenges used in real technical interviews.

            You will receive a Job Description (JD). From it, generate exactly 2 coding problems in classic LeetCode format — clear problem statement, well-defined input/output, and explicit constraints.

            You MUST respond with ONLY valid JSON matching this exact schema. No markdown, no explanation, no wrapper text.

            {
              "coding": [
                {
                  "title": "string — concise problem name like 'Two Sum', 'Palindrome Check'",
                  "problem": "string — detailed LeetCode-style problem statement (NO examples). Wrap variable names, types, and code references in backticks like `nums`, `target`, `nums.length`, `Array[i]`",
                  "input": ["string — example input with format"],
                  "output": ["string — expected output"],
                  "constraints": ["string — wrap code references in backticks like `2 <= nums.length <= 10^4`"],
                  "starterCode": { "java": "string", "cpp": "string", "python": "string", "js": "string" },
                  "score": 10,
                  "avgTimeSec": 300,
                  "difficultyLevel": "EASY | MEDIUM"
                }
              ]
            }

            Rules:
            - coding: exactly 2 problems
              - Distribution: 1 EASY, 1 MEDIUM
              - score: EASY=10, MEDIUM=20
              - avgTimeSec: EASY=300, MEDIUM=600
              - Problem must be a classic algorithmic challenge (arrays, strings, trees, graphs, dynamic programming, etc.)
              - Include clear input/output format and edge case constraints
              - problem statement: DO NOT include examples in the problem statement itself. Examples belong ONLY in the 'input' and 'output' fields.
              - starterCode: generate complete function signatures for all 4 languages (java, cpp, python, js) with parameter types and return type. Include a comment // Write your code here inside each body.
              - Wrap ALL code references in problem text and constraints with backticks (`) for frontend syntax highlighting
            - Style: LeetCode / FAANG interview — clean, precise, no ambiguity
            - Problems should test algorithmic thinking relevant to the JD skills
            """;  

    public McqGenerationDTO generateMcqQuestions(String jobDescription) {
        log.info("LLM Call #0A — Generating MCQ questions from Job Description");
        String response = callLlm(MCQ_GEN_SYSTEM, jobDescription);
        return parseResponse(response, McqGenerationDTO.class);
    }

    public CodingGenerationDTO generateCodingQuestions(String jobDescription) {
        log.info("LLM Call #0B — Generating Coding problems from Job Description");
        String response = callLlm(CODING_GEN_SYSTEM, jobDescription);
        return parseResponse(response, CodingGenerationDTO.class);
    }

    /** @deprecated Use generateMcqQuestions + generateCodingQuestions in parallel instead */
    @Deprecated
    public QuestionGenerationDTO generateQuestions(String jobDescription) {
        log.info("LLM Call #0 — Generating ALL questions from Job Description (legacy combined)");
        String combinedSystem = MCQ_GEN_SYSTEM; // fallback — uses MCQ prompt only
        String response = callLlm(combinedSystem, jobDescription);
        return parseResponse(response, QuestionGenerationDTO.class);
    }

    // ─────────────────────────────────────────────────────
    // Prompt #1 — Behavior Analysis
    // ─────────────────────────────────────────────────────

    private static final String BEHAVIOR_SYSTEM = """
            You are a senior industrial-organizational psychologist specializing in behavioral assessment for technical hiring.

            You will receive a structured behavioral observation JSON from a proctored technical interview. The data contains session-level metrics, time-window aggregations, per-question behavioral snapshots, and a cheating analysis layer.

            Analyze the candidate's behavioral patterns — focus, engagement, stress indicators, gaze consistency, and emotional stability. Produce a clinical-grade assessment.

            You MUST respond with ONLY valid JSON matching this exact schema. No markdown, no explanation, no wrapper text.

            {
              "summary": "string — 4-6 sentence comprehensive behavioral assessment",
              "tag": "string — one of: Focused | Composed | Distracted | Anxious | Suspicious | Disengaged",
              "areasOfDevelopment": [
                { "topic": "string", "priority": "HIGH | MEDIUM | LOW", "description": "string — at least 3 detailed sentences" }
              ],
              "actionPlan": [
                { "priority": "HIGH | MEDIUM | LOW", "title": "string", "description": "string — at least 3 detailed sentences" }
              ]
            }

            Rules:
            - summary: MUST be 4-6 comprehensive sentences covering overall behavioral profile, key strengths, concerns, and professional impression
            - areasOfDevelopment: exactly 3 items, ordered by priority descending
              - Each description MUST be at least 3 full sentences — explain what was observed, why it matters, and how it impacts their candidacy
            - actionPlan: exactly 3 items, actionable and specific
              - Each description MUST be at least 3 full sentences — explain the specific steps to take, resources to use, and expected improvement timeline
            - tag: must be exactly one of the 6 options listed
            - All strings must be non-empty. DO NOT write short one-line descriptions.
            """;

    public BehaviorAnalysisDTO analyzeBehavior(String rawBehavioralJson) {
        log.info("LLM Call #1 — Analyzing behavioral data");
        String response = callLlm(BEHAVIOR_SYSTEM, rawBehavioralJson);
        return parseResponse(response, BehaviorAnalysisDTO.class);
    }

    // ─────────────────────────────────────────────────────
    // Prompt #2 — Domain Analysis
    // ─────────────────────────────────────────────────────

    private static final String DOMAIN_SYSTEM = """
            You are a senior technical interviewer and domain expert with 15+ years of experience in software engineering hiring at FAANG-level companies.

            You will receive an array of MCQ solutions from a technical interview. Each solution contains the question text, whether the candidate answered, whether they were correct, points earned, and time spent.

            Evaluate the candidate's domain knowledge — identify strong and weak topic areas, compare their performance against industry benchmarks, and produce a structured assessment.

            You MUST respond with ONLY valid JSON matching this exact schema. No markdown, no explanation, no wrapper text.

            {
              "summary": "string — 4-6 sentence comprehensive domain expertise assessment",
              "tag": "string — one of: Expert | Proficient | Competent | Developing | Novice",
              "areasOfDevelopment": [
                { "topic": "string", "priority": "HIGH | MEDIUM | LOW", "description": "string — at least 3 detailed sentences" }
              ],
              "actionPlan": [
                { "priority": "HIGH | MEDIUM | LOW", "title": "string", "description": "string — at least 3 detailed sentences" }
              ],
              "topicPerformance": [
                { "topic": "string", "candidatePct": 0.0, "averagePct": 0.0 }
              ]
            }

            Rules:
            - summary: MUST be 4-6 comprehensive sentences covering overall domain proficiency, strongest areas, critical gaps, and comparison to industry benchmarks
            - Infer topic categories from the question content (e.g., OOP, Databases, Algorithms, Networking)
            - areasOfDevelopment: exactly 3 items
              - Each description MUST be at least 3 full sentences — explain the knowledge gap identified, which questions exposed it, and why this skill is critical for the role
            - actionPlan: exactly 3 items
              - Each description MUST be at least 3 full sentences — explain the specific learning path, recommended resources or courses, and measurable milestones to track progress
            - topicPerformance: 4-6 topic categories, candidatePct based on actual scores, averagePct is your industry benchmark estimate
            - All percentage values: 0.0 to 100.0
            - DO NOT write short one-line descriptions. Be thorough and specific.
            """;

    public DomainAnalysisDTO analyzeDomain(String rawMcqSolutionsJson) {
        log.info("LLM Call #2 — Analyzing domain knowledge");
        String response = callLlm(DOMAIN_SYSTEM, rawMcqSolutionsJson);
        return parseResponse(response, DomainAnalysisDTO.class);
    }

    // ─────────────────────────────────────────────────────
    // Prompt #3 — Coding Analysis
    // ─────────────────────────────────────────────────────

    private static final String CODING_SYSTEM = """
            You are a principal software engineer and code quality architect with deep expertise in algorithmic problem-solving, clean code principles, and technical interview evaluation.

            You will receive an array of coding solutions from a technical interview. Each solution contains the problem statement, the candidate's submitted code, the questionScore (which is the MAXIMUM possible score for that problem), and whether they attempted the problem.

            Evaluate the candidate's coding proficiency — analyze correctness, design patterns, readability, time/space complexity, edge case handling, and optimization potential. Produce a structured assessment with a 7-axis quality radar and a numeric total score.

            You MUST respond with ONLY valid JSON matching this exact schema. No markdown, no explanation, no wrapper text.

            {
              "summary": "string — 4-6 sentence comprehensive coding proficiency assessment",
              "tag": "string — one of: Exceptional | Strong | Competent | Developing | Weak",
              "areasOfDevelopment": [
                { "topic": "string", "priority": "HIGH | MEDIUM | LOW", "description": "string — at least 3 detailed sentences" }
              ],
              "actionPlan": [
                { "priority": "HIGH | MEDIUM | LOW", "title": "string", "description": "string — at least 3 detailed sentences" }
              ],
              "codeQualityRadar": {
                "correctnessPct": 0.0,
                "patternPct": 0.0,
                "readabilityPct": 0.0,
                "timeComplexityPct": 0.0,
                "spaceComplexityPct": 0.0,
                "edgeCasePct": 0.0,
                "optimizationPct": 0.0
              },
              "totalCodingScore": 0
            }

            Rules:
            - summary: MUST be 4-6 comprehensive sentences covering coding style, algorithmic thinking, code quality patterns, and overall engineering maturity
            - areasOfDevelopment: exactly 3 items
              - Each description MUST be at least 3 full sentences — explain the specific coding weakness, cite evidence from their submitted code, and explain the impact on production readiness
            - actionPlan: exactly 3 items
              - Each description MUST be at least 3 full sentences — explain the practice technique, recommended platforms (e.g., LeetCode, HackerRank), and specific problem categories to focus on
            - codeQualityRadar: all 7 values required, range 0.0 to 100.0
            - totalCodingScore: For EACH coding solution, evaluate the code quality and award a score between 0 and its questionScore (which represents the maximum possible points for that problem). If isSolved=false (candidate did not attempt), the earned score for that problem is 0. Sum all earned scores across all problems into totalCodingScore.
            - If candidate did not attempt a problem (isSolved=false), factor that into lower scores
            - Evaluate actual code quality, not just correctness
            - DO NOT write short one-line descriptions. Be thorough, specific, and actionable.
            """;

    public CodingAnalysisDTO analyzeCoding(String rawCodingSolutionsJson) {
        log.info("LLM Call #3 — Analyzing coding solutions");
        String response = callLlm(CODING_SYSTEM, rawCodingSolutionsJson);
        return parseResponse(response, CodingAnalysisDTO.class);
    }

    // ─────────────────────────────────────────────────────
    // Prompt #4 — Final Report
    // ─────────────────────────────────────────────────────

    private static final String FINAL_REPORT_SYSTEM = """
            You are the Chief Assessment Officer producing the final executive summary for a comprehensive technical interview evaluation.

            You will receive a composite JSON containing:
            - Three analysis reports (behavioral, domain, coding) from specialist evaluators
            - Total interview duration (seconds)
            - Security flags (tab switches, copy/paste attempts, multi-tab detection)
            - Final combined score

            Synthesize all inputs into a cohesive final report. Assess the candidate's confidence distribution across their answers and their performance by difficulty level. Evaluate the cheating probability based on security flags and behavioral patterns.

            You MUST respond with ONLY valid JSON matching this exact schema. No markdown, no explanation, no wrapper text.

            {
              "interviewSummary": "string — 4-6 sentence executive summary covering all three pillars",
              "confidenceDistribution": {
                "highConfidencePct": 0.0,
                "moderatePct": 0.0,
                "hesitantPct": 0.0,
                "guessingPct": 0.0,
                "noAnswerPct": 0.0
              },
              "difficultyAnalysis": {
                "easy":   { "accuracyPct": 0.0, "avgTimeSec": 0 },
                "medium": { "accuracyPct": 0.0, "avgTimeSec": 0 },
                "hard":   { "accuracyPct": 0.0, "avgTimeSec": 0 }
              },
              "cheatingProbability": {
                "level": "LOW | MODERATE | HIGH",
                "percentage": 0.0
              }
            }

            Rules:
            - interviewSummary: professional tone, reference specific findings from all 3 analysis reports. DO NOT leak or reference raw JSON parameter names, backend variable names, or database keys (such as "totalFlags", "tabSwitches", "copyAttempts", "pasteAttempts") in the interviewSummary; describe security events using natural, professional language instead (e.g. "the candidate switched windows multiple times").
            - confidenceDistribution: all 5 values must sum to exactly 100.0
            - difficultyAnalysis: all percentage values 0.0-100.0, avgTimeSec as positive integers
            - cheatingProbability:
              - Evaluate based on securityFlags (tabSwitches, copyAttempts, pasteAttempts, totalFlags) and behaviorAnalysis (tag, gaze stability, engagement drops)
              - level: "LOW" if totalFlags <= 5 and behavior is Focused/Composed; "MODERATE" if totalFlags 6-15 or behavior is Distracted/Anxious; "HIGH" if totalFlags > 15 or behavior is Suspicious
              - percentage: 0.0 to 100.0 — a continuous risk score reflecting combined security and behavioral indicators
              - If totalFlags is 0 and behavior tag is Focused, set level="LOW" and percentage below 10.0
            - Factor security flags into the interviewSummary if totalFlags > 0
            """;

    public FinalReportDTO generateFinalReport(String rawFinalReportInput) {
        log.info("LLM Call #4 — Generating final comprehensive report");
        String response = callLlm(FINAL_REPORT_SYSTEM, rawFinalReportInput);
        return parseResponse(response, FinalReportDTO.class);
    }

    // ─────────────────────────────────────────────────────
    // Core: Spring AI ChatClient call
    // ─────────────────────────────────────────────────────

    private String callLlm(String systemPrompt, String userPayload) {
        try {
            String result = chatClient.prompt()
                    .system(systemPrompt)
                    .user(userPayload)
                    .call()
                    .content();

            log.debug("LLM raw response length: {}", result != null ? result.length() : 0);
            return result;
        } catch (Exception e) {
            log.error("LLM call failed: {}", e.getMessage(), e);
            throw new RuntimeException("LLM service unavailable: " + e.getMessage(), e);
        }
    }

    // ─────────────────────────────────────────────────────
    // JSON parsing with retry
    // ─────────────────────────────────────────────────────

    private <T> T parseResponse(String json, Class<T> clazz) {
        try {
            // Strip markdown code fences if LLM wraps response
            String cleaned = json.strip();
            if (cleaned.startsWith("```")) {
                cleaned = cleaned.replaceAll("^```(json)?\\s*", "").replaceAll("```\\s*$", "").strip();
            }
            return objectMapper.readValue(cleaned, clazz);
        } catch (Exception e) {
            log.error("Failed to parse LLM response into {}: {}", clazz.getSimpleName(), e.getMessage());
            log.debug("Raw response was: {}", json);
            throw new RuntimeException("LLM returned invalid JSON for " + clazz.getSimpleName(), e);
        }
    }
}
