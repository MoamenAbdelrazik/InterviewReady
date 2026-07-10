import { createReducer, on } from '@ngrx/store';
import { InterviewActions } from './interview.actions';
import { InterviewState, initialInterviewState } from './interview.state';

export const interviewReducer = createReducer(
  initialInterviewState,

  // Start
  on(InterviewActions.startInterview, (state, { mode }): InterviewState => ({
    ...state, mode, isLoading: true, error: null
  })),
  on(InterviewActions.startInterviewSuccess, (state, { interviewId, mcqQuestions, codingQuestions }): InterviewState => ({
    ...state,
    interviewId,
    mcqQuestions,
    codingQuestions,
    mcqSolutions: mcqQuestions.map((q) => ({ question: '', isSolved: false, isRight: false, questionScore: 0, maxScore: q.score, timeTakenByUser: 0, avgTimeSec: 0 })),
    codingSolutions: codingQuestions.map(() => ({ question: '', userCode: '', questionScore: 0, isSolved: false, timeTakenByUser: 0, avgTimeSec: 0, earnedScore: 0 })),
    isLoading: false,
    error: null,
  })),
  on(InterviewActions.startInterviewFailure, (state, { error }): InterviewState => ({
    ...state, isLoading: false, error
  })),

  // Navigation
  on(InterviewActions.setCurrentQuestion, (state, { index }): InterviewState => ({
    ...state, currentQuestion: index
  })),

  // MCQ answer
  on(InterviewActions.answerMCQ, (state, { index, solution }): InterviewState => {
    const mcqSolutions = [...state.mcqSolutions];
    mcqSolutions[index] = solution;
    return { ...state, mcqSolutions };
  }),

  // Coding answer
  on(InterviewActions.updateCodingSolution, (state, { index, solution }): InterviewState => {
    const codingSolutions = [...state.codingSolutions];
    codingSolutions[index] = solution;
    return { ...state, codingSolutions };
  }),

  // Security
  on(InterviewActions.updateSecurityFlags, (state, { flags }): InterviewState => ({
    ...state, securityFlags: flags
  })),

  // Behavior
  on(InterviewActions.setBehaviorData, (state, { data }): InterviewState => ({
    ...state, behaviorData: data
  })),

  // Timer
  on(InterviewActions.updateTimeTaken, (state, { seconds }): InterviewState => ({
    ...state, timeTaken: seconds
  })),

  // Submit
  on(InterviewActions.submitReport, (state): InterviewState => ({
    ...state, isSubmitting: true, error: null
  })),
  on(InterviewActions.submitReportSuccess, (state): InterviewState => ({
    ...state, isSubmitting: false
  })),
  on(InterviewActions.submitReportFailure, (state, { error }): InterviewState => ({
    ...state, isSubmitting: false, error
  })),

  // Reset
  on(InterviewActions.resetInterview, (): InterviewState => ({
    ...initialInterviewState
  })),
);
