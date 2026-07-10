package com.example.interviewReady.DTO;

/**
 * Aggregate stats for the dashboard top-row cards.
 */
public class DashboardStatsDTO {

    private long totalSessions;
    private double avgScore;
    private double passRate;  // percentage 0-100
    private int bestScore;

    public DashboardStatsDTO() {}

    public DashboardStatsDTO(long totalSessions, double avgScore, double passRate, int bestScore) {
        this.totalSessions = totalSessions;
        this.avgScore = avgScore;
        this.passRate = passRate;
        this.bestScore = bestScore;
    }

    public long getTotalSessions() { return totalSessions; }
    public void setTotalSessions(long totalSessions) { this.totalSessions = totalSessions; }

    public double getAvgScore() { return avgScore; }
    public void setAvgScore(double avgScore) { this.avgScore = avgScore; }

    public double getPassRate() { return passRate; }
    public void setPassRate(double passRate) { this.passRate = passRate; }

    public int getBestScore() { return bestScore; }
    public void setBestScore(int bestScore) { this.bestScore = bestScore; }
}
