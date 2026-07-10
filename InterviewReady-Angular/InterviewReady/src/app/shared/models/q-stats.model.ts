/**
 * Per-question timing and interaction stats.
 * LOCAL ONLY — never sent to the backend.
 * Used for: time-per-question chart, navigation pattern chart,
 * and to compute timeTakenByUser for MCQ/CodingSolution.
 */
export interface QStats {
  cumulativeTimeMs:  number;         // Total time spent on this question (ms)
  firstInteraction:  number | null;  // Timestamp of first visit
  lastInteraction:   number | null;  // Timestamp of last visit
  viewCount:         number;         // How many times user visited this question
}
