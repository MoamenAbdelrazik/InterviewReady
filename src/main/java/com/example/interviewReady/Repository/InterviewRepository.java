package com.example.interviewReady.Repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.example.interviewReady.Model.Interview;

public interface InterviewRepository extends JpaRepository<Interview, Long> {
    List<Interview> findByCandidateIdOrderByCreatedAtDesc(Long candidateId);
    long countByCandidateId(Long candidateId);
    void deleteByCandidateId(Long candidateId);
}
