package com.example.interviewReady.DTO;

import java.util.List;

import com.fasterxml.jackson.annotation.JsonProperty;

public class CodingDTO {

    private String title;                // e.g. "Two Sum", "Palindrome Check"
    private String problem;
    private List<String> input;
    private List<String> output;
    private List<String> constraints;
    private java.util.Map<String, String> starterCode; // { "java": "...", "cpp": "...", "python": "...", "js": "..." }
    private int score;
    private int avgTimeSec;
    @JsonProperty(access = JsonProperty.Access.WRITE_ONLY)
    private String difficultyLevel;

    // ─── Getters & Setters ───

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getProblem() { return problem; }
    public void setProblem(String problem) { this.problem = problem; }

    public List<String> getInput() { return input; }
    public void setInput(List<String> input) { this.input = input; }

    public List<String> getOutput() { return output; }
    public void setOutput(List<String> output) { this.output = output; }

    public List<String> getConstraints() { return constraints; }
    public void setConstraints(List<String> constraints) { this.constraints = constraints; }

    public java.util.Map<String, String> getStarterCode() { return starterCode; }
    public void setStarterCode(java.util.Map<String, String> starterCode) { this.starterCode = starterCode; }

    public int getScore() { return score; }
    public void setScore(int score) { this.score = score; }

    public int getAvgTimeSec() { return avgTimeSec; }
    public void setAvgTimeSec(int avgTimeSec) { this.avgTimeSec = avgTimeSec; }

    public String getDifficultyLevel() { return difficultyLevel; }
    public void setDifficultyLevel(String difficultyLevel) { this.difficultyLevel = difficultyLevel; }
}
