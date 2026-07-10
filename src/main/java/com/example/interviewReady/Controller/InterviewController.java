package com.example.interviewReady.Controller;

import java.security.Principal;
import java.util.List;
import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.example.interviewReady.DTO.DashboardStatsDTO;
import com.example.interviewReady.DTO.InterviewHistoryDTO;
import com.example.interviewReady.Model.Candidate;
import com.example.interviewReady.Model.User;
import com.example.interviewReady.Repository.UserRepository;
import com.example.interviewReady.Service.CandidateService;
import com.example.interviewReady.Service.InterviewService;

@RestController
@RequestMapping("/user/interviews")
public class InterviewController {

    private final InterviewService interviewService;
    private final CandidateService candidateService;
    private final UserRepository userRepository;

    public InterviewController(InterviewService interviewService,
                               CandidateService candidateService,
                               UserRepository userRepository) {
        this.interviewService = interviewService;
        this.candidateService = candidateService;
        this.userRepository = userRepository;
    }

    /**
     * POST /user/interviews/start
     * Body Option A: { "jobDescription": "..." } → custom JD, LLM generates questions
     * Body Option B: { "jobTitle": "Backend Engineer" } → template, loads from DB
     * Both return: { interviewId, mcqQuestions, codingQuestions }
     */
    @PostMapping("/start")
    public ResponseEntity<?> startInterview(Principal principal, @RequestBody Map<String, Object> body) {
        Candidate candidate = resolveCandidate(principal);

        try {
            if (body.containsKey("jobDescription")) {
                String jd = (String) body.get("jobDescription");
                Map<String, Object> result = interviewService.startWithCustomJD(candidate, jd);
                return ResponseEntity.ok(result);

            } else if (body.containsKey("jobTitle")) {
                String title = (String) body.get("jobTitle");
                Map<String, Object> result = interviewService.startWithTemplate(candidate, title);
                return ResponseEntity.ok(result);

            } else {
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "Must provide either 'jobDescription' or 'jobTitle'"));
            }
        } catch (RuntimeException e) {
            String msg = e.getMessage();
            if (msg.contains("Quota exhausted")) {
                return ResponseEntity.status(403).body(Map.of("error", msg));
            }
            if (msg.contains("not found") || msg.contains("no questions")) {
                return ResponseEntity.badRequest().body(Map.of("error", msg));
            }
            return ResponseEntity.status(500).body(Map.of("error", msg));
        }
    }

    /**
     * POST /user/interviews/{id}/report
     * Receives raw data (behaviorData, mcqSolutions, codingSolutions, timeTaken, securityFlags).
     * Backend orchestrates 4 LLM calls, calculates finalScore, merges, saves, returns full report.
     */
    @PostMapping("/{id}/report")
    public ResponseEntity<?> generateReport(@PathVariable Long id,
                                            @RequestBody Map<String, Object> rawInput,
                                            Principal principal) {
        Candidate candidate = resolveCandidate(principal);
        try {
            Map<String, Object> report = interviewService.generateAndSaveReport(id, rawInput, candidate);
            return ResponseEntity.ok(report);
        } catch (RuntimeException e) {
            return ResponseEntity.status(500).body(Map.of("message", e.getMessage()));
        }
    }

    /**
     * GET /user/interviews/{id}/report — Retrieve a specific interview's report.
     */
    @GetMapping("/{id}/report")
    public ResponseEntity<?> getReport(@PathVariable Long id, Principal principal) {
        Candidate candidate = resolveCandidate(principal);
        try {
            Map<String, Object> report = interviewService.getReport(id, candidate);
            if (report == null) {
                return ResponseEntity.status(404).body(Map.of("error", "Report not yet generated"));
            }
            return ResponseEntity.ok(report);
        } catch (RuntimeException e) {
            return ResponseEntity.status(403).body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * GET /user/interviews/history — All past interviews for the authenticated candidate.
     */
    @GetMapping("/history")
    public ResponseEntity<List<InterviewHistoryDTO>> getHistory(Principal principal) {
        Candidate candidate = resolveCandidate(principal);
        return ResponseEntity.ok(interviewService.getHistory(candidate));
    }

    /**
     * GET /user/interviews/dashboard-stats — Aggregate stats for dashboard cards.
     */
    @GetMapping("/dashboard-stats")
    public ResponseEntity<DashboardStatsDTO> getDashboardStats(Principal principal) {
        Candidate candidate = resolveCandidate(principal);
        return ResponseEntity.ok(interviewService.getDashboardStats(candidate));
    }

    // ═══════════════════════════════════════════════════════════════
    //  GET /user/interviews/job-profiles — List available templates
    // ═══════════════════════════════════════════════════════════════

    @GetMapping("/job-profiles")
    public ResponseEntity<?> getJobProfiles() {
        return ResponseEntity.ok(interviewService.getAllJobProfiles());
    }

    // ── Helper ─────────────────────────────────────────────────
    private Candidate resolveCandidate(Principal principal) {
        User user = userRepository.findByUsername(principal.getName());
        return candidateService.getByUserId(user.getId());
    }
}
