package com.example.interviewReady.DTO;

import java.util.List;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public class McqGenerationDTO {

    private String jobProfileTitle;
    private List<McqDTO> mcq;

    // ─── Getters & Setters ───

    public String getJobProfileTitle() { return jobProfileTitle; }
    public void setJobProfileTitle(String jobProfileTitle) { this.jobProfileTitle = jobProfileTitle; }

    public List<McqDTO> getMcq() { return mcq; }
    public void setMcq(List<McqDTO> mcq) { this.mcq = mcq; }
}
