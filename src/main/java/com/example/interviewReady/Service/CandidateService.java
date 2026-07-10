package com.example.interviewReady.Service;

import java.time.LocalDateTime;

import org.springframework.stereotype.Service;

import com.example.interviewReady.DTO.CandidateDTO;
import com.example.interviewReady.Model.Candidate;
import com.example.interviewReady.Model.Subscription;
import com.example.interviewReady.Model.User;
import com.example.interviewReady.Repository.CandidateRepository;

@Service
public class CandidateService {

    private final CandidateRepository candidateRepository;
    private final SubscriptionService subscriptionService;
    private final S3Service s3Service;
    private final QuotaService quotaService;

    public CandidateService(CandidateRepository candidateRepository,
                            SubscriptionService subscriptionService,
                            S3Service s3Service,
                            QuotaService quotaService) {
        this.candidateRepository = candidateRepository;
        this.subscriptionService = subscriptionService;
        this.s3Service = s3Service;
        this.quotaService = quotaService;
    }

    /**
     * Create a Candidate profile for a newly registered User.
     * Auto-assigns the FREE subscription plan.
     */
    public Candidate createProfile(User user, String firstName, String lastName) {
        Subscription freePlan = subscriptionService.getFreePlan();

        Candidate candidate = new Candidate();
        candidate.setUser(user);
        candidate.setFirstName(firstName);
        candidate.setLastName(lastName);
        candidate.setEmail(user.getEmail());
        candidate.setSubscription(freePlan);
        candidate.setSubscribedAt(LocalDateTime.now());
        candidate.setRemainingQuota(freePlan.getCredits());

        return candidateRepository.save(candidate);
    }

    /**
     * Get candidate by the authenticated User's ID.
     */
    public Candidate getByUserId(Long userId) {
        return candidateRepository.findByUserId(userId)
                .orElseThrow(() -> new RuntimeException("Candidate profile not found for user: " + userId));
    }

    /**
     * Convert entity to public-facing DTO (no password, no internals).
     * Uses QuotaService.getRemainingQuota() so that an expired cooldown
     * is auto-reset before the DTO is built — the front-end always gets
     * the correct remaining quota.
     */
    public CandidateDTO toDTO(Candidate c) {
        // Resolve image URL: Google → as-is, S3 key → pre-signed URL, null → null
        String imageUrl = resolveImageUrl(c.getProfileImageUrl());

        // Trigger auto-reset if the 24h cooldown has elapsed
        int liveQuota = quotaService.getRemainingQuota(c);

        return new CandidateDTO(
            c.getId(),
            c.getFirstName(),
            c.getLastName(),
            c.getEmail(),
            imageUrl,
            c.getSubscription().getPlanName(),
            liveQuota,
            c.getSubscription().getCredits(),
            c.getResetsAt() != null ? c.getResetsAt().atZone(java.time.ZoneId.systemDefault()).toInstant().toString() : null,
            c.getAuthProvider()
        );
    }

    /**
     * If profileImageUrl is an S3 key (not a full URL), resolve to presigned download URL.
     * Google avatar URLs (https://...) pass through unchanged.
     */
    private String resolveImageUrl(String url) {
        if (url == null) return null;
        if (url.startsWith("http")) return url;  // Google or already resolved
        return s3Service.generateDownloadUrl(url); // S3 key → 1hr presigned URL
    }

    /**
     * Update profile image URL (S3 key).
     */
    public Candidate updateProfileImage(Long userId, String imageUrl) {
        Candidate candidate = getByUserId(userId);
        candidate.setProfileImageUrl(imageUrl);
        return candidateRepository.save(candidate);
    }

    /**
     * Upgrade subscription plan.
     */
    public Candidate upgradePlan(Long userId, String planName) {
        Candidate candidate = getByUserId(userId);
        Subscription newPlan = subscriptionService.getByPlanName(planName);
        candidate.setSubscription(newPlan);
        candidate.setRemainingQuota(newPlan.getCredits());
        candidate.setSubscribedAt(LocalDateTime.now());
        candidate.setResetsAt(null);
        return candidateRepository.save(candidate);
    }

    /**
     * Update candidate's first and last name.
     */
    public Candidate updateProfile(Long userId, String firstName, String lastName) {
        Candidate candidate = getByUserId(userId);
        if (firstName != null && !firstName.isBlank()) {
            candidate.setFirstName(firstName);
        }
        if (lastName != null && !lastName.isBlank()) {
            candidate.setLastName(lastName);
        }
        return candidateRepository.save(candidate);
    }
}
