import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { map, take } from 'rxjs';
import { selectInterviewId } from '../../store/interview/interview.selectors';

/**
 * Interview guard — prevents accessing /interview without an active interview.
 * User must have started an interview (interviewId exists in store).
 * Redirects to /dashboard if no active interview.
 */
export const interviewGuard: CanActivateFn = () => {
  const store = inject(Store);
  const router = inject(Router);

  return store.select(selectInterviewId).pipe(
    take(1),
    map(id => {
      if (id) {
        return true;
      }
      // Check localStorage for active session recovery
      const cachedId = typeof localStorage !== 'undefined' ? localStorage.getItem('ir_interviewId') : null;
      if (cachedId) {
        return true;
      }
      router.navigate(['/dashboard']);
      return false;
    })
  );
};
