package com.example.interviewReady.DTO;

import java.util.List;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * MCQ question DTO that STRIPS correctAnswer when serving to candidates.
 * Admin endpoints use the full McqQuestion entity directly.
 */
public class McqQuestionDTO {

    @JsonProperty("question")
    private String questionText;
    private List<String> choices;
    private Integer score;
    @JsonProperty("avgTimeSec")
    private Integer averageTimeSec;
    private Integer answer;           // 0-indexed correct choice
    private String jobProfileTitle;   // e.g. "Backend Engineer"

    public McqQuestionDTO() {}

    public McqQuestionDTO(String questionText, List<String> choices,
                          Integer score, Integer averageTimeSec, Integer answer) {
        this.questionText = questionText;
        this.choices = choices;
        this.score = score;
        this.averageTimeSec = averageTimeSec;
        this.answer = answer;
    }

    public String getQuestionText() { return questionText; }
    public void setQuestionText(String questionText) { this.questionText = questionText; }

    public List<String> getChoices() { return choices; }
    public void setChoices(List<String> choices) { this.choices = choices; }

    public Integer getScore() { return score; }
    public void setScore(Integer score) { this.score = score; }

    public Integer getAverageTimeSec() { return averageTimeSec; }
    public void setAverageTimeSec(Integer averageTimeSec) { this.averageTimeSec = averageTimeSec; }

    public Integer getAnswer() { return answer; }
    public void setAnswer(Integer answer) { this.answer = answer; }

    public String getJobProfileTitle() { return jobProfileTitle; }
    public void setJobProfileTitle(String jobProfileTitle) { this.jobProfileTitle = jobProfileTitle; }
}
