package com.example.interviewReady.Controller;

import java.util.List;
import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.example.interviewReady.Model.JobProfile;
import com.example.interviewReady.Service.JobProfileService;

@RestController
@RequestMapping("/admin/job-profiles")
public class AdminController {

    private final JobProfileService jobProfileService;

    public AdminController(JobProfileService jobProfileService) {
        this.jobProfileService = jobProfileService;
    }

    /**
     * GET /admin/job-profiles — List all job profile templates.
     */
    @GetMapping
    public ResponseEntity<List<JobProfile>> getAll() {
        return ResponseEntity.ok(jobProfileService.getAllProfiles());
    }

    /**
     * POST /admin/job-profiles — Create a new job profile template.
     * Body: { "title": "Backend Engineer" }
     */
    @PostMapping
    public ResponseEntity<JobProfile> create(@RequestBody Map<String, String> body) {
        JobProfile profile = jobProfileService.create(body.get("title")); // normalized title only stored
        return ResponseEntity.ok(profile);
    }

    /**
     * PUT /admin/job-profiles/{id} — Update job profile normalized title.
     * Body: { "title": "Senior Backend Engineer" }
     */
    @PutMapping("/{id}")
    public ResponseEntity<JobProfile> update(@PathVariable Long id, @RequestBody Map<String, String> body) {
        JobProfile profile = jobProfileService.update(id, body.get("title")); // normalized title only stored
        return ResponseEntity.ok(profile);
    }

    /**
     * DELETE /admin/job-profiles/{id} — Delete a job profile.
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, String>> delete(@PathVariable Long id) {
        jobProfileService.delete(id);
        return ResponseEntity.ok(Map.of("message", "Deleted"));
    }

    /**
     * POST /admin/job-profiles/{id}/tag-mcq/{mcqId} — Tag an MCQ to this profile.
     */
    @PostMapping("/{id}/tag-mcq/{mcqId}")
    public ResponseEntity<Map<String, String>> tagMcq(@PathVariable Long id, @PathVariable Long mcqId) {
        jobProfileService.tagMcqQuestion(id, mcqId);
        return ResponseEntity.ok(Map.of("message", "MCQ tagged to profile"));
    }

    /**
     * DeleteMapping /admin/job-profiles/{id}/tag-mcq/{mcqId} — Remove MCQ tag.
     */
    @DeleteMapping("/{id}/tag-mcq/{mcqId}")
    public ResponseEntity<Map<String, String>> untagMcq(@PathVariable Long id, @PathVariable Long mcqId) {
        jobProfileService.untagMcqQuestion(id, mcqId);
        return ResponseEntity.ok(Map.of("message", "MCQ untagged from profile"));
    }
}
