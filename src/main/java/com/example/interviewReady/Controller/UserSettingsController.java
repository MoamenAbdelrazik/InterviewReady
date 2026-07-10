package com.example.interviewReady.Controller;

import java.io.IOException;
import java.security.Principal;
import java.util.Map;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.example.interviewReady.DTO.CandidateDTO;
import com.example.interviewReady.Model.Candidate;
import com.example.interviewReady.Model.User;
import com.example.interviewReady.Repository.UserRepository;
import com.example.interviewReady.Service.CandidateService;
import com.example.interviewReady.Service.CustomUserDetailsService;
import com.example.interviewReady.Service.JwtService;
import com.example.interviewReady.Service.UserService;


import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

/**
 * REST endpoints for user settings / profile management.
 * All endpoints require JWT Bearer token (ROLE_USER).
 */
@RestController
@RequestMapping("/user/settings")
public class UserSettingsController {

    private static final Logger log = LoggerFactory.getLogger(UserSettingsController.class);

    private final UserService userService;
    private final CandidateService candidateService;
    private final UserRepository userRepository;
    private final JwtService jwtService;
    private final CustomUserDetailsService userDetailsService;
    private final S3Client s3Client;

    @Value("${aws.s3.bucket}")
    private String bucketName;

    public UserSettingsController(UserService userService,
                                  CandidateService candidateService,
                                  UserRepository userRepository,
                                  JwtService jwtService,
                                  CustomUserDetailsService userDetailsService,
                                  S3Client s3Client) {
        this.userService = userService;
        this.candidateService = candidateService;
        this.userRepository = userRepository;
        this.jwtService = jwtService;
        this.userDetailsService = userDetailsService;
        this.s3Client = s3Client;
    }

    // ═══════════════════════════════════════════════════════════════
    //  PUT /user/settings/profile — Update name & username
    // ═══════════════════════════════════════════════════════════════

    @PutMapping("/profile")
    public ResponseEntity<?> updateProfile(Principal principal,
                                           @RequestBody Map<String, String> body) {
        User user = userRepository.findByUsername(principal.getName());
        Long userId = user.getId();

        // Update firstName / lastName on Candidate
        String firstName = body.get("firstName");
        String lastName = body.get("lastName");
        candidateService.updateProfile(userId, firstName, lastName);

        // Update username on User (if provided)
        boolean usernameChanged = false;
        String newUsername = body.get("username");
        if (newUsername != null && !newUsername.isBlank()) {
            String result = userService.updateUsername(userId, newUsername);
            if (result.contains("taken")) {
                return ResponseEntity.badRequest().body(Map.of("error", result));
            }
            usernameChanged = !newUsername.equals(principal.getName());
        }

        // Return updated profile + new JWT if username changed
        Candidate updated = candidateService.getByUserId(userId);
        CandidateDTO dto = candidateService.toDTO(updated);

        if (usernameChanged) {
            // Generate fresh JWT with new username so frontend stays authenticated
            var userDetails = userDetailsService.loadUserByUsername(newUsername);
            String newToken = jwtService.generateToken(userDetails);
            Map<String, Object> response = new java.util.HashMap<>();
            response.put("profile", dto);
            response.put("token", newToken);
            return ResponseEntity.ok(response);
        }

        return ResponseEntity.ok(dto);
    }

    // ═══════════════════════════════════════════════════════════════
    //  POST /user/settings/upload-image — Upload profile image to S3
    // ═══════════════════════════════════════════════════════════════

    @PostMapping(value = "/upload-image", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> uploadProfileImage(Principal principal,
                                                @RequestParam("file") MultipartFile file) {
        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "No file provided"));
        }

        if (file.getSize() > 2 * 1024 * 1024) {
            return ResponseEntity.badRequest().body(Map.of("error", "File must be under 2 MB"));
        }

        User user = userRepository.findByUsername(principal.getName());

        try {
            String key = uploadToS3(file, user.getUsername());
            candidateService.updateProfileImage(user.getId(), key);
            log.info("Profile image updated for user {}: {}", user.getUsername(), key);

            return ResponseEntity.ok(Map.of(
                    "message", "Profile image updated",
                    "imageKey", key
            ));
        } catch (IOException e) {
            log.error("S3 upload failed for user {}: {}", user.getUsername(), e.getMessage());
            return ResponseEntity.status(500).body(Map.of("error", "Upload failed"));
        }
    }

    // ═══════════════════════════════════════════════════════════════
    //  PUT /user/settings/password — Change password
    // ═══════════════════════════════════════════════════════════════

    @PutMapping("/password")
    public ResponseEntity<?> changePassword(Principal principal,
                                            @RequestBody Map<String, String> body,
                                            jakarta.servlet.http.HttpServletRequest request) {
        User user = userRepository.findByUsername(principal.getName());

        // Block Google OAuth users — they have no password
        var candidate = candidateService.getByUserId(user.getId());
        if ("GOOGLE".equals(candidate.getAuthProvider())) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Google OAuth users cannot change password"));
        }

        String currentPassword = body.get("currentPassword");
        String newPassword = body.get("newPassword");

        if (currentPassword == null || newPassword == null) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Both currentPassword and newPassword are required"));
        }

        String result = userService.changePassword(user.getId(), currentPassword, newPassword);

        if (result.contains("incorrect") || result.contains("at least")) {
            return ResponseEntity.badRequest().body(Map.of("error", result));
        }

        // Blacklist the current token — force re-login with new password
        blacklistCurrentToken(request);

        return ResponseEntity.ok(Map.of("message", result));
    }

    // ═══════════════════════════════════════════════════════════════
    //  DELETE /user/settings/account — Permanently delete account
    // ═══════════════════════════════════════════════════════════════

    @DeleteMapping("/account")
    public ResponseEntity<?> deleteAccount(Principal principal,
                                            @RequestBody Map<String, String> body,
                                            jakarta.servlet.http.HttpServletRequest request) {
        User user = userRepository.findByUsername(principal.getName());
        Long userId = user.getId();

        // LOCAL users must confirm with password
        var candidate = candidateService.getByUserId(userId);
        if ("LOCAL".equals(candidate.getAuthProvider())) {
            String password = body.get("password");
            if (password == null || password.isBlank()) {
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "Password required to delete account"));
            }
            if (!new org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder()
                    .matches(password, user.getPassword())) {
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "Incorrect password"));
            }
        }

        // Blacklist the current token before deleting
        blacklistCurrentToken(request);

        userService.deleteAccount(userId);
        log.info("Account deleted for user: {}", principal.getName());

        return ResponseEntity.ok(Map.of("message", "Account deleted successfully"));
    }

    // ═══════════════════════════════════════════════════════════════
    //  S3 Upload Helper
    // ═══════════════════════════════════════════════════════════════

    private String uploadToS3(MultipartFile file, String username) throws IOException {
        String extension = "";
        String originalName = file.getOriginalFilename();
        if (originalName != null && originalName.contains(".")) {
            extension = originalName.substring(originalName.lastIndexOf("."));
        }

        String key = "profile-images/" + username + "_" + UUID.randomUUID() + extension;

        PutObjectRequest putRequest = PutObjectRequest.builder()
                .bucket(bucketName)
                .key(key)
                .contentType(file.getContentType())
                .build();

        s3Client.putObject(putRequest, software.amazon.awssdk.core.sync.RequestBody.fromInputStream(file.getInputStream(), file.getSize()));
        return key;
    }

    // ═══════════════════════════════════════════════════════════════
    //  JWT Blacklist Helper
    // ═══════════════════════════════════════════════════════════════

    private void blacklistCurrentToken(jakarta.servlet.http.HttpServletRequest request) {
        String authHeader = request.getHeader("Authorization");
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            jwtService.blacklistToken(authHeader.substring(7));
        }
    }
}
