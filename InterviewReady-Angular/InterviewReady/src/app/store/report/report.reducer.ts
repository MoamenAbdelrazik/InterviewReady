import { createReducer, on } from '@ngrx/store';
import { ReportActions } from './report.actions';
import { ReportState, initialReportState } from './report.state';

export const reportReducer = createReducer(
  initialReportState,

  on(ReportActions.loadReport, (state): ReportState => ({
    ...state, isProcessing: true, error: null, comprehensiveReport: null
  })),
  on(ReportActions.loadReportSuccess, (state, { report }): ReportState => ({
    ...state, comprehensiveReport: report, isProcessing: false, error: null
  })),
  on(ReportActions.loadReportFailure, (state, { error }): ReportState => ({
    ...state, isProcessing: false, error
  })),
  on(ReportActions.clearReport, (): ReportState => ({
    ...initialReportState
  })),
);
