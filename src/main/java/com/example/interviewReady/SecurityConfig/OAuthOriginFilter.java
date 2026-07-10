package com.example.interviewReady.SecurityConfig;

import java.io.IOException;

import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * Captures the frontend origin query parameter before the OAuth flow starts
 * and stores it in the HTTP session so the success handler can redirect back
 * to the correct frontend (localhost vs ngrok).
 */
@Component
public class OAuthOriginFilter extends OncePerRequestFilter {

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        if (request.getRequestURI().startsWith("/oauth2/authorization")) {
            String origin = request.getParameter("origin");
            if (origin != null && !origin.isEmpty()) {
                request.getSession().setAttribute("oauth_frontend_origin", origin);
            }
        }
        chain.doFilter(request, response);
    }
}
