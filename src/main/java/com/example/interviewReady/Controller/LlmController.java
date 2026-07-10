package com.example.interviewReady.Controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.example.interviewReady.DTO.BehaviorAnalysisDTO;
import com.example.interviewReady.DTO.CodingAnalysisDTO;
import com.example.interviewReady.DTO.DomainAnalysisDTO;
import com.example.interviewReady.DTO.FinalReportDTO;
import com.example.interviewReady.Service.LlmService;

@RestController
@RequestMapping("/api/llm")
public class LlmController {

    private final LlmService llmService;

    public LlmController(LlmService llmService) {
        this.llmService = llmService;
    }

    /**
     * LLM Call #1 — Behavioral Analysis
     * Receives: raw Final Behavioral JSON (3-level aggregation)
     * Returns: BehaviorAnalysisDTO
     */
    @PostMapping("/behavior")
    public ResponseEntity<BehaviorAnalysisDTO> analyzeBehavior(@RequestBody String rawBehavioralJson) {
        BehaviorAnalysisDTO result = llmService.analyzeBehavior(rawBehavioralJson);
        return ResponseEntity.ok(result);
    }

    /**
     * LLM Call #2 — Domain Knowledge Analysis
     * Receives: raw MCQ_Solution[] JSON
     * Returns: DomainAnalysisDTO
     */
    @PostMapping("/domain")
    public ResponseEntity<DomainAnalysisDTO> analyzeDomain(@RequestBody String rawMcqSolutionsJson) {
        DomainAnalysisDTO result = llmService.analyzeDomain(rawMcqSolutionsJson);
        return ResponseEntity.ok(result);
    }

    /**
     * LLM Call #3 — Coding Proficiency Analysis
     * Receives: raw Coding_Solution[] JSON
     * Returns: CodingAnalysisDTO
     */
    @PostMapping("/coding")
    public ResponseEntity<CodingAnalysisDTO> analyzeCoding(@RequestBody String rawCodingSolutionsJson) {
        CodingAnalysisDTO result = llmService.analyzeCoding(rawCodingSolutionsJson);
        return ResponseEntity.ok(result);
    }

    /**
     * LLM Call #4 — Final Comprehensive Report (sequential — waits for calls 1-3)
     * Receives: raw JSON with 3 DTOs + timeTaken + securityFlags + finalScore
     * Returns: FinalReportDTO
     */
    @PostMapping("/final-report")
    public ResponseEntity<FinalReportDTO> generateFinalReport(@RequestBody String rawInputJson) {
        FinalReportDTO result = llmService.generateFinalReport(rawInputJson);
        return ResponseEntity.ok(result);
    }
}
