/**
 * MCQ question received from POST /user/interviews/start
 * Both Mode A (LLM-generated) and Mode B (DB pre-made) return the same shape.
 * `answer` is 0-indexed for both modes.
 */
export interface MCQ {
  question: string;
  choices: string[];       // 4 options
  answer: number;         // 0-indexed correct answer index
  score: number;         // EASY=5, MEDIUM=10, HARD=15
  avgTimeSec: number;         // benchmark average time (seconds)
  jobProfileTitle: string;         // e.g. "Backend Developer"
}
