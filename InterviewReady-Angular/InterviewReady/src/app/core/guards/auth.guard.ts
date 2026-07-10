import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

/**
 * Auth guard — protects /dashboard, /interview, /report routes.
 * Checks for JWT token in localStorage and validates its expiration.
 * Redirects to login if absent, expired, or invalid.
 */
export const authGuard: CanActivateFn = () => {
  const router = inject(Router);

  if (typeof localStorage !== 'undefined') {
    const token = localStorage.getItem('ir_token') || sessionStorage.getItem('ir_token');
    if (token) {
      try {
        const parts = token.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(atob(parts[1]));
          const exp = payload.exp;
          if (exp && exp * 1000 < Date.now()) {
            localStorage.removeItem('ir_token');
            localStorage.removeItem('ir_remember');
            sessionStorage.removeItem('ir_token');
            router.navigate(['/auth/login']);
            return false;
          }
          return true;
        }
      } catch (e) {
        localStorage.removeItem('ir_token');
        localStorage.removeItem('ir_remember');
        sessionStorage.removeItem('ir_token');
        router.navigate(['/auth/login']);
        return false;
      }
    }
  }
  router.navigate(['/auth/login']);
  return false;
};
