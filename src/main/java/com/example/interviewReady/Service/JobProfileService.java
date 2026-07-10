package com.example.interviewReady.Service;

import java.util.List;

import org.springframework.stereotype.Service;

import com.example.interviewReady.Model.JobProfile;
import com.example.interviewReady.Model.McqQuestion;
import com.example.interviewReady.Repository.JobProfileRepository;
import com.example.interviewReady.Repository.McqQuestionRepository;

@Service
public class JobProfileService {

    private final JobProfileRepository jobProfileRepository;
    private final McqQuestionRepository mcqQuestionRepository;

    public JobProfileService(JobProfileRepository jobProfileRepository,
                             McqQuestionRepository mcqQuestionRepository) {
        this.jobProfileRepository = jobProfileRepository;
        this.mcqQuestionRepository = mcqQuestionRepository;
    }

    public List<JobProfile> getAllProfiles() {
        return jobProfileRepository.findAll();
    }

    public JobProfile getById(Long id) {
        return jobProfileRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Job profile not found: " + id));
    }

    public JobProfile create(String title) {
        String normalized = normalizeTitle(title);
        // Check for duplicate by normalized title
        JobProfile existing = jobProfileRepository.findByNormalizedTitle(normalized);
        if (existing != null) return existing;
        return jobProfileRepository.save(new JobProfile(normalized));
    }

    public JobProfile update(Long id, String title) {
        JobProfile profile = getById(id);
        profile.setNormalizedTitle(normalizeTitle(title));
        return jobProfileRepository.save(profile);
    }

    public void delete(Long id) {
        jobProfileRepository.deleteById(id);
    }

    /**
     * Tag an MCQ question to a job profile (M:N relationship).
     */
    public JobProfile tagMcqQuestion(Long profileId, Long mcqId) {
        JobProfile profile = getById(profileId);
        McqQuestion mcq = mcqQuestionRepository.findById(mcqId)
                .orElseThrow(() -> new RuntimeException("MCQ not found: " + mcqId));

        profile.getMcqQuestions().add(mcq);
        return jobProfileRepository.save(profile);
    }

    /**
     * Remove an MCQ question tag from a job profile.
     */
    public JobProfile untagMcqQuestion(Long profileId, Long mcqId) {
        JobProfile profile = getById(profileId);
        profile.getMcqQuestions().removeIf(q -> q.getId().equals(mcqId));
        return jobProfileRepository.save(profile);
    }

    public List<JobProfile> search(String keyword) {
        return jobProfileRepository.findByNormalizedTitleContainingIgnoreCase(keyword);
    }

    // ═══════════════════════════════════════════════════════════════
    //  Normalize title: strip hyphens/underscores, lowercase, expand aliases
    // ═══════════════════════════════════════════════════════════════

    public static String normalizeTitle(String title) {
        if (title == null) return "";
        String cleaned = title.trim()
                .replaceAll("[-_]+", " ")   // Back-End / back_end → Back End
                .replaceAll("\\s+", " ")     // collapse spaces
                .toLowerCase();

        // Expand common abbreviations
        cleaned = cleaned.replace("swe", "software engineer")
                         .replace("sre", "site reliability engineer")
                         .replace("ml ", "machine learning ")
                         .replace("ai ", "artificial intelligence ")
                         .replace("fe ", "frontend ")
                         .replace("be ", "backend ")
                         .replace("qa ", "quality assurance ")
                         .replace("devops", "dev ops");

        return cleaned.trim();
    }
}
