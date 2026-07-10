package com.example.interviewReady.Model;

import java.time.LocalDateTime;
import java.util.Map;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

@Entity
@Table(name = "interview")
public class Interview {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "candidate_id", nullable = false)
    private Candidate candidate;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "job_profile_id") // NULLABLE — null for custom JD (Option A)
    private JobProfile jobProfile;

    @Column(columnDefinition = "TEXT")
    private String customJobDescription; // NULLABLE — null for template (Option B)

    @Column
    private Integer durationSec; // set after interview completes

    @Column
    private Integer finalScore; // extracted from report for dashboard queries

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private Map<String, Object> detailedReport; // FinalComprehensiveReport (workflow.md §5)

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
    }

    public Interview() {}

    // --- Getters & Setters ---

    public Long getId() { return id; }

    public Candidate getCandidate() { return candidate; }
    public void setCandidate(Candidate candidate) { this.candidate = candidate; }

    public JobProfile getJobProfile() { return jobProfile; }
    public void setJobProfile(JobProfile jobProfile) { this.jobProfile = jobProfile; }

    public String getCustomJobDescription() { return customJobDescription; }
    public void setCustomJobDescription(String customJobDescription) { this.customJobDescription = customJobDescription; }

    public Integer getDurationSec() { return durationSec; }
    public void setDurationSec(Integer durationSec) { this.durationSec = durationSec; }

    public Integer getFinalScore() { return finalScore; }
    public void setFinalScore(Integer finalScore) { this.finalScore = finalScore; }

    public Map<String, Object> getDetailedReport() { return detailedReport; }
    public void setDetailedReport(Map<String, Object> detailedReport) { this.detailedReport = detailedReport; }

    public LocalDateTime getCreatedAt() { return createdAt; }
}
