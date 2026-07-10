package com.example.interviewReady.Repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.example.interviewReady.Model.JobProfile;

public interface JobProfileRepository extends JpaRepository<JobProfile, Long> {
    List<JobProfile> findByNormalizedTitleContainingIgnoreCase(String keyword);
    JobProfile findByNormalizedTitle(String normalizedTitle);
}
