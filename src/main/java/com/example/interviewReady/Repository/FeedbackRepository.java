package com.example.interviewReady.Repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.example.interviewReady.Model.Feedback;

public interface FeedbackRepository extends JpaRepository<Feedback, Long> {
    List<Feedback> findByCandidateIdOrderByCreatedAtDesc(Long candidateId);
    void deleteByCandidateId(Long candidateId);
    List<Feedback> findTop10ByRatingGreaterThanEqualOrderByCreatedAtDesc(Integer rating);
}
