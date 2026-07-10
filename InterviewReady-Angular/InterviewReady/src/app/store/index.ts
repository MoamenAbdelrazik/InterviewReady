import { ActionReducerMap } from '@ngrx/store';
import { AuthState } from './auth/auth.state';
import { InterviewState } from './interview/interview.state';
import { ReportState } from './report/report.state';
import { authReducer } from './auth/auth.reducer';
import { interviewReducer } from './interview/interview.reducer';
import { reportReducer } from './report/report.reducer';

/**
 * Root application state — 3 feature slices.
 */
export interface AppState {
  auth:      AuthState;
  interview: InterviewState;
  report:    ReportState;
}

export const reducers: ActionReducerMap<AppState> = {
  auth:      authReducer,
  interview: interviewReducer,
  report:    reportReducer,
};
