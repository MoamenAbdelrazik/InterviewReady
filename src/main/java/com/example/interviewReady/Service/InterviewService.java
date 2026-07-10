package com.example.interviewReady.Service;

import java.time.Duration;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

import com.example.interviewReady.DTO.BehaviorAnalysisDTO;
import com.example.interviewReady.DTO.CodingAnalysisDTO;
import com.example.interviewReady.DTO.CodingDTO;
import com.example.interviewReady.DTO.CodingGenerationDTO;
import com.example.interviewReady.DTO.DashboardStatsDTO;
import com.example.interviewReady.DTO.DomainAnalysisDTO;
import com.example.interviewReady.DTO.FinalReportDTO;
import com.example.interviewReady.DTO.InterviewHistoryDTO;
import com.example.interviewReady.DTO.McqDTO;
import com.example.interviewReady.DTO.McqGenerationDTO;
import com.example.interviewReady.DTO.McqQuestionDTO;
import com.example.interviewReady.Model.Candidate;
import com.example.interviewReady.Model.CodingQuestion;
import com.example.interviewReady.Model.Interview;
import com.example.interviewReady.Model.JobProfile;
import com.example.interviewReady.Model.McqQuestion;
import com.example.interviewReady.Repository.CodingQuestionRepository;
import com.example.interviewReady.Repository.InterviewRepository;
import com.example.interviewReady.Repository.JobProfileRepository;
import com.example.interviewReady.Repository.McqQuestionRepository;

@Service
public class InterviewService {

    private static final Logger log = LoggerFactory.getLogger(InterviewService.class);
    private final ObjectMapper objectMapper = new ObjectMapper();

    private final InterviewRepository interviewRepository;
    private final JobProfileRepository jobProfileRepository;
    private final CodingQuestionRepository codingQuestionRepository;
    private final McqQuestionRepository mcqQuestionRepository;
    private final QuotaService quotaService;
    private final LlmService llmService;
    private final StringRedisTemplate redisTemplate;

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("MMM d, yyyy");
    private static final String REPORT_CACHE_PREFIX = "report:";
    private static final String DASHBOARD_CACHE_PREFIX = "dashboard:";
    private static final Duration REPORT_CACHE_TTL = Duration.ofHours(24);
    private static final Duration DASHBOARD_CACHE_TTL = Duration.ofMinutes(5);

    public InterviewService(InterviewRepository interviewRepository,
                            JobProfileRepository jobProfileRepository,
                            CodingQuestionRepository codingQuestionRepository,
                            McqQuestionRepository mcqQuestionRepository,
                            QuotaService quotaService,
                            LlmService llmService,
                            StringRedisTemplate redisTemplate) {
        this.interviewRepository = interviewRepository;
        this.jobProfileRepository = jobProfileRepository;
        this.codingQuestionRepository = codingQuestionRepository;
        this.mcqQuestionRepository = mcqQuestionRepository;
        this.quotaService = quotaService;
        this.llmService = llmService;
        this.redisTemplate = redisTemplate;
    }

    // ═══════════════════════════════════════════════════════════════
    //  MODE A — Custom JD
    //  LLM generates MCQ + Coding → persisted to DB → returned to frontend
    // ═══════════════════════════════════════════════════════════════

    public Map<String, Object> startWithCustomJD(Candidate candidate, String jobDescription) {
        // 1. Call LLM to generate questions FIRST (before consuming quota)
        McqGenerationDTO mcqGen = llmService.generateMcqQuestions(jobDescription);
        CodingGenerationDTO codingGen = llmService.generateCodingQuestions(jobDescription);

        // 2. LLM succeeded — NOW consume quota
        quotaService.consumeQuota(candidate);

        // 3. Find or create JobProfile from LLM-returned title (normalized dedup)
        String profileTitle = mcqGen.getJobProfileTitle();
        String normalized = JobProfileService.normalizeTitle(profileTitle);
        JobProfile profile = jobProfileRepository.findByNormalizedTitle(normalized);
        if (profile == null) {
            profile = jobProfileRepository.save(new JobProfile(normalized));
            log.info("New JobProfile created from LLM: '{}' (normalized: '{}')", profileTitle, normalized);
        }

        // 4. Create Interview row
        Interview interview = new Interview();
        interview.setCandidate(candidate);
        interview.setCustomJobDescription(jobDescription);
        interview.setJobProfile(profile);
        Interview saved = interviewRepository.save(interview);

        // 5. Persist MCQs to DB + tag to profile
        for (McqDTO dto : mcqGen.getMcq()) {
            McqQuestion entity = new McqQuestion();
            entity.setQuestionText(dto.getQuestion());
            entity.setChoices(dto.getChoices());
            // Bounds check: if LLM returns bad index, default to first choice
            int answerIdx = dto.getAnswer();
            if (answerIdx < 0 || answerIdx >= dto.getChoices().size()) {
                log.warn("LLM returned invalid answer index {} for MCQ, defaulting to 0", answerIdx);
                answerIdx = 0;
            }
            entity.setCorrectAnswer(dto.getChoices().get(answerIdx));
            entity.setDifficulty(dto.getDifficultyLevel());
            entity.setScore(dto.getScore());
            entity.setAverageTimeSec(dto.getAvgTimeSec());
            McqQuestion savedMcq = mcqQuestionRepository.save(entity);
            profile.getMcqQuestions().add(savedMcq);
        }
        jobProfileRepository.save(profile);

        // 6. Persist Coding to DB (standalone)
        for (CodingDTO dto : codingGen.getCoding()) {
            CodingQuestion entity = new CodingQuestion();
            entity.setTitle(dto.getTitle());
            entity.setProblemStatement(dto.getProblem());
            entity.setInputs(dto.getInput());
            entity.setOutputs(dto.getOutput());
            entity.setConstraints(dto.getConstraints());
            entity.setStarterCode(dto.getStarterCode());
            entity.setDifficulty(dto.getDifficultyLevel());
            entity.setScore(dto.getScore());
            entity.setAverageTimeSec(dto.getAvgTimeSec());
            codingQuestionRepository.save(entity);
        }

        log.info("Mode A: persisted {} MCQs + {} coding, profile '{}'",
                mcqGen.getMcq().size(), codingGen.getCoding().size(), profileTitle);

        // 6. Return same shape as Mode B
        Map<String, Object> result = new HashMap<>();
        result.put("interviewId", saved.getId());
        result.put("mcqQuestions", mcqGen.getMcq());
        result.put("codingQuestions", codingGen.getCoding());
        return result;
    }

    // ═══════════════════════════════════════════════════════════════
    //  MODE B — Template
    //  Candidate picks a JobProfile by title from the dashboard.
    //  Backend loads pre-seeded MCQs + random coding problems.
    // ═══════════════════════════════════════════════════════════════

    public Map<String, Object> startWithTemplate(Candidate candidate, String jobTitle) {
        // Normalize the incoming title for lookup
        String normalized = JobProfileService.normalizeTitle(jobTitle);
        JobProfile profile = jobProfileRepository.findByNormalizedTitle(normalized);
        if (profile == null) {
            throw new RuntimeException("Job profile not found: " + jobTitle);
        }

        // Guard: reject if profile has no questions
        if (profile.getMcqQuestions().isEmpty()) {
            throw new RuntimeException("This role has no questions available yet");
        }

        // Profile valid with questions — NOW consume quota
        quotaService.consumeQuota(candidate);

        Interview interview = new Interview();
        interview.setCandidate(candidate);
        interview.setJobProfile(profile);
        Interview saved = interviewRepository.save(interview);

        // Load MCQs tagged to this profile (up to 10)
        Set<McqQuestion> taggedMcqs = profile.getMcqQuestions();
        List<McqQuestion> mcqList = new ArrayList<>(taggedMcqs);
        Collections.shuffle(mcqList);
        List<McqQuestionDTO> mcqDtos = mcqList.stream()
                .limit(10)
                .map(this::toMcqDTO)
                .collect(Collectors.toList());

        // Load 2 random coding questions (1 EASY + 1 MEDIUM)
        List<CodingQuestion> easyCoding = codingQuestionRepository.findByDifficulty("EASY");
        List<CodingQuestion> mediumCoding = codingQuestionRepository.findByDifficulty("MEDIUM");
        Collections.shuffle(easyCoding);
        Collections.shuffle(mediumCoding);

        List<CodingQuestion> codingPick = new ArrayList<>();
        if (!easyCoding.isEmpty()) codingPick.add(easyCoding.get(0));
        if (!mediumCoding.isEmpty()) codingPick.add(mediumCoding.get(0));

        Map<String, Object> result = new HashMap<>();
        result.put("interviewId", saved.getId());
        result.put("mcqQuestions", mcqDtos);
        result.put("codingQuestions", codingPick);
        return result;
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> generateAndSaveReport(Long interviewId, Map<String, Object> rawInput, Candidate candidate) {
        Interview interview = interviewRepository.findById(interviewId)
                .orElseThrow(() -> new RuntimeException("Interview not found: " + interviewId));

        if (!interview.getCandidate().getId().equals(candidate.getId())) {
            throw new RuntimeException("Unauthorized: interview does not belong to this candidate");
        }

        // ── Extract raw data from frontend ────────────────────
        String behaviorDataJson = toJson(rawInput.get("behaviorData"));
        String mcqSolutionsJson = toJson(rawInput.get("mcqSolutions"));
        String codingSolutionsJson = toJson(rawInput.get("codingSolutions"));
        int timeTaken = rawInput.containsKey("timeTaken") ? ((Number) rawInput.get("timeTaken")).intValue() : 0;
        Map<String, Object> securityFlags = rawInput.containsKey("securityFlags")
                ? (Map<String, Object>) rawInput.get("securityFlags")
                : Map.of();

        // ── Calculate MCQ score (sum of earned questionScores) ──
        int mcqScore = 0;
        if (rawInput.get("mcqSolutions") instanceof List) {
            for (Object item : (List<?>) rawInput.get("mcqSolutions")) {
                if (item instanceof Map) {
                    Map<String, Object> sol = (Map<String, Object>) item;
                    if (sol.containsKey("questionScore")) {
                        mcqScore += ((Number) sol.get("questionScore")).intValue();
                    }
                }
            }
        }

        log.info("Report pipeline started for interview {} — mcqScore={}", interviewId, mcqScore);

        // ── Step 1: Run 3 LLM analysis calls in PARALLEL ─────
        final String bJson = behaviorDataJson;
        final String mJson = mcqSolutionsJson;
        final String cJson = codingSolutionsJson;

        CompletableFuture<BehaviorAnalysisDTO> behaviorFuture =
                CompletableFuture.supplyAsync(() -> llmService.analyzeBehavior(bJson));
        CompletableFuture<DomainAnalysisDTO> domainFuture =
                CompletableFuture.supplyAsync(() -> llmService.analyzeDomain(mJson));
        CompletableFuture<CodingAnalysisDTO> codingFuture =
                CompletableFuture.supplyAsync(() -> llmService.analyzeCoding(cJson));

        // Wait for all 3 to complete
        CompletableFuture.allOf(behaviorFuture, domainFuture, codingFuture).join();

        BehaviorAnalysisDTO behaviorAnalysis = behaviorFuture.join();
        DomainAnalysisDTO domainAnalysis = domainFuture.join();
        CodingAnalysisDTO codingAnalysis = codingFuture.join();

        // ── Calculate finalScore: MCQ (frontend-scored) + Coding (LLM-scored) ──
        int finalScore = mcqScore + codingAnalysis.getTotalCodingScore();

        log.info("3 parallel LLM analyses complete for interview {} — finalScore={}", interviewId, finalScore);

        // ── Step 2: Assemble input for final report LLM call ──
        Map<String, Object> finalReportInput = new HashMap<>();
        finalReportInput.put("behaviorAnalysis", toMap(behaviorAnalysis));
        finalReportInput.put("domainAnalysis", toMap(domainAnalysis));
        finalReportInput.put("codingAnalysis", toMap(codingAnalysis));
        finalReportInput.put("timeTaken", timeTaken);
        finalReportInput.put("securityFlags", securityFlags);
        finalReportInput.put("finalScore", finalScore);

        String finalReportInputJson = toJson(finalReportInput);
        FinalReportDTO finalReport = llmService.generateFinalReport(finalReportInputJson);

        log.info("Final report LLM complete for interview {}", interviewId);

        // ── Step 3: Merge everything into FinalComprehensiveReport ──
        Map<String, Object> comprehensiveReport = new HashMap<>();
        comprehensiveReport.put("interviewSummary", finalReport.getInterviewSummary());
        comprehensiveReport.put("confidenceDistribution", toMap(finalReport.getConfidenceDistribution()));
        comprehensiveReport.put("difficultyAnalysis", toMap(finalReport.getDifficultyAnalysis()));
        comprehensiveReport.put("cheatingProbability", toMap(finalReport.getCheatingProbability()));
        comprehensiveReport.put("behaviorAnalysis", toMap(behaviorAnalysis));
        comprehensiveReport.put("domainAnalysis", toMap(domainAnalysis));
        comprehensiveReport.put("codingAnalysis", toMap(codingAnalysis));
        comprehensiveReport.put("timeTaken", timeTaken);
        comprehensiveReport.put("securityFlags", securityFlags);
        comprehensiveReport.put("finalScore", finalScore);
        // Include job profile title for frontend display
        if (interview.getJobProfile() != null) {
            comprehensiveReport.put("jobProfileTitle", toTitleCase(interview.getJobProfile().getNormalizedTitle()));
        }

        // ── Store raw input data for report revisit ──
        comprehensiveReport.put("rawBehaviorData", rawInput.get("behaviorData"));
        comprehensiveReport.put("rawMcqSolutions", rawInput.get("mcqSolutions"));
        comprehensiveReport.put("rawCodingSolutions", rawInput.get("codingSolutions"));

        // ── Step 4: Save to DB ────────────────────────────────
        interview.setDetailedReport(comprehensiveReport);
        interview.setFinalScore(finalScore);
        interview.setDurationSec(timeTaken);
        interviewRepository.save(interview);

        // ── Step 5: Cache report in Redis (immutable — 24h TTL) ──
        try {
            redisTemplate.opsForValue().set(
                    REPORT_CACHE_PREFIX + interviewId,
                    objectMapper.writeValueAsString(comprehensiveReport),
                    REPORT_CACHE_TTL);
        } catch (Exception e) {
            log.warn("Failed to cache report in Redis: {}", e.getMessage());
        }

        // Invalidate dashboard stats cache (new data available)
        redisTemplate.delete(DASHBOARD_CACHE_PREFIX + candidate.getId());

        log.info("FinalComprehensiveReport saved for interview {}", interviewId);

        // ── Step 6: Return to frontend ────────────────────────
        return comprehensiveReport;
    }

    // ═══════════════════════════════════════════════════════════════
    //  GET REPORT
    // ═══════════════════════════════════════════════════════════════

    @SuppressWarnings("unchecked")
    public Map<String, Object> getReport(Long interviewId, Candidate candidate) {
        // Try Redis cache first (reports are immutable)
        try {
            String cached = redisTemplate.opsForValue().get(REPORT_CACHE_PREFIX + interviewId);
            if (cached != null) {
                log.debug("Report cache HIT for interview {}", interviewId);
                return objectMapper.readValue(cached, Map.class);
            }
        } catch (Exception e) {
            log.warn("Redis report cache read failed: {}", e.getMessage());
        }

        // Cache miss — read from DB
        Interview interview = interviewRepository.findById(interviewId)
                .orElseThrow(() -> new RuntimeException("Interview not found: " + interviewId));
        if (!interview.getCandidate().getId().equals(candidate.getId())) {
            throw new RuntimeException("Unauthorized: interview does not belong to this candidate");
        }

        Map<String, Object> report = interview.getDetailedReport();

        // Populate cache for next time
        if (report != null) {
            try {
                redisTemplate.opsForValue().set(
                        REPORT_CACHE_PREFIX + interviewId,
                        objectMapper.writeValueAsString(report),
                        REPORT_CACHE_TTL);
                log.debug("Report cached in Redis for interview {}", interviewId);
            } catch (Exception e) {
                log.warn("Redis report cache write failed: {}", e.getMessage());
            }
        }

        return report;
    }

    // ═══════════════════════════════════════════════════════════════
    //  HISTORY
    // ═══════════════════════════════════════════════════════════════

    public List<InterviewHistoryDTO> getHistory(Candidate candidate) {
        List<Interview> interviews = interviewRepository
                .findByCandidateIdOrderByCreatedAtDesc(candidate.getId());
        return interviews.stream().map(this::toHistoryDTO).collect(Collectors.toList());
    }

    // ═══════════════════════════════════════════════════════════════
    //  DASHBOARD STATS
    // ═══════════════════════════════════════════════════════════════

    public DashboardStatsDTO getDashboardStats(Candidate candidate) {
        // Try Redis cache first (5min TTL)
        String cacheKey = DASHBOARD_CACHE_PREFIX + candidate.getId();
        try {
            String cached = redisTemplate.opsForValue().get(cacheKey);
            if (cached != null) {
                log.debug("Dashboard cache HIT for candidate {}", candidate.getId());
                return objectMapper.readValue(cached, DashboardStatsDTO.class);
            }
        } catch (Exception e) {
            log.warn("Redis dashboard cache read failed: {}", e.getMessage());
        }

        // Cache miss — compute from DB
        List<Interview> interviews = interviewRepository
                .findByCandidateIdOrderByCreatedAtDesc(candidate.getId());

        long totalSessions = interviews.size();
        List<Integer> scores = interviews.stream()
                .filter(i -> i.getFinalScore() != null)
                .map(this::getNormalizedScore)
                .collect(Collectors.toList());

        double avgScore = scores.stream().mapToInt(Integer::intValue).average().orElse(0.0);
        int bestScore = scores.stream().mapToInt(Integer::intValue).max().orElse(0);
        long passed = scores.stream().filter(s -> s >= 60).count();
        double passRate = scores.isEmpty() ? 0.0 : (passed * 100.0) / scores.size();

        DashboardStatsDTO stats = new DashboardStatsDTO(
            totalSessions,
            Math.round(avgScore * 10.0) / 10.0,
            Math.round(passRate * 10.0) / 10.0,
            bestScore
        );

        // Populate cache
        try {
            redisTemplate.opsForValue().set(
                    cacheKey, objectMapper.writeValueAsString(stats), DASHBOARD_CACHE_TTL);
        } catch (Exception e) {
            log.warn("Redis dashboard cache write failed: {}", e.getMessage());
        }

        return stats;
    }

    // ═══════════════════════════════════════════════════════════════
    //  JOB PROFILES — User-facing list for Mode B dropdown
    // ═══════════════════════════════════════════════════════════════

    public List<Map<String, Object>> getAllJobProfiles() {
        return jobProfileRepository.findAll().stream()
                .filter(p -> !p.getMcqQuestions().isEmpty())  // only show profiles with questions
                .map(p -> Map.<String, Object>of("id", p.getId(), "title", toTitleCase(p.getNormalizedTitle())))
                .collect(Collectors.toList());
    }

    // ── Helpers ─────────────────────────────────────────────────

    private McqQuestionDTO toMcqDTO(McqQuestion q) {
        McqQuestionDTO dto = new McqQuestionDTO(
            q.getQuestionText(),
            q.getChoices(),
            q.getScore(),
            q.getAverageTimeSec(),
            q.getChoices().indexOf(q.getCorrectAnswer())
        );
        // Set job profile title from linked profiles (first match)
        if (q.getJobProfiles() != null && !q.getJobProfiles().isEmpty()) {
            dto.setJobProfileTitle(toTitleCase(q.getJobProfiles().iterator().next().getNormalizedTitle()));
        }
        return dto;
    }

    @SuppressWarnings("unchecked")
    private int getNormalizedScore(Interview i) {
        Integer finalScore = i.getFinalScore();
        if (finalScore == null) return 0;
        if (i.getDetailedReport() == null) return finalScore;

        Map<String, Object> rep = i.getDetailedReport();
        int mcqMax = 0;
        if (rep.get("rawMcqSolutions") instanceof List) {
            for (Object item : (List<?>) rep.get("rawMcqSolutions")) {
                if (item instanceof Map) {
                    Map<String, Object> m = (Map<String, Object>) item;
                    Number max = (Number) m.get("maxScore");
                    mcqMax += (max != null) ? max.intValue() : 10;
                }
            }
        }
        int codingMax = 0;
        if (rep.get("rawCodingSolutions") instanceof List) {
            for (Object item : (List<?>) rep.get("rawCodingSolutions")) {
                if (item instanceof Map) {
                    Map<String, Object> c = (Map<String, Object>) item;
                    Number max = (Number) c.get("questionScore");
                    codingMax += (max != null) ? max.intValue() : 10;
                }
            }
        }
        int totalMax = mcqMax + codingMax;
        if (totalMax > 0) {
            return (int) Math.round((finalScore.doubleValue() / totalMax) * 100.0);
        }
        return finalScore;
    }

    @SuppressWarnings("unchecked")
    private InterviewHistoryDTO toHistoryDTO(Interview i) {
        InterviewHistoryDTO dto = new InterviewHistoryDTO();
        dto.setId(i.getId());
        dto.setRole(i.getJobProfile() != null ? toTitleCase(i.getJobProfile().getNormalizedTitle()) : "Custom Interview");
        dto.setDate(i.getCreatedAt().format(DATE_FMT));
        dto.setDurationSec(i.getDurationSec());
        dto.setStatus(i.getDetailedReport() != null ? "Completed" : "In Progress");

        Integer finalScore = i.getFinalScore();
        if (finalScore != null) {
            dto.setFinalScore(getNormalizedScore(i));
        } else {
            dto.setFinalScore(null);
        }

        List<String> skills = new ArrayList<>();
        if (i.getDetailedReport() != null && i.getDetailedReport().containsKey("domainAnalysis")) {
            Object domainRaw = i.getDetailedReport().get("domainAnalysis");
            if (domainRaw instanceof Map) {
                Map<String, Object> domain = (Map<String, Object>) domainRaw;
                Object tpRaw = domain.get("topicPerformance");
                if (tpRaw instanceof List) {
                    for (Object entry : (List<?>) tpRaw) {
                        if (entry instanceof Map) {
                            Object topic = ((Map<String, Object>) entry).get("topic");
                            if (topic != null) skills.add(topic.toString());
                        }
                    }
                }
            }
        }
        dto.setSkills(skills);
        return dto;
    }

    /** Convert any object to JSON string safely */
    private String toJson(Object obj) {
        try {
            return objectMapper.writeValueAsString(obj);
        } catch (JsonProcessingException e) {
            log.warn("Failed to serialize object to JSON: {}", e.getMessage());
            return "{}";
        }
    }

    /** Convert a DTO to Map<String, Object> for JSONB storage */
    @SuppressWarnings("unchecked")
    private Map<String, Object> toMap(Object dto) {
        return objectMapper.convertValue(dto, Map.class);
    }

    /** Convert a normalized lowercase title to Title Case (e.g. "backend engineer" → "Backend Engineer") */
    private String toTitleCase(String input) {
        if (input == null || input.isBlank()) return input;
        String[] words = input.strip().split("\\s+");
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < words.length; i++) {
            if (i > 0) sb.append(' ');
            sb.append(Character.toUpperCase(words[i].charAt(0)));
            if (words[i].length() > 1) sb.append(words[i].substring(1));
        }
        return sb.toString();
    }
}
