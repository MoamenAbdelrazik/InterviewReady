package com.example.interviewReady.Repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.example.interviewReady.Model.CodingQuestion;

public interface CodingQuestionRepository extends JpaRepository<CodingQuestion, Long> {
    List<CodingQuestion> findByDifficulty(String difficulty);
}
