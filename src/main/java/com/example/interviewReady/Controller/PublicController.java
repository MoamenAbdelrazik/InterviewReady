package com.example.interviewReady.Controller;

import java.util.List;
import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.example.interviewReady.Service.FeedbackService;

/**
 * Public (unauthenticated) endpoints for the landing page.
 */
@RestController
@RequestMapping("/public")
public class PublicController {

    private final FeedbackService feedbackService;

    public PublicController(FeedbackService feedbackService) {
        this.feedbackService = feedbackService;
    }

    /**
     * GET /public/testimonials — Returns top-rated feedbacks for the landing page.
     * No authentication required.
     */
    @GetMapping("/testimonials")
    public ResponseEntity<List<Map<String, Object>>> getTestimonials() {
        return ResponseEntity.ok(feedbackService.getPublicTestimonials());
    }
}
