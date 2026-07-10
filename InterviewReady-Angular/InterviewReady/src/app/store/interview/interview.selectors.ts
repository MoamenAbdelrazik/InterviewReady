import { createFeatureSelector, createSelector } from '@ngrx/store';
import { InterviewState } from './interview.state';

export const selectInterviewState = createFeatureSelector<InterviewState>('interview');

export const selectInterviewId      = createSelector(selectInterviewState, s => s.interviewId);
export const selectMcqQuestions     = createSelector(selectInterviewState, s => s.mcqQuestions);
export const selectCodingQuestions  = createSelector(selectInterviewState, s => s.codingQuestions);
export const selectMcqSolutions    = createSelector(selectInterviewState, s => s.mcqSolutions);
export const selectCodingSolutions = createSelector(selectInterviewState, s => s.codingSolutions);
export const selectCurrentQuestion = createSelector(selectInterviewState, s => s.currentQuestion);
export const selectSecurityFlags   = createSelector(selectInterviewState, s => s.securityFlags);
export const selectBehaviorData    = createSelector(selectInterviewState, s => s.behaviorData);
export const selectTimeTaken       = createSelector(selectInterviewState, s => s.timeTaken);
export const selectInterviewMode   = createSelector(selectInterviewState, s => s.mode);
export const selectIsSubmitting    = createSelector(selectInterviewState, s => s.isSubmitting);
export const selectInterviewLoading = createSelector(selectInterviewState, s => s.isLoading);
export const selectInterviewError  = createSelector(selectInterviewState, s => s.error);

// Derived selectors
export const selectTotalQuestions = createSelector(
  selectMcqQuestions, selectCodingQuestions,
  (mcqs, codings) => mcqs.length + codings.length
);

export const selectSolvedCount = createSelector(
  selectMcqSolutions, selectCodingSolutions,
  (mcqs, codings) => mcqs.filter(s => s.isSolved).length + codings.filter(s => s.isSolved).length
);

export const selectMcqScore = createSelector(
  selectMcqSolutions,
  solutions => solutions.reduce((sum, s) => sum + s.questionScore, 0)
);
