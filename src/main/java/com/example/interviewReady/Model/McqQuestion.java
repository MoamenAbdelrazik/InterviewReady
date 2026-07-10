package com.example.interviewReady.Model;

import java.util.HashSet;
import java.util.Set;

import com.fasterxml.jackson.annotation.JsonIgnore;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.Table;

@Entity
@Table(name = "mcq_question")
public class McqQuestion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String questionText;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false, columnDefinition = "jsonb")
    private java.util.List<String> choices; // ["Option A", "Option B", "Option C", "Option D"]

    @Column(nullable = false)
    private String correctAnswer;

    @Column(nullable = false)
    private String difficulty; // EASY, MEDIUM, HARD

    @Column(nullable = false)
    private Integer score; // 5, 10, 20

    @Column
    private Integer averageTimeSec;

    @JsonIgnore
    @ManyToMany(mappedBy = "mcqQuestions")
    private Set<JobProfile> jobProfiles = new HashSet<>();

    public McqQuestion() {}

    public Long getId() { return id; }

    public String getQuestionText() { return questionText; }
    public void setQuestionText(String questionText) { this.questionText = questionText; }

    public java.util.List<String> getChoices() { return choices; }
    public void setChoices(java.util.List<String> choices) { this.choices = choices; }

    public String getCorrectAnswer() { return correctAnswer; }
    public void setCorrectAnswer(String correctAnswer) { this.correctAnswer = correctAnswer; }

    public String getDifficulty() { return difficulty; }
    public void setDifficulty(String difficulty) { this.difficulty = difficulty; }

    public Integer getScore() { return score; }
    public void setScore(Integer score) { this.score = score; }

    public Integer getAverageTimeSec() { return averageTimeSec; }
    public void setAverageTimeSec(Integer averageTimeSec) { this.averageTimeSec = averageTimeSec; }

    public Set<JobProfile> getJobProfiles() { return jobProfiles; }
    public void setJobProfiles(Set<JobProfile> jobProfiles) { this.jobProfiles = jobProfiles; }
}
