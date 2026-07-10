/**
 * Interview history entry from GET /user/interviews/history.
 * finalScore and durationSec are null if interview is still in progress.
 */
export interface InterviewHistoryDTO {
  id:          number;
  role:        string;              // title or "Custom Interview"
  date:        string;              // formatted: "May 2, 2026"
  durationSec: number | null;       // null = in progress
  finalScore:  number | null;       // null = no report yet
  status:      string;              // "Completed" | "In Progress"
  skills:      string[];
}
