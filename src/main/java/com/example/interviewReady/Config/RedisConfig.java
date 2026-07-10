package com.example.interviewReady.Config;

import java.time.Duration;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.core.StringRedisTemplate;

/**
 * Redis configuration for distributed caching.
 * Used for: verification codes (10min TTL), future session/rate-limiting.
 */
@Configuration
public class RedisConfig {

    @Bean
    public StringRedisTemplate stringRedisTemplate(RedisConnectionFactory connectionFactory) {
        return new StringRedisTemplate(connectionFactory);
    }

    /** Default TTL for verification codes */
    public static final Duration VERIFICATION_CODE_TTL = Duration.ofMinutes(10);
}
