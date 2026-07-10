/**
 * Frontend-built solution for each MCQ question.
 * Graded locally: isRight = (selectedIndex === mcq.answer)
 * questionScore = isRight ? mcq.score : 0
 */
export interface MCQSolution {
  question:        string;         // Full question text
  isSolved:        boolean;        // Was it attempted?
  isRight:         boolean;        // selectedIndex === mcq.answer (0-indexed)
  questionScore:   number;         // 0 if wrong, mcq.score if right
  maxScore:        number;         // Max possible score for this question (mcq.score)
  timeTakenByUser: number;         // Seconds (integer)
  avgTimeSec:      number;         // Benchmark avg time from question DTO
  selectedIndex?:  number;         // The index of the selected MCQ option (0-indexed)
}
