package com.example.interviewReady.DTO;

import java.util.List;

/**
 * One row in the interview history table.
 */
public class InterviewHistoryDTO {

    private Long id;
    private String role;           // JobProfile title or "Custom Interview"
    private String date;           // formatted date string
    private Integer durationSec;
    private Integer finalScore;
    private String status;         // "Completed" or "In Progress"
    private List<String> skills;   // extracted tech tags

    public InterviewHistoryDTO() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }

    public String getDate() { return date; }
    public void setDate(String date) { this.date = date; }

    public Integer getDurationSec() { return durationSec; }
    public void setDurationSec(Integer durationSec) { this.durationSec = durationSec; }

    public Integer getFinalScore() { return finalScore; }
    public void setFinalScore(Integer finalScore) { this.finalScore = finalScore; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public List<String> getSkills() { return skills; }
    public void setSkills(List<String> skills) { this.skills = skills; }
}
