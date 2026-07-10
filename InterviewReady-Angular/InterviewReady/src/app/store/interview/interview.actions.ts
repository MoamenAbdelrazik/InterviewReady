import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { MCQ, Coding, MCQSolution, CodingSolution, SecurityFlags, BehaviorData } from '../../shared/models';
import { FinalComprehensiveReport } from '../../shared/models';

export const InterviewActions = createActionGroup({
  source: 'Interview',
  events: {
    // Start interview
    'Start Interview':         props<{ mode: 'A' | 'B'; payload: { jobDescription?: string; jobTitle?: string } }>(),
    'Start Interview Success': props<{ interviewId: number; mcqQuestions: MCQ[]; codingQuestions: Coding[]; isRecovery?: boolean }>(),
    'Start Interview Failure': props<{ error: string }>(),

    // Navigation
    'Set Current Question':    props<{ index: number }>(),

    // MCQ answer
    'Answer MCQ':              props<{ index: number; solution: MCQSolution }>(),

    // Coding answer
    'Update Coding Solution':  props<{ index: number; solution: CodingSolution }>(),

    // Security events
    'Update Security Flags':   props<{ flags: SecurityFlags }>(),

    // Behavioral data
    'Set Behavior Data':       props<{ data: BehaviorData }>(),

    // Timer
    'Update Time Taken':       props<{ seconds: number }>(),

    // Submit report
    'Submit Report':           props<{ timeTaken: number }>(),
    'Submit Report Success':   props<{ report: FinalComprehensiveReport }>(),
    'Submit Report Failure':   props<{ error: string }>(),

    // Reset
    'Reset Interview':         emptyProps(),
  }
});
