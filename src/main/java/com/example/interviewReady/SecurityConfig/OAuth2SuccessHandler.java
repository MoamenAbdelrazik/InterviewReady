package com.example.interviewReady.SecurityConfig;

import java.io.IOException;
import java.util.HashSet;
import java.util.Set;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;
import org.springframework.stereotype.Component;

import com.example.interviewReady.Model.Candidate;
import com.example.interviewReady.Model.Role;
import com.example.interviewReady.Model.User;
import com.example.interviewReady.Repository.CandidateRepository;
import com.example.interviewReady.Repository.RoleRepository;
import com.example.interviewReady.Repository.UserRepository;
import com.example.interviewReady.Service.CandidateService;
import com.example.interviewReady.Service.CustomUserDetailsService;
import com.example.interviewReady.Service.JwtService;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * Handles first-time Google OAuth login:
 * - If email doesn't exist in DB → create User + Candidate with Google avatar
 * - If email exists → just redirect (existing user)
 * - Generates JWT and redirects to Angular with token in URL
 */
@Component
public class OAuth2SuccessHandler implements AuthenticationSuccessHandler {

    private static final Logger log = LoggerFactory.getLogger(OAuth2SuccessHandler.class);

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final CandidateService candidateService;
    private final CandidateRepository candidateRepository;
    private final JwtService jwtService;
    private final CustomUserDetailsService userDetailsService;

    public OAuth2SuccessHandler(UserRepository userRepository,
                                RoleRepository roleRepository,
                                CandidateService candidateService,
                                CandidateRepository candidateRepository,
                                JwtService jwtService,
                                CustomUserDetailsService userDetailsService) {
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.candidateService = candidateService;
        this.candidateRepository = candidateRepository;
        this.jwtService = jwtService;
        this.userDetailsService = userDetailsService;
    }

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request,
                                        HttpServletResponse response,
                                        Authentication authentication) throws IOException {

        OAuth2User oauth2User = (OAuth2User) authentication.getPrincipal();

        String email = oauth2User.getAttribute("email");
        String name = oauth2User.getAttribute("name");
        String picture = oauth2User.getAttribute("picture");

        if (email == null) {
            log.warn("Google OAuth: no email attribute — redirecting to login");
            response.sendRedirect("/login?error=no_email");
            return;
        }

        // Check if user already exists
        User existingUser = userRepository.findByEmail(email);
        String username;

        if (existingUser == null) {
            // ── First-time Google user — create User + Candidate ──
            String firstName = name != null ? name.split(" ")[0] : "Google";
            String lastName = name != null && name.contains(" ")
                    ? name.substring(name.indexOf(" ") + 1) : "User";

            // Look up existing role or create if not found
            Role role = roleRepository.findByName("ROLE_USER")
                    .orElseGet(() -> {
                        Role r = new Role();
                        r.setName("ROLE_USER");
                        return roleRepository.save(r);
                    });

            User user = new User();
            user.setUsername(email); // use full email as username for OAuth users
            user.setPassword(""); // no password for OAuth users
            user.setEmail(email);
            user.setEnabled(true); // Google already verified the email

            Set<Role> roles = new HashSet<>();
            roles.add(role);
            user.setRoles(roles);

            userRepository.save(user);

            // Create Candidate profile with Google avatar
            Candidate candidate = candidateService.createProfile(user, firstName, lastName);
            candidate.setAuthProvider("GOOGLE");
            if (picture != null) {
                candidate.setProfileImageUrl(picture);
            }
            candidateRepository.save(candidate);

            username = user.getUsername();
            log.info("Google OAuth: new user created — {} ({})", name, email);
        } else {
            username = existingUser.getUsername();

            // Only set Google avatar if user has NO custom profile image (preserve S3 uploads)
            if (picture != null) {
                Candidate candidate = candidateRepository.findByUserId(existingUser.getId()).orElse(null);
                if (candidate != null && (candidate.getProfileImageUrl() == null
                        || candidate.getProfileImageUrl().isEmpty())) {
                    candidate.setProfileImageUrl(picture);
                    candidateRepository.save(candidate);
                }
            }

            log.info("Google OAuth: existing user logged in — {}", email);
        }

        // ── Generate JWT and redirect to Angular ──
        UserDetails userDetails = userDetailsService.loadUserByUsername(username);
        String token = jwtService.generateToken(userDetails);

        // Hardcode redirect to ngrok frontend to avoid header/proxy issues
        String redirectBase = "https://zestfully-hulk-greyhound.ngrok-free.dev";
        response.sendRedirect(redirectBase + "/auth/callback?token=" + token);
    }
}

