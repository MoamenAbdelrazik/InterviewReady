package com.example.interviewReady.Service;

import java.util.HashSet;
import java.util.Random;
import java.util.Set;

import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.example.interviewReady.Config.RedisConfig;
import com.example.interviewReady.Model.Candidate;
import com.example.interviewReady.Model.Role;
import com.example.interviewReady.Model.User;
import com.example.interviewReady.Repository.CandidateRepository;
import com.example.interviewReady.Repository.FeedbackRepository;
import com.example.interviewReady.Repository.InterviewRepository;
import com.example.interviewReady.Repository.RoleRepository;
import com.example.interviewReady.Repository.UserRepository;

@Service
public class UserService {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final EmailService emailService;
    private final CandidateService candidateService;
    private final CandidateRepository candidateRepository;
    private final InterviewRepository interviewRepository;
    private final FeedbackRepository feedbackRepository;
    private final StringRedisTemplate redisTemplate;
    private final BCryptPasswordEncoder bCryptPasswordEncoder = new BCryptPasswordEncoder();

    // Redis key prefix for verification codes
    private static final String VERIFY_KEY_PREFIX = "verify:";

    public UserService(UserRepository userRepository, RoleRepository roleRepository,
                       EmailService emailService, CandidateService candidateService,
                       CandidateRepository candidateRepository,
                       InterviewRepository interviewRepository,
                       FeedbackRepository feedbackRepository,
                       StringRedisTemplate redisTemplate) {
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.emailService = emailService;
        this.candidateService = candidateService;
        this.candidateRepository = candidateRepository;
        this.interviewRepository = interviewRepository;
        this.feedbackRepository = feedbackRepository;
        this.redisTemplate = redisTemplate;
    }

    @Transactional
    public String register(String username, String password, String email, String roleName,
            String firstName, String lastName) {
        if (userRepository.findByUsername(username) != null) {
            return "Username already taken";
        }
        if (userRepository.findByEmail(email) != null) {
            return "Email already registered";
        }

        // Generate 6-digit code and send email FIRST (before saving user)
        String code = generateCode();
        emailService.sendVerificationCode(email, username, code);

        // Email sent successfully — now save the user
        // Look up existing role or create if not found
        Role role = roleRepository.findByName(roleName)
                .orElseGet(() -> {
                    Role r = new Role();
                    r.setName(roleName);
                    return roleRepository.save(r);
                });

        User user = new User();
        user.setUsername(username);
        user.setPassword(bCryptPasswordEncoder.encode(password));
        user.setEmail(email);
        user.setEnabled(false);

        Set<Role> roles = new HashSet<>();
        roles.add(role);
        user.setRoles(roles);

        userRepository.save(user);

        // Auto-create Candidate profile with FREE plan
        String fn = (firstName != null && !firstName.isBlank()) ? firstName : username;
        String ln = (lastName != null && !lastName.isBlank()) ? lastName : "";
        candidateService.createProfile(user, fn, ln);

        // Store code in Redis with 10-minute TTL (auto-expires — no manual cleanup needed)
        redisTemplate.opsForValue().set(
                VERIFY_KEY_PREFIX + email, code, RedisConfig.VERIFICATION_CODE_TTL);

        return "Verification code sent to " + email;
    }

    public String verifyEmail(String email, String code) {
        String redisKey = VERIFY_KEY_PREFIX + email;
        String storedCode = redisTemplate.opsForValue().get(redisKey);

        if (storedCode == null) {
            return "Verification code expired or not found";
        }

        if (!storedCode.equals(code)) {
            return "Invalid code";
        }

        // Code matches — enable the user
        User user = userRepository.findByEmail(email);
        if (user == null) {
            return "User not found";
        }

        user.setEnabled(true);
        userRepository.save(user);

        // Cleanup — delete from Redis (TTL would auto-expire, but clean immediately)
        redisTemplate.delete(redisKey);

        return "Email verified. Please login.";
    }

    private String generateCode() {
        Random random = new Random();
        int code = 100000 + random.nextInt(900000); // 6-digit code
        return String.valueOf(code);
    }

    /**
     * Change password — requires current password verification.
     */
    public String changePassword(Long userId, String currentPassword, String newPassword) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        // Verify current password
        if (!bCryptPasswordEncoder.matches(currentPassword, user.getPassword())) {
            return "Current password is incorrect";
        }

        if (newPassword == null || newPassword.length() < 6) {
            return "New password must be at least 6 characters";
        }

        user.setPassword(bCryptPasswordEncoder.encode(newPassword));
        userRepository.save(user);
        return "Password updated successfully";
    }

    /**
     * Update username — checks for uniqueness.
     */
    public String updateUsername(Long userId, String newUsername) {
        if (newUsername == null || newUsername.isBlank()) {
            return "Username cannot be empty";
        }

        User existing = userRepository.findByUsername(newUsername);
        if (existing != null && !existing.getId().equals(userId)) {
            return "Username already taken";
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        user.setUsername(newUsername);
        userRepository.save(user);
        return "Username updated successfully";
    }

    // ═══════════════════════════════════════════════════════════════
    //  DELETE ACCOUNT — Cascading removal of all user data
    // ═══════════════════════════════════════════════════════════════

    @Transactional
    public void deleteAccount(Long userId) {
        Candidate candidate = candidateService.getByUserId(userId);
        Long candidateId = candidate.getId();

        // 1. Delete feedbacks
        feedbackRepository.deleteByCandidateId(candidateId);

        // 2. Delete interviews (and their JSONB reports)
        interviewRepository.deleteByCandidateId(candidateId);

        // 3. Delete candidate
        candidateRepository.deleteById(candidateId);

        // 4. Delete user
        userRepository.deleteById(userId);
    }
}
