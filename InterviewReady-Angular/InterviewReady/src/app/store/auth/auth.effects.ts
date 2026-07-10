import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { of } from 'rxjs';
import { catchError, exhaustMap, map, tap } from 'rxjs/operators';
import { AuthActions } from './auth.actions';
import { AuthService } from '../../core/services/auth.service';

@Injectable()
export class AuthEffects {
  private actions$ = inject(Actions);
  private authService = inject(AuthService);
  private router = inject(Router);
  private platformId = inject(PLATFORM_ID);

  login$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AuthActions.login),
      exhaustMap(({ username, password }) =>
        this.authService.login(username, password).pipe(
          map(res => AuthActions.loginSuccess({ token: res.token })),
          catchError(err => of(AuthActions.loginFailure({
            error: err.error?.message || 'Login failed'
          })))
        )
      )
    )
  );

  loginSuccess$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AuthActions.loginSuccess),
      tap(({ token }) => {
        if (isPlatformBrowser(this.platformId)) {
          const remember = localStorage.getItem('ir_remember') === 'true';
          localStorage.clear();
          sessionStorage.clear();
          if (remember) {
            localStorage.setItem('ir_token', token);
            localStorage.setItem('ir_remember', 'true');
          } else {
            sessionStorage.setItem('ir_token', token);
          }
        }
      }),
      map(() => AuthActions.loadProfile())
    )
  );

  signup$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AuthActions.signup),
      exhaustMap(({ username, email, password, firstName, lastName }) =>
        this.authService.register(username, email, password, firstName, lastName).pipe(
          map(res => AuthActions.signupSuccess({ message: res.message, email })),
          catchError(err => of(AuthActions.signupFailure({
            error: err.error?.message || 'Registration failed'
          })))
        )
      )
    )
  );

  signupSuccess$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AuthActions.signupSuccess),
      tap(({ email }) => this.router.navigate(['/auth/verify'], { queryParams: { email } }))
    ),
    { dispatch: false }
  );

  verify$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AuthActions.verify),
      exhaustMap(({ email, code }) =>
        this.authService.verify(email, code).pipe(
          map(res => AuthActions.verifySuccess({ message: res.message })),
          catchError(err => of(AuthActions.verifyFailure({
            error: err.error?.message || 'Verification failed'
          })))
        )
      )
    )
  );

  verifySuccess$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AuthActions.verifySuccess),
      tap(() => this.router.navigate(['/auth/login']))
    ),
    { dispatch: false }
  );

  setToken$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AuthActions.setToken),
      tap(({ token }) => {
        if (isPlatformBrowser(this.platformId)) {
          localStorage.clear();
          sessionStorage.clear();
          localStorage.setItem('ir_token', token);
        }
      }),
      map(() => AuthActions.loadProfile())
    )
  );

  loadProfile$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AuthActions.loadProfile),
      exhaustMap(() =>
        this.authService.getProfile().pipe(
          map(user => AuthActions.loadProfileSuccess({ user })),
          catchError(err => {
            console.error('loadProfile failed:', err.status, err.error);
            return of(AuthActions.loadProfileFailure({
              error: err.error?.message || err.error?.error || `Profile load failed (${err.status})`,
              status: err.status
            }));
          })
        )
      )
    )
  );

  loadProfileSuccess$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AuthActions.loadProfileSuccess),
      tap(() => this.router.navigate(['/dashboard']))
    ),
    { dispatch: false }
  );

  /** If profile load fails, still navigate to dashboard (data will show defaults) */
  loadProfileFailure$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AuthActions.loadProfileFailure),
      tap((action) => {
        console.warn('Profile load failed:', action.error);
        if (action.status !== 429) {
          this.router.navigate(['/dashboard']);
        }
      })
    ),
    { dispatch: false }
  );

  logout$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AuthActions.logout),
      tap(() => {
        if (isPlatformBrowser(this.platformId)) {
          localStorage.clear();
          sessionStorage.clear();
        }
        this.router.navigate(['/auth/login']);
      })
    ),
    { dispatch: false }
  );
}
