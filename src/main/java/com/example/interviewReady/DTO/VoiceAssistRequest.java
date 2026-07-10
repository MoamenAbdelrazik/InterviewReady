package com.example.interviewReady.DTO;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public class VoiceAssistRequest {
    private String userMessage;
    private String questionType; // MCQ or CODING
    private String activeQuestionContent;
    private String userCode;
    private Integer selectedOptionIndex;

    public VoiceAssistRequest() {}

    public VoiceAssistRequest(String userMessage, String questionType, String activeQuestionContent, String userCode, Integer selectedOptionIndex) {
        this.userMessage = userMessage;
        this.questionType = questionType;
        this.activeQuestionContent = activeQuestionContent;
        this.userCode = userCode;
        this.selectedOptionIndex = selectedOptionIndex;
    }

    public String getUserMessage() {
        return userMessage;
    }

    public void setUserMessage(String userMessage) {
        this.userMessage = userMessage;
    }

    public String getQuestionType() {
        return questionType;
    }

    public void setQuestionType(String questionType) {
        this.questionType = questionType;
    }

    public String getActiveQuestionContent() {
        return activeQuestionContent;
    }

    public void setActiveQuestionContent(String activeQuestionContent) {
        this.activeQuestionContent = activeQuestionContent;
    }

    public String getUserCode() {
        return userCode;
    }

    public void setUserCode(String userCode) {
        this.userCode = userCode;
    }

    public Integer getSelectedOptionIndex() {
        return selectedOptionIndex;
    }

    public void setSelectedOptionIndex(Integer selectedOptionIndex) {
        this.selectedOptionIndex = selectedOptionIndex;
    }
}
