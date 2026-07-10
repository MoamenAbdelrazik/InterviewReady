package com.example.interviewReady.Handler;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.*;
import org.springframework.web.socket.handler.TextWebSocketHandler;
import com.example.interviewReady.Service.JwtService;
import com.example.interviewReady.Service.CustomUserDetailsService;
import com.example.interviewReady.Service.InterviewService;
import com.example.interviewReady.DTO.VoiceAssistRequest;

import jakarta.annotation.PreDestroy;

import java.io.IOException;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@Component
public class VoiceWebSocketHandler extends TextWebSocketHandler {

    private static final Logger log = LoggerFactory.getLogger(VoiceWebSocketHandler.class);
    
    private final JwtService jwtService;
    private final CustomUserDetailsService userDetailsService;
    private final InterviewService interviewService;
    private final ObjectMapper objectMapper = new ObjectMapper()
            .configure(com.fasterxml.jackson.databind.DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

    // Async thread pool for voice processing — frees WebSocket I/O thread immediately
    private final ExecutorService voiceExecutor = Executors.newCachedThreadPool();

    // session ID -> WebSocketSession
    private final Map<String, WebSocketSession> sessions = new ConcurrentHashMap<>();

    public VoiceWebSocketHandler(JwtService jwtService,
                                 CustomUserDetailsService userDetailsService,
                                 InterviewService interviewService) {
        this.jwtService = jwtService;
        this.userDetailsService = userDetailsService;
        this.interviewService = interviewService;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        String query = session.getUri() != null ? session.getUri().getQuery() : null;
        Map<String, String> params = parseQueryParams(query);

        String token = params.get("token");
        String interviewIdStr = params.get("interviewId");

        if (token == null || interviewIdStr == null) {
            log.warn("WebSocket connection attempt rejected: missing token or interviewId");
            session.close(CloseStatus.BAD_DATA);
            return;
        }

        try {
            String username = jwtService.extractUsername(token);
            if (username == null) {
                log.warn("WebSocket connection attempt rejected: unable to extract username from token");
                session.close(CloseStatus.BAD_DATA);
                return;
            }

            UserDetails userDetails = userDetailsService.loadUserByUsername(username);
            if (!jwtService.isTokenValid(token, userDetails)) {
                log.warn("WebSocket connection attempt rejected: token is invalid/expired for user {}", username);
                session.close(CloseStatus.BAD_DATA);
                return;
            }

            Long interviewId = Long.parseLong(interviewIdStr);
            // Store variables in session attributes for easy access later
            session.getAttributes().put("username", username);
            session.getAttributes().put("interviewId", interviewId);

            sessions.put(session.getId(), session);
            log.info("WebSocket connection established successfully for user {} on interview {}", username, interviewId);

        } catch (Exception e) {
            log.error("Error setting up WebSocket session: {}", e.getMessage(), e);
            session.close(CloseStatus.SERVER_ERROR);
        }
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        String username = (String) session.getAttributes().get("username");
        Long interviewId = (Long) session.getAttributes().get("interviewId");

        if (username == null || interviewId == null) {
            log.warn("Unauthenticated WebSocket message received from session {}", session.getId());
            session.close(CloseStatus.POLICY_VIOLATION);
            return;
        }

        String payload = message.getPayload();

        // Handle heartbeat PING — respond with PONG immediately (no need to offload)
        if (payload.contains("\"PING\"")) {
            try {
                synchronized (session) {
                    if (session.isOpen()) {
                        session.sendMessage(new TextMessage("{\"type\":\"PONG\"}"));
                    }
                }
            } catch (Exception e) {
                log.debug("Failed to send PONG: {}", e.getMessage());
            }
            return;
        }

        // Offload to async thread pool — frees the WebSocket I/O thread immediately
        // so new messages can be received while the LLM is still streaming a response
        voiceExecutor.submit(() -> {
            try {
                VoiceAssistRequest request = objectMapper.readValue(payload, VoiceAssistRequest.class);

                // Stream response chunk-by-chunk using callback
                interviewService.processVoiceAssistStream(interviewId, request, username, session, (chunk, isFinal, hintGiven, pointsDeducted) -> {
                    try {
                        synchronized (session) {
                            if (session.isOpen()) {
                                Map<String, Object> responseFrame = Map.of(
                                    "type", "ASSISTANT_SPEECH_CHUNK",
                                    "text", chunk,
                                    "isFinal", isFinal,
                                    "hintGiven", hintGiven,
                                    "pointsDeducted", pointsDeducted
                                );
                                session.sendMessage(new TextMessage(objectMapper.writeValueAsString(responseFrame)));
                            }
                        }
                    } catch (IOException e) {
                        log.error("Failed to send WebSocket message chunk: {}", e.getMessage());
                    }
                });

            } catch (Exception e) {
                log.error("Error processing WebSocket text message: {}", e.getMessage(), e);
                Map<String, Object> errorFrame = Map.of(
                    "type", "ASSISTANT_SPEECH_CHUNK",
                    "text", "I ran into an issue processing that query. Please try again.",
                    "isFinal", true,
                    "hintGiven", false,
                    "pointsDeducted", 0
                );
                try {
                    synchronized (session) {
                        if (session.isOpen()) {
                            session.sendMessage(new TextMessage(objectMapper.writeValueAsString(errorFrame)));
                        }
                    }
                } catch (Exception ex) {
                    log.error("Failed to send error frame: {}", ex.getMessage());
                }
            }
        });
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
        sessions.remove(session.getId());
        log.info("WebSocket connection closed for session {} with status {}", session.getId(), status);
    }

    @PreDestroy
    public void shutdown() {
        voiceExecutor.shutdownNow();
        log.info("Voice executor thread pool shut down.");
    }

    private Map<String, String> parseQueryParams(String query) {
        Map<String, String> queryParams = new HashMap<>();
        if (query != null && !query.isEmpty()) {
            String[] pairs = query.split("&");
            for (String pair : pairs) {
                String[] keyValue = pair.split("=");
                try {
                    String key = URLDecoder.decode(keyValue[0], StandardCharsets.UTF_8.name());
                    String value = keyValue.length > 1 ? URLDecoder.decode(keyValue[1], StandardCharsets.UTF_8.name()) : "";
                    queryParams.put(key, value);
                } catch (Exception e) {
                    // Fallback to raw values if decoding fails
                    String key = keyValue[0];
                    String value = keyValue.length > 1 ? keyValue[1] : "";
                    queryParams.put(key, value);
                }
            }
        }
        return queryParams;
    }
}
