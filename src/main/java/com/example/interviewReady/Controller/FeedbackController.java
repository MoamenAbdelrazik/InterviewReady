package com.example.interviewReady.Controller;

import java.security.Principal;
import java.util.List;
import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.example.interviewReady.Model.Candidate;
import com.example.interviewReady.Model.User;
import com.example.interviewReady.Repository.UserRepository;
import com.example.interviewReady.Service.CandidateService;
import com.example.interviewReady.Service.FeedbackService;

@RestController
@RequestMapping("/user/feedbacks")
public class FeedbackController {

    private final FeedbackService feedbackService;
    private final CandidateService candidateService;
    private final UserRepository userRepository;

    public FeedbackController(FeedbackService feedbackService,
                              CandidateService candidateService,
                              UserRepository userRepository) {
        this.feedbackService = feedbackService;
        this.candidateService = candidateService;
        this.userRepository = userRepository;
    }

    /**
     * POST /user/feedbacks — Submit platform feedback.
     * Body: { "rating": 4, "category": "FEATURE", "message": "Great platform..." }
     */
    @PostMapping
    public ResponseEntity<Map<String, String>> submit(Principal principal,
                                                       @RequestBody Map<String, Object> body) {
        Candidate candidate = resolveCandidate(principal);

        try {
            Integer rating = body.get("rating") != null ? ((Number) body.get("rating")).intValue() : null;
            String category = (String) body.get("category");
            String message = (String) body.get("message");

            feedbackService.submitFeedback(candidate, rating, category, message);
            return ResponseEntity.ok(Map.of("message", "Feedback submitted successfully"));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * GET /user/feedbacks — Get all my submitted feedbacks.
     */
    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> getMyFeedbacks(Principal principal) {
        Candidate candidate = resolveCandidate(principal);
        return ResponseEntity.ok(feedbackService.getMyFeedbacks(candidate));
    }

    // ── Helper ─────────────────────────────────────────────────
    private Candidate resolveCandidate(Principal principal) {
        User user = userRepository.findByUsername(principal.getName());
        return candidateService.getByUserId(user.getId());
    }
}
