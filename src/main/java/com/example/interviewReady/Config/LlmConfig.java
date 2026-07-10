package com.example.interviewReady.Config;

import org.springframework.ai.chat.client.ChatClient;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class LlmConfig {

    /**
     * ChatClient bean — Spring AI auto-configures the OpenAI client
     * using properties from application.properties.
     *
     * HuggingFace uses the OpenAI-compatible /v1/chat/completions endpoint,
     * so we reuse Spring AI's OpenAI starter with a custom base-url.
     *
     * Config in application.properties:
     *   spring.ai.openai.api-key=YOUR_HUGGINGFACE_API_KEY
     *   spring.ai.openai.base-url=https://api-inference.huggingface.co/v1
     *   spring.ai.openai.chat.options.model=your-model-id
     */
    @Bean
    public ChatClient chatClient(ChatClient.Builder builder) {
        return builder.build();
    }
}
