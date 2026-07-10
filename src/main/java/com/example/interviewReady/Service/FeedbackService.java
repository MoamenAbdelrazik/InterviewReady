package com.example.interviewReady.Service;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;

import com.example.interviewReady.Model.Candidate;
import com.example.interviewReady.Model.Feedback;
import com.example.interviewReady.Repository.FeedbackRepository;

@Service
public class FeedbackService {

    private final FeedbackRepository feedbackRepository;
    private final S3Service s3Service;

    public FeedbackService(FeedbackRepository feedbackRepository, S3Service s3Service) {
        this.feedbackRepository = feedbackRepository;
        this.s3Service = s3Service;
    }

    /**
     * Submit feedback from the dashboard form.
     * Validates rating (1-5) and category before saving.
     */
    public Feedback submitFeedback(Candidate candidate, Integer rating, String category, String message) {
        if (rating == null || rating < 1 || rating > 5) {
            throw new RuntimeException("Rating must be between 1 and 5");
        }

        List<String> validCategories = List.of("GENERAL", "BUG", "FEATURE", "TECHNICAL");
        String upperCategory = category != null ? category.toUpperCase() : "";
        if (!validCategories.contains(upperCategory)) {
            throw new RuntimeException("Invalid category. Must be one of: " + validCategories);
        }

        if (message == null || message.trim().isEmpty()) {
            throw new RuntimeException("Message cannot be empty");
        }

        Feedback feedback = new Feedback();
        feedback.setCandidate(candidate);
        feedback.setRating(rating);
        feedback.setCategory(upperCategory);
        feedback.setMessage(message.trim());

        return feedbackRepository.save(feedback);
    }

    /**
     * Get all feedbacks for a candidate, newest first.
     */
    public List<Map<String, Object>> getMyFeedbacks(Candidate candidate) {
        List<Feedback> feedbacks = feedbackRepository
                .findByCandidateIdOrderByCreatedAtDesc(candidate.getId());

        return feedbacks.stream().map(f -> Map.<String, Object>of(
            "id", f.getId(),
            "rating", f.getRating(),
            "category", f.getCategory(),
            "message", f.getMessage(),
            "createdAt", f.getCreatedAt().toString()
        )).collect(Collectors.toList());
    }

    /**
     * Get top-rated feedbacks for the public landing page testimonials.
     * Returns feedbacks rated 4+ stars with candidate name and photo (no auth required).
     */
    public List<Map<String, Object>> getPublicTestimonials() {
        List<Feedback> feedbacks = feedbackRepository
                .findTop10ByRatingGreaterThanEqualOrderByCreatedAtDesc(1);

        return feedbacks.stream().map(f -> {
            Candidate c = f.getCandidate();
            String imgUrl = c.getProfileImageUrl();
            // Generate presigned URL for S3 keys (private bucket), pass through Google URLs
            if (imgUrl != null && !imgUrl.isEmpty() && !imgUrl.startsWith("http")) {
                imgUrl = s3Service.generateDownloadUrl(imgUrl);
            }
            java.util.Map<String, Object> map = new java.util.HashMap<>();
            map.put("rating", f.getRating());
            map.put("message", f.getMessage());
            map.put("firstName", c.getFirstName());
            map.put("lastInitial", c.getLastName() != null && !c.getLastName().isEmpty()
                    ? c.getLastName().substring(0, 1) + "." : "");
            map.put("profileImageUrl", imgUrl);
            map.put("createdAt", f.getCreatedAt().toString());
            return map;
        }).collect(Collectors.toList());
    }
}
