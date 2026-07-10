package com.example.interviewReady.DTO;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public class FinalReportDTO {

    private String interviewSummary;
    private ConfidenceDistribution confidenceDistribution;
    private DifficultyAnalysis difficultyAnalysis;
    private CheatingProbability cheatingProbability;

    // ─── Inner Classes ───

    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class ConfidenceDistribution {
        private double highConfidencePct;
        private double moderatePct;
        private double hesitantPct;
        private double guessingPct;
        private double noAnswerPct;

        public double getHighConfidencePct() { return highConfidencePct; }
        public void setHighConfidencePct(double highConfidencePct) { this.highConfidencePct = highConfidencePct; }

        public double getModeratePct() { return moderatePct; }
        public void setModeratePct(double moderatePct) { this.moderatePct = moderatePct; }

        public double getHesitantPct() { return hesitantPct; }
        public void setHesitantPct(double hesitantPct) { this.hesitantPct = hesitantPct; }

        public double getGuessingPct() { return guessingPct; }
        public void setGuessingPct(double guessingPct) { this.guessingPct = guessingPct; }

        public double getNoAnswerPct() { return noAnswerPct; }
        public void setNoAnswerPct(double noAnswerPct) { this.noAnswerPct = noAnswerPct; }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class DifficultyAnalysis {
        private DifficultyLevel easy;
        private DifficultyLevel medium;
        private DifficultyLevel hard;

        public DifficultyLevel getEasy() { return easy; }
        public void setEasy(DifficultyLevel easy) { this.easy = easy; }

        public DifficultyLevel getMedium() { return medium; }
        public void setMedium(DifficultyLevel medium) { this.medium = medium; }

        public DifficultyLevel getHard() { return hard; }
        public void setHard(DifficultyLevel hard) { this.hard = hard; }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class DifficultyLevel {
        private double accuracyPct;
        private int avgTimeSec;

        public double getAccuracyPct() { return accuracyPct; }
        public void setAccuracyPct(double accuracyPct) { this.accuracyPct = accuracyPct; }

        public int getAvgTimeSec() { return avgTimeSec; }
        public void setAvgTimeSec(int avgTimeSec) { this.avgTimeSec = avgTimeSec; }
    }

    // ─── Getters & Setters ───

    public String getInterviewSummary() { return interviewSummary; }
    public void setInterviewSummary(String interviewSummary) { this.interviewSummary = interviewSummary; }

    public ConfidenceDistribution getConfidenceDistribution() { return confidenceDistribution; }
    public void setConfidenceDistribution(ConfidenceDistribution confidenceDistribution) { this.confidenceDistribution = confidenceDistribution; }

    public DifficultyAnalysis getDifficultyAnalysis() { return difficultyAnalysis; }
    public void setDifficultyAnalysis(DifficultyAnalysis difficultyAnalysis) { this.difficultyAnalysis = difficultyAnalysis; }

    public CheatingProbability getCheatingProbability() { return cheatingProbability; }
    public void setCheatingProbability(CheatingProbability cheatingProbability) { this.cheatingProbability = cheatingProbability; }

    // ─── CheatingProbability Inner Class ───

    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class CheatingProbability {
        private String level;       // LOW, MODERATE, HIGH
        private double percentage;  // 0.0 to 100.0

        public String getLevel() { return level; }
        public void setLevel(String level) { this.level = level; }

        public double getPercentage() { return percentage; }
        public void setPercentage(double percentage) { this.percentage = percentage; }
    }
}
