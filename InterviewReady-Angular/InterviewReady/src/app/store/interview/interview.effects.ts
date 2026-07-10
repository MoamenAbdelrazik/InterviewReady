import { inject, Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { of } from 'rxjs';
import { catchError, exhaustMap, filter, map, withLatestFrom } from 'rxjs/operators';
import { Router } from '@angular/router';
import { InterviewActions } from './interview.actions';
import { InterviewService } from '../../core/services/interview.service';
import { selectInterviewState } from './interview.selectors';

@Injectable()
export class InterviewEffects {
  private actions$ = inject(Actions);
  private store = inject(Store);
  private interviewService = inject(InterviewService);
  private router = inject(Router);

  startInterview$ = createEffect(() =>
    this.actions$.pipe(
      ofType(InterviewActions.startInterview),
      exhaustMap(({ mode, payload }) =>
        this.interviewService.startInterview(payload).pipe(
          map(res => InterviewActions.startInterviewSuccess({
            interviewId: res.interviewId,
            mcqQuestions: res.mcqQuestions,
            codingQuestions: res.codingQuestions,
          })),
          catchError(err => {
            const msg = err.error?.message || err.error?.error || err.message
              || (err.status === 401 ? 'Session expired — please login again'
              : err.status === 403 ? 'No interview credits remaining'
              : `Server error (${err.status || 'unknown'})`);
            console.error('Interview start failed:', err);
            return of(InterviewActions.startInterviewFailure({ error: msg }));
          })
        )
      )
    )
  );

  startSuccess$ = createEffect(() =>
    this.actions$.pipe(
      ofType(InterviewActions.startInterviewSuccess),
      filter(({ isRecovery }) => !isRecovery),
      map(({ interviewId, mcqQuestions, codingQuestions }) => {
        // Clear all previous stale interview-related keys starting with 'ir_' (except for the auth token 'ir_token')
        if (typeof localStorage !== 'undefined') {
          const keysToRemove: string[] = [];
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('ir_') && key !== 'ir_token') {
              keysToRemove.push(key);
            }
          }
          keysToRemove.forEach(k => localStorage.removeItem(k));

          // Cache new questions in localStorage
          localStorage.setItem('ir_interviewId', String(interviewId));
          localStorage.setItem('ir_mcqQuestions', JSON.stringify(mcqQuestions));
          localStorage.setItem('ir_codingQuestions', JSON.stringify(codingQuestions));
        }
        this.router.navigate(['/interview']);
        return InterviewActions.setCurrentQuestion({ index: 0 });
      })
    )
  );

  submitReport$ = createEffect(() =>
    this.actions$.pipe(
      ofType(InterviewActions.submitReport),
      withLatestFrom(this.store.select(selectInterviewState)),
      exhaustMap(([{ timeTaken }, state]) =>
        this.interviewService.submitReport(state.interviewId!, {
          behaviorData: state.behaviorData!,
          mcqSolutions: state.mcqSolutions,
          codingSolutions: state.codingSolutions,
          timeTaken,
          securityFlags: state.securityFlags,
        }).pipe(
          map(report => InterviewActions.submitReportSuccess({ report })),
          catchError(err => of(InterviewActions.submitReportFailure({
            error: err.error?.message || 'Report submission failed'
          })))
        )
      )
    )
  );

  submitSuccess$ = createEffect(() =>
    this.actions$.pipe(
      ofType(InterviewActions.submitReportSuccess),
      withLatestFrom(this.store.select(selectInterviewState)),
      exhaustMap(([_, state]) => {
        if (typeof localStorage !== 'undefined') {
          const keysToRemove: string[] = [];
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('ir_') && key !== 'ir_token') {
              keysToRemove.push(key);
            }
          }
          keysToRemove.forEach(k => localStorage.removeItem(k));
        }
        // Navigate FIRST, reset state AFTER navigation completes to avoid
        // the interview page re-rendering with zeroed state (the "glitch")
        return this.router.navigate(['/report', state.interviewId]).then(() =>
          InterviewActions.resetInterview()
        );
      })
    )
  );
}
