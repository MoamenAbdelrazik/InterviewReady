import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { FinalComprehensiveReport } from '../../shared/models';

export const ReportActions = createActionGroup({
  source: 'Report',
  events: {
    'Load Report':         props<{ interviewId: number }>(),
    'Load Report Success': props<{ report: FinalComprehensiveReport }>(),
    'Load Report Failure': props<{ error: string }>(),
    'Clear Report':        emptyProps(),
  }
});
