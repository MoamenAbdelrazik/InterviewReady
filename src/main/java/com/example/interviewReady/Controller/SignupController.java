package com.example.interviewReady.Controller;

import java.io.IOException;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.multipart.MultipartFile;

import com.example.interviewReady.DTO.CandidateDTO;
import com.example.interviewReady.Model.Candidate;
import com.example.interviewReady.Model.User;
import com.example.interviewReady.Repository.UserRepository;
import com.example.interviewReady.Service.CandidateService;
import com.example.interviewReady.Service.UserService;

import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

/**
 * Thymeleaf page controller for the full signup → verify → login → profile flow.
 * All routes use "-page" suffix to avoid conflicts with existing REST endpoints.
 */
@Controller
public class SignupController {

    private static final Logger log = LoggerFactory.getLogger(SignupController.class);

    private final UserService userService;
    private final CandidateService candidateService;
    private final UserRepository userRepository;
    private final S3Client s3Client;
    private final AuthenticationProvider authenticationProvider;

    @Value("${aws.s3.bucket}")
    private String bucketName;

    public SignupController(UserService userService,
                            CandidateService candidateService,
                            UserRepository userRepository,
                            S3Client s3Client,
                            AuthenticationProvider authenticationProvider) {
        this.userService = userService;
        this.candidateService = candidateService;
        this.userRepository = userRepository;
        this.s3Client = s3Client;
        this.authenticationProvider = authenticationProvider;
    }

    // ═══════════════════════════════════════════════════════════════
    //  1. SIGNUP
    // ═══════════════════════════════════════════════════════════════

    @GetMapping("/signup")
    public String showSignup() {
        return "signup";
    }

    @PostMapping("/signup")
    public String handleSignup(@RequestParam String firstName,
                               @RequestParam String lastName,
                               @RequestParam String username,
                               @RequestParam String email,
                               @RequestParam String password,
                               @RequestParam(required = false) MultipartFile profileImage,
                               Model model) {

        String result = userService.register(username, password, email, "ROLE_USER", firstName, lastName);

        if (result.contains("already")) {
            model.addAttribute("error", result);
            return "signup";
        }

        // Upload profile image to S3 if provided
        if (profileImage != null && !profileImage.isEmpty()) {
            try {
                String key = uploadToS3(profileImage, username);
                User user = userRepository.findByUsername(username);
                if (user != null) {
                    candidateService.updateProfileImage(user.getId(), key);
                    log.info("Profile image uploaded to S3: {}", key);
                }
            } catch (Exception e) {
                log.warn("Failed to upload profile image: {}", e.getMessage());
            }
        }

        // Redirect to verify page with email
        model.addAttribute("email", email);
        return "verify";
    }

    // ═══════════════════════════════════════════════════════════════
    //  2. VERIFY EMAIL
    // ═══════════════════════════════════════════════════════════════

    @GetMapping("/verify-page")
    public String showVerify(@RequestParam String email, Model model) {
        model.addAttribute("email", email);
        return "verify";
    }

    @PostMapping("/verify-page")
    public String handleVerify(@RequestParam String email,
                               @RequestParam String code,
                               Model model) {

        String result = userService.verifyEmail(email, code);

        if (result.equals("Email verified. Please login.")) {
            model.addAttribute("success", "Email verified! You can now log in.");
            return "login";
        }

        model.addAttribute("email", email);
        model.addAttribute("error", result);
        return "verify";
    }

    // ═══════════════════════════════════════════════════════════════
    //  3. LOGIN
    // ═══════════════════════════════════════════════════════════════

    @GetMapping("/login-page")
    public String showLogin() {
        return "login";
    }

    @PostMapping("/login-page")
    public String handleLogin(@RequestParam String username,
                              @RequestParam String password,
                              jakarta.servlet.http.HttpServletRequest request,
                              Model model) {
        try {
            Authentication auth = authenticationProvider.authenticate(
                    new UsernamePasswordAuthenticationToken(username, password)
            );

            // Set authentication in SecurityContext for the current session
            org.springframework.security.core.context.SecurityContextHolder.getContext().setAuthentication(auth);

            // In Spring Security 6+, we often need to manually save the context to the session
            jakarta.servlet.http.HttpSession session = request.getSession(true);
            session.setAttribute("SPRING_SECURITY_CONTEXT", org.springframework.security.core.context.SecurityContextHolder.getContext());

            return "redirect:/profile-page";

        } catch (AuthenticationException e) {
            model.addAttribute("error", "Invalid username or password");
            return "login";
        }
    }

    // ═══════════════════════════════════════════════════════════════
    //  4. PROFILE (direct access)
    // ═══════════════════════════════════════════════════════════════

    @GetMapping("/profile-page")
    public String showProfile(java.security.Principal principal, Model model) {
        if (principal == null) {
            return "redirect:/login-page";
        }
        try {
            String username = principal.getName();
            User user = userRepository.findByUsername(username);
            if (user == null) {
                model.addAttribute("error", "User not found");
                return "login";
            }
            Candidate candidate = candidateService.getByUserId(user.getId());
            CandidateDTO dto = candidateService.toDTO(candidate);
            model.addAttribute("candidate", dto);
            
            // Note: Token won't be in the model here unless generated again.
            // But usually the client should have it from the initial login redirect.
            
            return "profile";
        } catch (Exception e) {
            model.addAttribute("error", e.getMessage());
            return "login";
        }
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

        s3Client.putObject(putRequest, RequestBody.fromInputStream(file.getInputStream(), file.getSize()));
        return key;
    }
}
