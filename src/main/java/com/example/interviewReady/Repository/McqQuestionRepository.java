package com.example.interviewReady.Repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.example.interviewReady.Model.McqQuestion;

public interface McqQuestionRepository extends JpaRepository<McqQuestion, Long> {
    List<McqQuestion> findByDifficulty(String difficulty);
}
