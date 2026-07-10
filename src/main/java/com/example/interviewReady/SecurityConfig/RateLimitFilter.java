package com.example.interviewReady.SecurityConfig;

import java.io.IOException;
import java.time.Duration;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * Redis-backed rate limiter using sliding window counters.
 * Protects sensitive endpoints from brute-force and abuse.
 *
 * Limits:
 *   /login        → 5 requests/minute per IP
 *   /register     → 3 requests/minute per IP
 *   /verify       → 5 requests/minute per IP
 *   /user/**      → 30 requests/minute per IP (general API)
 */
@Component
public class RateLimitFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(RateLimitFilter.class);
    private final StringRedisTemplate redisTemplate;

    private static final String RATE_KEY_PREFIX = "rate:";

    public RateLimitFilter(StringRedisTemplate redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain chain)
            throws ServletException, IOException {

        String path = request.getRequestURI();
        String clientIp = getClientIp(request);

        RateRule rule = resolveRule(path);

        if (rule != null) {
            String key = RATE_KEY_PREFIX + rule.name + ":" + clientIp;

            try {
                Long count = redisTemplate.opsForValue().increment(key);
                if (count != null && count == 1) {
                    // First request in this window — set TTL
                    redisTemplate.expire(key, rule.window);
                }

                if (count != null && count > rule.maxRequests) {
                    log.warn("Rate limit exceeded for IP: {} on path: {}", clientIp, path);
                    response.setStatus(429);
                    response.setContentType("application/json");
                    response.getWriter().write(
                            "{\"error\": \"Too many requests. Please try again later.\"}");
                    return;
                }
            } catch (Exception e) {
                // If Redis is down, we have a choice: block everyone or let everyone through.
                // Usually, for UX, we let them through but log the error.
                log.error("Redis connection failure in RateLimitFilter: {}", e.getMessage());
            }
        }

        chain.doFilter(request, response);
    }

    /**
     * Match URI to rate limit rule. Returns null for unprotected paths.
     */
    private RateRule resolveRule(String path) {
        if (path.equals("/login")) {
            return new RateRule("login", 5, Duration.ofMinutes(1));
        }
        if (path.equals("/register")) {
            return new RateRule("register", 3, Duration.ofMinutes(1));
        }
        if (path.equals("/verify")) {
            return new RateRule("verify", 5, Duration.ofMinutes(1));
        }
        if (path.startsWith("/user/")) {
            return new RateRule("api", 30, Duration.ofMinutes(1));
        }
        return null; // No rate limit for static resources, OAuth callbacks, etc.
    }

    /**
     * Extract client IP, respecting X-Forwarded-For for reverse proxies.
     */
    private String getClientIp(HttpServletRequest request) {
        String xff = request.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) {
            return xff.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }

    /**
     * Rate limit rule: name (for Redis key), max requests, and time window.
     */
    private record RateRule(String name, int maxRequests, Duration window) {}
}
