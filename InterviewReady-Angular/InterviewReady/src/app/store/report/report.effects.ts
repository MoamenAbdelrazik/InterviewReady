import { inject, Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { of } from 'rxjs';
import { catchError, exhaustMap, map } from 'rxjs/operators';
import { ReportActions } from './report.actions';
import { ReportService } from '../../core/services/report.service';

@Injectable()
export class ReportEffects {
  private actions$ = inject(Actions);
  private reportService = inject(ReportService);

  loadReport$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ReportActions.loadReport),
      exhaustMap(({ interviewId }) =>
        this.reportService.getReport(interviewId).pipe(
          map(report => ReportActions.loadReportSuccess({ report })),
          catchError(err => of(ReportActions.loadReportFailure({
            error: err.error?.message || 'Failed to load report'
          })))
        )
      )
    )
  );
}
