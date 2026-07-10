import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { inject, PLATFORM_ID } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

/**
 * Global HTTP error interceptor.
 * 401 → redirect to login (token expired/invalid)
 * All other errors → pass through for component-level handling
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const platformId = inject(PLATFORM_ID);
  const router = inject(Router);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (isPlatformBrowser(platformId)) {
        if (error.status === 401) {
          localStorage.removeItem('ir_token');
          localStorage.removeItem('ir_remember');
          sessionStorage.removeItem('ir_token');
          router.navigate(['/auth/login']);
        } else if (error.status === 429) {
          alert('You have reached the rate limit. Please wait a moment before trying again.');
        }
      }
      return throwError(() => error);
    })
  );
};
