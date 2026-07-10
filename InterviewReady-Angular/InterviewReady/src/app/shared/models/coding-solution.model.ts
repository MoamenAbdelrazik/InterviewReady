/**
 * Frontend-built solution for each coding question.
 * questionScore = coding.score (MAX possible score).
 * earnedScore = LLM-evaluated actual score candidate earned (0 to questionScore).
 * The backend LLM evaluates actual quality → returns earnedScore + totalCodingScore in the report.
 */
export interface CodingSolution {
  question:        string;         // Problem statement text
  userCode:        string;         // Raw code string
  questionScore:   number;         // Max possible score (coding.score: 10 or 20)
  earnedScore:     number;         // LLM-evaluated earned score (0 to questionScore)
  isSolved:        boolean;        // false = not attempted
  timeTakenByUser: number;         // Seconds (integer)
  avgTimeSec:      number;         // Benchmark avg time from question DTO
}
