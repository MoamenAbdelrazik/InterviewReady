import { MCQ, Coding, MCQSolution, CodingSolution, QStats, SecurityFlags, BehaviorData } from '../../shared/models';

export interface InterviewState {
  // Interview ID from backend
  interviewId:     number | null;

  // Questions (from POST /start response)
  mcqQuestions:    MCQ[];
  codingQuestions: Coding[];

  // User answers (built during interview)
  mcqSolutions:    MCQSolution[];
  codingSolutions: CodingSolution[];

  // Per-question tracking (local only, NEVER sent)
  qStats:          Record<number, QStats>;

  // Security counters
  securityFlags:   SecurityFlags;

  // Behavioral data (webcam aggregation)
  behaviorData:    BehaviorData | null;

  // Interview metadata
  currentQuestion: number;          // 0-indexed
  isSubmitting:    boolean;
  timeTaken:       number;          // total seconds elapsed

  // Mode
  mode:            'A' | 'B' | null;

  // Status
  isLoading:       boolean;
  error:           string | null;
}

export const initialInterviewState: InterviewState = {
  interviewId:     null,
  mcqQuestions:    [],
  codingQuestions: [],
  mcqSolutions:    [],
  codingSolutions: [],
  qStats:          {},
  securityFlags:   { tabSwitches: 0, copyAttempts: 0, pasteAttempts: 0, multipleTabsDetected: false, totalFlags: 0, eventLog: [] },
  behaviorData:    null,
  currentQuestion: 0,
  isSubmitting:    false,
  timeTaken:       0,
  mode:            null,
  isLoading:       false,
  error:           null,
};
