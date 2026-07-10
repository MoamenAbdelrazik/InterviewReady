package com.example.interviewReady.Model;

import java.util.List;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "coding_question")
public class CodingQuestion {

    @JsonIgnore
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @JsonProperty("problem")
    @Column(nullable = false, columnDefinition = "TEXT")
    private String problemStatement;

    @JsonProperty("input")
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false, columnDefinition = "jsonb")
    private List<String> inputs; // ["[1,2,3]", "5 10"]

    @JsonProperty("output")
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false, columnDefinition = "jsonb")
    private List<String> outputs; // ["6", "15"]

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private List<String> constraints;

    @Column(nullable = false)
    private String title; // e.g. "Two Sum", "Palindrome Check"

    @JsonIgnore
    @Column(nullable = false)
    private String difficulty; // EASY, MEDIUM, HARD

    @Column(nullable = false)
    private Integer score; // 5, 10, 20

    @JsonProperty("avgTimeSec")
    @Column
    private Integer averageTimeSec;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false, columnDefinition = "jsonb")
    private java.util.Map<String, String> starterCode = new java.util.HashMap<>(); // { "java": "...", "cpp": "...", "python": "...", "js": "..." }

    public CodingQuestion() {}

    public Long getId() { return id; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getProblemStatement() { return problemStatement; }
    public void setProblemStatement(String problemStatement) { this.problemStatement = problemStatement; }

    public List<String> getInputs() { return inputs; }
    public void setInputs(List<String> inputs) { this.inputs = inputs; }

    public List<String> getOutputs() { return outputs; }
    public void setOutputs(List<String> outputs) { this.outputs = outputs; }

    public List<String> getConstraints() { return constraints; }
    public void setConstraints(List<String> constraints) { this.constraints = constraints; }

    public String getDifficulty() { return difficulty; }
    public void setDifficulty(String difficulty) { this.difficulty = difficulty; }

    public Integer getScore() { return score; }
    public void setScore(Integer score) { this.score = score; }

    public Integer getAverageTimeSec() { return averageTimeSec; }
    public void setAverageTimeSec(Integer averageTimeSec) { this.averageTimeSec = averageTimeSec; }

    public java.util.Map<String, String> getStarterCode() { return starterCode; }
    public void setStarterCode(java.util.Map<String, String> starterCode) { this.starterCode = starterCode; }
}
