package com.example.interviewReady.Controller;

import java.security.Principal;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.example.interviewReady.DTO.CandidateDTO;
import com.example.interviewReady.Model.Candidate;
import com.example.interviewReady.Model.User;
import com.example.interviewReady.Repository.UserRepository;
import com.example.interviewReady.Service.CandidateService;

import java.util.Map;

@RestController
@RequestMapping("/user/profile")
public class CandidateController {

    private final CandidateService candidateService;
    private final UserRepository userRepository;

    public CandidateController(CandidateService candidateService, UserRepository userRepository) {
        this.candidateService = candidateService;
        this.userRepository = userRepository;
    }

    /**
     * GET /user/profile — Returns the authenticated candidate's profile.
     * Used by the dashboard sidebar (name, plan, quota, reset timer).
     */
    @GetMapping
    public ResponseEntity<CandidateDTO> getProfile(Principal principal) {
        Candidate candidate = resolveCandidate(principal);
        return ResponseEntity.ok(candidateService.toDTO(candidate));
    }

    /**
     * PUT /user/profile/image — Update profile image URL.
     * Body: { "imageUrl": "s3-key-here" }
     */
    @PutMapping("/image")
    public ResponseEntity<Map<String, String>> updateImage(Principal principal,
                                                            @RequestBody Map<String, String> body) {
        Candidate candidate = resolveCandidate(principal);
        candidateService.updateProfileImage(candidate.getUser().getId(), body.get("imageUrl"));
        return ResponseEntity.ok(Map.of("message", "Profile image updated"));
    }

    /**
     * PUT /user/profile/upgrade — Upgrade subscription plan.
     * Body: { "planName": "Premium" }
     */
    @PutMapping("/upgrade")
    public ResponseEntity<CandidateDTO> upgradePlan(Principal principal,
                                                     @RequestBody Map<String, String> body) {
        Candidate candidate = resolveCandidate(principal);
        Candidate updated = candidateService.upgradePlan(candidate.getUser().getId(), body.get("planName"));
        return ResponseEntity.ok(candidateService.toDTO(updated));
    }

    // ── Helper ─────────────────────────────────────────────────
    private Candidate resolveCandidate(Principal principal) {
        User user = userRepository.findByUsername(principal.getName());
        return candidateService.getByUserId(user.getId());
    }
}
