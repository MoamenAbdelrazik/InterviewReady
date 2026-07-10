package com.example.interviewReady.SecurityConfig;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.client.web.DefaultOAuth2AuthorizationRequestResolver;
import org.springframework.security.oauth2.client.web.OAuth2AuthorizationRequestResolver;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

import com.example.interviewReady.Service.CustomUserDetailsService;
import com.example.interviewReady.Service.JwtService;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

        @Autowired
        CustomUserDetailsService customUserDetailsService;

        @Autowired
        JwtFilter jwtFilter;

        @Autowired
        RateLimitFilter rateLimitFilter;

        @Autowired
        OAuth2SuccessHandler oAuth2SuccessHandler;

        @Autowired
        JwtService jwtService;

        @Autowired
        ClientRegistrationRepository clientRegistrationRepository;

        @Bean
        public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {

                http
                        .cors(cors -> cors.configurationSource(request -> {
                                var config = new org.springframework.web.cors.CorsConfiguration();
                                config.setAllowedOrigins(java.util.List.of(
                                        "http://localhost:4200",
                                        "https://zestfully-hulk-greyhound.ngrok-free.dev"
                                ));
                                config.setAllowedMethods(java.util.List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
                                config.setAllowedHeaders(java.util.List.of("*"));
                                config.setAllowCredentials(true);
                                config.setMaxAge(3600L);
                                return config;
                        }))
                        .csrf(csrf -> csrf.disable())
                        .httpBasic(httpBasic -> httpBasic.disable())
                        .sessionManagement(session -> session
                                .sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED))
                        .authorizeHttpRequests(auth -> auth
                                .requestMatchers("/register", "/login", "/logout", "/verify", "/signup", "/verify-page", "/login-page", "/error", "/oauth2/**", "/login/oauth2/**", "/public/**").permitAll()
                                .requestMatchers("/profile-page").authenticated()
                                .requestMatchers("/admin/**").hasRole("ADMIN")
                                .requestMatchers("/user/**").hasRole("USER")
                                .anyRequest().authenticated()
                        )
                        .exceptionHandling(ex -> ex
                                .authenticationEntryPoint((request, response, authException) -> {
                                        response.setStatus(401);
                                        response.setContentType("application/json");
                                        response.getWriter().write("{\"error\": \"Unauthorized\"}");
                                })
                        )
                        .oauth2Login(oauth2 -> oauth2
                                .authorizationEndpoint(authorization -> authorization
                                        .authorizationRequestResolver(authorizationRequestResolver(clientRegistrationRepository))
                                )
                                .successHandler(oAuth2SuccessHandler)
                        )
                        .logout(logout -> logout
                                .logoutUrl("/logout")
                                .addLogoutHandler((request, response, authentication) -> {
                                        String authHeader = request.getHeader("Authorization");
                                        if (authHeader != null && authHeader.startsWith("Bearer ")) {
                                                jwtService.blacklistToken(authHeader.substring(7));
                                        }
                                })
                                .invalidateHttpSession(true)
                                .clearAuthentication(true)
                                .deleteCookies("JSESSIONID")
                                .permitAll()
                        )
                        .authenticationProvider(authenticationProvider(
                                customUserDetailsService, passwordEncoder()))
                        .addFilterBefore(rateLimitFilter, UsernamePasswordAuthenticationFilter.class)
                        .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class);

                return http.build();
        }

        private OAuth2AuthorizationRequestResolver authorizationRequestResolver(
                ClientRegistrationRepository clientRegistrationRepository) {

                DefaultOAuth2AuthorizationRequestResolver authorizationRequestResolver =
                        new DefaultOAuth2AuthorizationRequestResolver(
                                clientRegistrationRepository, "/oauth2/authorization");

                authorizationRequestResolver.setAuthorizationRequestCustomizer(
                        customizer -> customizer.additionalParameters(params -> params.put("prompt", "select_account")));

                return authorizationRequestResolver;
        }

        @Bean
        public static PasswordEncoder passwordEncoder() {
                return new BCryptPasswordEncoder();
        }

        @Bean
        public AuthenticationProvider authenticationProvider(
                        UserDetailsService userDetailsService,
                        PasswordEncoder passwordEncoder) {

                DaoAuthenticationProvider authProvider = new DaoAuthenticationProvider(userDetailsService);
                authProvider.setPasswordEncoder(passwordEncoder);
                return authProvider;
        }
}
