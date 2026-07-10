package com.example.interviewReady.Controller;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.example.interviewReady.DTO.CodingDTO;
import com.example.interviewReady.DTO.CodingGenerationDTO;
import com.example.interviewReady.DTO.McqDTO;
import com.example.interviewReady.DTO.McqGenerationDTO;
import com.example.interviewReady.DTO.McqQuestionDTO;
import com.example.interviewReady.DTO.QuestionGenerationDTO;
import com.example.interviewReady.Model.CodingQuestion;
import com.example.interviewReady.Model.JobProfile;
import com.example.interviewReady.Model.McqQuestion;
import com.example.interviewReady.Repository.CodingQuestionRepository;
import com.example.interviewReady.Repository.JobProfileRepository;
import com.example.interviewReady.Repository.McqQuestionRepository;
import com.example.interviewReady.Service.LlmService;
import com.example.interviewReady.Service.JobProfileService;

@RestController
@RequestMapping("/api/questions")
public class QuestionController {

    private static final Logger log = LoggerFactory.getLogger(QuestionController.class);

    private final LlmService llmService;
    private final JobProfileRepository jobProfileRepository;
    private final CodingQuestionRepository codingQuestionRepository;
    private final McqQuestionRepository mcqQuestionRepository;

    public QuestionController(LlmService llmService,
                              JobProfileRepository jobProfileRepository,
                              CodingQuestionRepository codingQuestionRepository,
                              McqQuestionRepository mcqQuestionRepository) {
        this.llmService = llmService;
        this.jobProfileRepository = jobProfileRepository;
        this.codingQuestionRepository = codingQuestionRepository;
        this.mcqQuestionRepository = mcqQuestionRepository;
    }

    /**
     * Generate MCQ questions from a Job Description via LLM.
     * Persists generated MCQs to DB and auto-tags them to a JobProfile.
     * If the LLM-returned jobProfileTitle doesn't exist, a new profile is created.
     */
    @PostMapping("/generate-mcq")
    public ResponseEntity<McqGenerationDTO> generateMcq(@RequestBody String jobDescription) {
        McqGenerationDTO result = llmService.generateMcqQuestions(jobDescription);

        // ── Persist to DB ──────────────────────────────────────
        try {
            String profileTitle = result.getJobProfileTitle();

            // Find or create JobProfile (normalized dedup)
            String normalized = JobProfileService.normalizeTitle(profileTitle);
            JobProfile profile = jobProfileRepository.findByNormalizedTitle(normalized);
            if (profile == null) {
                profile = jobProfileRepository.save(new JobProfile(normalized));
                log.info("New JobProfile created from LLM: '{}' (normalized: '{}')", profileTitle, normalized);
            }

            // Map McqDTO → McqQuestion entity, save, and tag to profile
            for (McqDTO dto : result.getMcq()) {
                McqQuestion entity = new McqQuestion();
                entity.setQuestionText(dto.getQuestion());
                entity.setChoices(dto.getChoices());
                int answerIdx = dto.getAnswer();
                if (answerIdx < 0 || answerIdx >= dto.getChoices().size()) {
                    log.warn("LLM returned invalid answer index {} for MCQ, defaulting to 0", answerIdx);
                    answerIdx = 0;
                }
                entity.setCorrectAnswer(dto.getChoices().get(answerIdx));
                entity.setDifficulty(dto.getDifficultyLevel());
                entity.setScore(dto.getScore());
                entity.setAverageTimeSec(dto.getAvgTimeSec());

                McqQuestion saved = mcqQuestionRepository.save(entity);
                profile.getMcqQuestions().add(saved);
            }

            jobProfileRepository.save(profile); // persist M:N tags
            log.info("Persisted {} MCQs to DB, tagged to profile '{}'", result.getMcq().size(), profileTitle);
        } catch (Exception e) {
            // Persistence failure should NOT block the response — questions were generated
            log.warn("Failed to persist LLM-generated MCQs: {}", e.getMessage());
        }

        return ResponseEntity.ok(result);
    }

    /**
     * Generate Coding problems from a Job Description via LLM.
     * Persists generated coding questions to DB (standalone, no profile tagging).
     */
    @PostMapping("/generate-coding")
    public ResponseEntity<CodingGenerationDTO> generateCoding(@RequestBody String jobDescription) {
        CodingGenerationDTO result = llmService.generateCodingQuestions(jobDescription);

        // ── Persist to DB ──────────────────────────────────────
        try {
            for (CodingDTO dto : result.getCoding()) {
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
            log.info("Persisted {} coding questions to DB", result.getCoding().size());
        } catch (Exception e) {
            log.warn("Failed to persist LLM-generated coding questions: {}", e.getMessage());
        }

        return ResponseEntity.ok(result);
    }

    /**
     * @deprecated Use /generate-mcq + /generate-coding in parallel instead.
     * Legacy combined endpoint — kept for backward compatibility.
     */
    @Deprecated
    @PostMapping("/generate")
    public ResponseEntity<QuestionGenerationDTO> generateQuestions(@RequestBody String jobDescription) {
        QuestionGenerationDTO result = llmService.generateQuestions(jobDescription);
        return ResponseEntity.ok(result);
    }

    /**
     * GET /api/questions/by-role/{roleId}
     * Load predefined MCQ + Coding questions from DB by job_profile_id.
     * MCQs come from the M:N join table (up to 12), coding from global pool (1 EASY + 1 MEDIUM).
     * MCQ responses STRIP correctAnswer to prevent cheating.
     */
    @GetMapping("/by-role/{roleId}")
    public ResponseEntity<?> getByRole(@PathVariable Long roleId) {
        JobProfile profile = jobProfileRepository.findById(roleId)
                .orElse(null);

        if (profile == null) {
            return ResponseEntity.status(404).body(Map.of("error", "Job profile not found: " + roleId));
        }

        // MCQs tagged to this profile (up to 12, shuffled)
        Set<McqQuestion> taggedMcqs = profile.getMcqQuestions();
        List<McqQuestion> mcqList = new ArrayList<>(taggedMcqs);
        Collections.shuffle(mcqList);
        List<McqQuestionDTO> mcqDtos = mcqList.stream()
                .limit(12)
                .map(q -> new McqQuestionDTO(
                    q.getQuestionText(),
                    q.getChoices(),
                    q.getScore(),
                    q.getAverageTimeSec(),
                    q.getChoices().indexOf(q.getCorrectAnswer())
                ))
                .collect(Collectors.toList());

        // 2 random coding questions (1 EASY + 1 MEDIUM)
        List<CodingQuestion> easyCoding = codingQuestionRepository.findByDifficulty("EASY");
        List<CodingQuestion> mediumCoding = codingQuestionRepository.findByDifficulty("MEDIUM");
        Collections.shuffle(easyCoding);
        Collections.shuffle(mediumCoding);

        List<CodingQuestion> codingPick = new ArrayList<>();
        if (!easyCoding.isEmpty()) codingPick.add(easyCoding.get(0));
        if (!mediumCoding.isEmpty()) codingPick.add(mediumCoding.get(0));

        return ResponseEntity.ok(Map.of(
            "role", profile.getNormalizedTitle(),
            "mcqQuestions", mcqDtos,
            "codingQuestions", codingPick
        ));
    }
}


