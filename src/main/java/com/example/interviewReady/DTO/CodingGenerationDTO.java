package com.example.interviewReady.DTO;

import java.util.List;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public class CodingGenerationDTO {

    private List<CodingDTO> coding;

    // ─── Getters & Setters ───

    public List<CodingDTO> getCoding() { return coding; }
    public void setCoding(List<CodingDTO> coding) { this.coding = coding; }
}
