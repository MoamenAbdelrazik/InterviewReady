package com.example.interviewReady.Controller;

import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import com.example.interviewReady.Service.JwtService;
import com.example.interviewReady.Service.UserService;

@RestController
public class AuthController {

    private final UserService userService;
    private final AuthenticationProvider authenticationProvider;
    private final JwtService jwtService;

    public AuthController(UserService userService,
                      AuthenticationProvider authenticationProvider,
                      JwtService jwtService) {
        this.userService = userService;
        this.authenticationProvider = authenticationProvider;
        this.jwtService = jwtService;
    }

    // ── PUBLIC ───────────────────────────────────────────────────
    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody Map<String, String> body) {
        try {
            String role = body.getOrDefault("role", "ROLE_USER");
            String result = userService.register(
                    body.get("username"),
                    body.get("password"),
                    body.get("email"),
                    role,
                    body.get("firstName"),
                    body.get("lastName")
            );

            // If the service returns a known error message, send as 400 Bad Request
            if (result.equals("Username already taken") || result.equals("Email already registered")) {
                return ResponseEntity.badRequest().body(Map.of("error", result));
            }

            return ResponseEntity.ok(Map.of("message", result));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", "Registration failed: " + e.getMessage()));
        }
    }

    @PostMapping("/verify")
    public ResponseEntity<?> verify(@RequestBody Map<String, String> body) {
        String result = userService.verifyEmail(body.get("email"), body.get("code"));

        if (result.equals("Email verified. Please login.")) {
            return ResponseEntity.ok(Map.of("message", result));
        }
        return ResponseEntity.badRequest().body(Map.of("error", result));
    }

    @PostMapping("/login")
    public ResponseEntity<Map<String, String>> login(@RequestBody Map<String, String> body, 
                                                    jakarta.servlet.http.HttpServletRequest request) {
        try {
            // Clear any existing session or context before new login
            jakarta.servlet.http.HttpSession existingSession = request.getSession(false);
            if (existingSession != null) {
                existingSession.invalidate();
            }
            org.springframework.security.core.context.SecurityContextHolder.clearContext();

            Authentication auth = authenticationProvider.authenticate(
                    new UsernamePasswordAuthenticationToken(body.get("username"), body.get("password"))
            );
            UserDetails user = (UserDetails) auth.getPrincipal();
            String token = jwtService.generateToken(user);
            return ResponseEntity.ok(Map.of("token", token));
        } catch (AuthenticationException e) {
            return ResponseEntity.status(401).body(Map.of("error", "Bad credentials"));
        }
    }

    // ── LOGOUT (blacklist JWT + kill session) ───────────────────
    @PostMapping("/logout")
    public ResponseEntity<?> logout(jakarta.servlet.http.HttpServletRequest request) {
        // 1. Blacklist the JWT in Redis so it can't be reused
        String authHeader = request.getHeader("Authorization");
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            jwtService.blacklistToken(authHeader.substring(7));
        }
        // 2. Invalidate the HTTP session (if one exists)
        jakarta.servlet.http.HttpSession session = request.getSession(false);
        if (session != null) {
            session.invalidate();
        }
        // 3. Clear the security context
        org.springframework.security.core.context.SecurityContextHolder.clearContext();
        return ResponseEntity.ok(Map.of("message", "Logged out successfully"));
    }

    // ── ANY AUTHENTICATED USER (OAuth2 + JWT) ────────────────────
    @GetMapping("/home")
    public String home(Authentication authentication) {
        if (authentication.getPrincipal() instanceof org.springframework.security.oauth2.core.user.OAuth2User oauth2User) {
            String name = oauth2User.getAttribute("name");
            String email = oauth2User.getAttribute("email");
            return "Welcome " + name + " (" + email + ") — you are logged in via Google!";
        }
        return "Welcome " + authentication.getName() + " — you are logged in!";
    }

    // ── USER ROLE ONLY (/user/**) ────────────────────────────────
    @GetMapping("/user/dashboard")
    public String userDashboard() {
        return "Welcome USER — this is your dashboard";
    }

    // ── ADMIN ROLE ONLY (/admin/**) ──────────────────────────────
    @GetMapping("/admin/dashboard")
    public String adminDashboard() {
        return "Welcome ADMIN — full access";
    }
}
