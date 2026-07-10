package com.example.interviewReady.Controller;

import java.security.Principal;
import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.example.interviewReady.DTO.VoiceAssistRequest;
import com.example.interviewReady.Service.InterviewService;

@RestController
@RequestMapping("/user/interviews")
public class VoiceAssistController {

    private final InterviewService interviewService;

    public VoiceAssistController(InterviewService interviewService) {
        this.interviewService = interviewService;
    }

    @PostMapping("/{id}/voice-assist")
    public ResponseEntity<?> voiceAssist(Principal principal,
                                         @PathVariable Long id,
                                         @RequestBody VoiceAssistRequest payload) {
        if (principal == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized access"));
        }

        try {
            Map<String, Object> result = interviewService.processVoiceAssist(id, payload, principal.getName());
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}
