import { createFeatureSelector, createSelector } from '@ngrx/store';
import { ReportState } from './report.state';

export const selectReportState = createFeatureSelector<ReportState>('report');

export const selectComprehensiveReport = createSelector(selectReportState, s => s.comprehensiveReport);
export const selectReportProcessing    = createSelector(selectReportState, s => s.isProcessing);
export const selectReportError         = createSelector(selectReportState, s => s.error);

// Derived selectors for report sections
export const selectBehaviorAnalysis    = createSelector(selectComprehensiveReport, r => r?.behaviorAnalysis ?? null);
export const selectDomainAnalysis      = createSelector(selectComprehensiveReport, r => r?.domainAnalysis ?? null);
export const selectCodingAnalysis      = createSelector(selectComprehensiveReport, r => r?.codingAnalysis ?? null);
export const selectFinalScore          = createSelector(selectComprehensiveReport, r => r?.finalScore ?? 0);
export const selectCheatingProbability = createSelector(selectComprehensiveReport, r => r?.cheatingProbability ?? null);
export const selectRawBehaviorData     = createSelector(selectComprehensiveReport, r => r?.rawBehaviorData ?? null);
export const selectRawMcqSolutions     = createSelector(selectComprehensiveReport, r => r?.rawMcqSolutions ?? []);
export const selectRawCodingSolutions  = createSelector(selectComprehensiveReport, r => r?.rawCodingSolutions ?? []);
