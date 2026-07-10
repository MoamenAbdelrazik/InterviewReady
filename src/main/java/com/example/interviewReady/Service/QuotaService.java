package com.example.interviewReady.Service;

import java.time.Duration;
import java.time.LocalDateTime;

import org.springframework.stereotype.Service;

import com.example.interviewReady.Model.Candidate;
import com.example.interviewReady.Repository.CandidateRepository;

@Service
public class QuotaService {

    private final CandidateRepository candidateRepository;

    public QuotaService(CandidateRepository candidateRepository) {
        this.candidateRepository = candidateRepository;
    }

    /**
     * Check if the candidate can start a new interview.
     * If quota is 0, checks if 24h have passed since resetsAt.
     * If 24h passed → resets quota and allows.
     * Otherwise → throws with time remaining.
     */
    public void consumeQuota(Candidate candidate) {
        // Try auto-reset if quota is 0 and 24h passed
        if (candidate.getRemainingQuota() <= 0) {
            if (candidate.getResetsAt() != null && LocalDateTime.now().isAfter(candidate.getResetsAt())) {
                // 24h passed — reset
                candidate.setRemainingQuota(candidate.getSubscription().getCredits());
                candidate.setResetsAt(null);
                candidateRepository.save(candidate);
            } else {
                // Still cooling down
                String timeLeft = "unknown";
                if (candidate.getResetsAt() != null) {
                    Duration remaining = Duration.between(LocalDateTime.now(), candidate.getResetsAt());
                    long hours = remaining.toHours();
                    long minutes = remaining.toMinutesPart();
                    timeLeft = hours + "h " + minutes + "m";
                }
                throw new RuntimeException("Quota exhausted. Resets in " + timeLeft);
            }
        }

        // Decrement quota
        candidate.setRemainingQuota(candidate.getRemainingQuota() - 1);

        // If quota just hit 0, set the 24h reset timer
        if (candidate.getRemainingQuota() <= 0) {
            candidate.setResetsAt(LocalDateTime.now().plusHours(24));
        }

        candidateRepository.save(candidate);
    }

    /**
     * Get remaining quota info for display.
     */
    public int getRemainingQuota(Candidate candidate) {
        // Auto-reset check on read too
        if (candidate.getRemainingQuota() <= 0
                && candidate.getResetsAt() != null
                && LocalDateTime.now().isAfter(candidate.getResetsAt())) {
            candidate.setRemainingQuota(candidate.getSubscription().getCredits());
            candidate.setResetsAt(null);
            candidateRepository.save(candidate);
        }
        return candidate.getRemainingQuota();
    }
}
