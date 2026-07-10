/**
 * Dashboard aggregate stats from GET /user/interviews/dashboard-stats.
 */
export interface DashboardStatsDTO {
  totalSessions: number;
  avgScore:      number;
  passRate:      number;            // percentage with score >= 60
  bestScore:     number;
}
