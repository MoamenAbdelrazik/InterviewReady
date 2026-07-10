import { HttpInterceptorFn } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { inject, PLATFORM_ID } from '@angular/core';

/**
 * Functional HTTP interceptor — attaches JWT token to all outgoing requests.
 * Reads token from localStorage('ir_token').
 * Skips: /register, /verify, /login, /oauth2 (public endpoints).
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const platformId = inject(PLATFORM_ID);

  if (!isPlatformBrowser(platformId)) {
    return next(req);
  }

  const PUBLIC_PATHS = ['/register', '/verify', '/login', '/oauth2'];
  const isPublic = PUBLIC_PATHS.some(path => req.url.includes(path));

  if (isPublic) {
    return next(req);
  }

  const token = localStorage.getItem('ir_token') || sessionStorage.getItem('ir_token');

  if (token) {
    const cloned = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
    return next(cloned);
  }

  return next(req);
};
