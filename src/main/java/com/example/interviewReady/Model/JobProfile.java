package com.example.interviewReady.Model;

import java.util.HashSet;
import java.util.Set;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.Table;

@Entity
@Table(name = "job_profile")
public class JobProfile {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String normalizedTitle; // e.g. "backend engineer" — single storage, no duplication

    @ManyToMany
    @JoinTable(
        name = "job_profile_mcq",
        joinColumns = @JoinColumn(name = "job_profile_id"),
        inverseJoinColumns = @JoinColumn(name = "mcq_question_id")
    )
    private Set<McqQuestion> mcqQuestions = new HashSet<>();

    public JobProfile() {}

    public JobProfile(String normalizedTitle) {
        this.normalizedTitle = normalizedTitle;
    }

    public Long getId() { return id; }

    public String getNormalizedTitle() { return normalizedTitle; }
    public void setNormalizedTitle(String normalizedTitle) { this.normalizedTitle = normalizedTitle; }

    public Set<McqQuestion> getMcqQuestions() { return mcqQuestions; }
    public void setMcqQuestions(Set<McqQuestion> mcqQuestions) { this.mcqQuestions = mcqQuestions; }
}
