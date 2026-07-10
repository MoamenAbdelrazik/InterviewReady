import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { CandidateDTO } from '../../shared/models';

export const AuthActions = createActionGroup({
  source: 'Auth',
  events: {
    // Login
    'Login':           props<{ username: string; password: string }>(),
    'Login Success':   props<{ token: string }>(),
    'Login Failure':   props<{ error: string }>(),

    // Signup
    'Signup':          props<{ username: string; email: string; password: string; firstName: string; lastName: string }>(),
    'Signup Success':  props<{ message: string; email: string }>(),
    'Signup Failure':  props<{ error: string }>(),

    // Verify
    'Verify':          props<{ email: string; code: string }>(),
    'Verify Success':  props<{ message: string }>(),
    'Verify Failure':  props<{ error: string }>(),

    // Profile
    'Load Profile':          emptyProps(),
    'Load Profile Success':  props<{ user: CandidateDTO }>(),
    'Load Profile Failure':  props<{ error: string; status?: number }>(),

    // OAuth callback
    'Set Token':       props<{ token: string }>(),

    // Logout
    'Logout':          emptyProps(),

    // Clear error
    'Clear Error':     emptyProps(),
  }
});
