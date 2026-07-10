package com.example.interviewReady.DTO;

import java.util.List;

import com.fasterxml.jackson.annotation.JsonProperty;

public class McqDTO {

    private String question;
    private List<String> choices;
    private int answer;
    private int score;
    private int avgTimeSec;
    @JsonProperty(access = JsonProperty.Access.WRITE_ONLY)
    private String difficultyLevel;
    private String jobProfileTitle;

    // ─── Getters & Setters ───

    public String getQuestion() { return question; }
    public void setQuestion(String question) { this.question = question; }

    public List<String> getChoices() { return choices; }
    public void setChoices(List<String> choices) { this.choices = choices; }

    public int getAnswer() { return answer; }
    public void setAnswer(int answer) { this.answer = answer; }

    public int getScore() { return score; }
    public void setScore(int score) { this.score = score; }

    public int getAvgTimeSec() { return avgTimeSec; }
    public void setAvgTimeSec(int avgTimeSec) { this.avgTimeSec = avgTimeSec; }

    public String getDifficultyLevel() { return difficultyLevel; }
    public void setDifficultyLevel(String difficultyLevel) { this.difficultyLevel = difficultyLevel; }

    public String getJobProfileTitle() { return jobProfileTitle; }
    public void setJobProfileTitle(String jobProfileTitle) { this.jobProfileTitle = jobProfileTitle; }
}
