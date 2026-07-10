package com.example.interviewReady.DTO;

public class CandidateDTO {

    private Long id;
    private String firstName;
    private String lastName;
    private String email;
    private String profileImageUrl;
    private String planName;
    private Integer remainingQuota;
    private Integer totalCredits;
    private String resetsAt;
    private String authProvider;

    public CandidateDTO() {}

    public CandidateDTO(Long id, String firstName, String lastName, String email,
                        String profileImageUrl, String planName,
                        Integer remainingQuota, Integer totalCredits, String resetsAt,
                        String authProvider) {
        this.id = id;
        this.firstName = firstName;
        this.lastName = lastName;
        this.email = email;
        this.profileImageUrl = profileImageUrl;
        this.planName = planName;
        this.remainingQuota = remainingQuota;
        this.totalCredits = totalCredits;
        this.resetsAt = resetsAt;
        this.authProvider = authProvider;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getFirstName() { return firstName; }
    public void setFirstName(String firstName) { this.firstName = firstName; }

    public String getLastName() { return lastName; }
    public void setLastName(String lastName) { this.lastName = lastName; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getProfileImageUrl() { return profileImageUrl; }
    public void setProfileImageUrl(String profileImageUrl) { this.profileImageUrl = profileImageUrl; }

    public String getPlanName() { return planName; }
    public void setPlanName(String planName) { this.planName = planName; }

    public Integer getRemainingQuota() { return remainingQuota; }
    public void setRemainingQuota(Integer remainingQuota) { this.remainingQuota = remainingQuota; }

    public Integer getTotalCredits() { return totalCredits; }
    public void setTotalCredits(Integer totalCredits) { this.totalCredits = totalCredits; }

    public String getResetsAt() { return resetsAt; }
    public void setResetsAt(String resetsAt) { this.resetsAt = resetsAt; }

    public String getAuthProvider() { return authProvider; }
    public void setAuthProvider(String authProvider) { this.authProvider = authProvider; }
}
