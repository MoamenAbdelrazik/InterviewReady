package com.example.interviewReady.Service;

import java.time.Duration;
import java.util.Date;
import java.util.UUID;

import javax.crypto.SecretKey;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;

@Service
public class JwtService {

    @Value("${jwt.secret}")
    private String secret;

    @Value("${jwt.expiration}")
    private long expiration;

    private final StringRedisTemplate redisTemplate;

    private static final String BLACKLIST_PREFIX = "blacklist:";

    public JwtService(StringRedisTemplate redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    private SecretKey getSigningKey() {
        return Keys.hmacShaKeyFor(Decoders.BASE64.decode(secret));
    }

    public String generateToken(UserDetails user) {
        return Jwts.builder()
                .id(UUID.randomUUID().toString())
                .subject(user.getUsername())
                .claim("roles", user.getAuthorities().toString())
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + expiration))
                .signWith(getSigningKey())
                .compact();
    }

    public String extractUsername(String token) {
        return Jwts.parser()
                .verifyWith(getSigningKey())
                .build()
                .parseSignedClaims(token)
                .getPayload()
                .getSubject();
    }

    public boolean isTokenValid(String token, UserDetails user) {
        String username = extractUsername(token);
        String jti = extractJti(token);
        Date exp = extractExpiration(token);
        return username.equals(user.getUsername())
                && exp.after(new Date())
                && !isBlacklisted(jti);
    }

    public String extractJti(String token) {
        return parseClaims(token).getId();
    }

    private Date extractExpiration(String token) {
        return parseClaims(token).getExpiration();
    }

    private Claims parseClaims(String token) {
        return Jwts.parser()
                .verifyWith(getSigningKey())
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    // ═══════════════════════════════════════════════════════════════
    //  JWT Blacklist — Redis-backed token revocation
    // ═══════════════════════════════════════════════════════════════

    /**
     * Blacklist a token by its JTI. TTL = remaining token lifetime.
     */
    public void blacklistToken(String token) {
        try {
            String jti = extractJti(token);
            Date exp = extractExpiration(token);
            if (jti == null || exp == null) {
                return;
            }
            long remainingMs = exp.getTime() - System.currentTimeMillis();
            if (remainingMs > 0) {
                redisTemplate.opsForValue().set(
                        BLACKLIST_PREFIX + jti, "revoked", Duration.ofMillis(remainingMs));
            }
        } catch (Exception e) {
            // Token might be malformed or already expired
        }
    }

    /**
     * Check if a token's JTI has been blacklisted.
     */
    public boolean isBlacklisted(String jti) {
        if (jti == null) return false;
        try {
            return Boolean.TRUE.equals(redisTemplate.hasKey(BLACKLIST_PREFIX + jti));
        } catch (Exception e) {
            // Fail safe: if Redis is down, we allow the token but log the error.
            // In a strict production environment, you might want to block instead.
            return false;
        }
    }
}