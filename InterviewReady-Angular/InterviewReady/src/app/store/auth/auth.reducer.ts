import { createReducer, on } from '@ngrx/store';
import { AuthActions } from './auth.actions';
import { AuthState, initialAuthState } from './auth.state';

export const authReducer = createReducer(
  initialAuthState,

  // Login
  on(AuthActions.login, (state): AuthState => ({
    ...state, isLoading: true, error: null
  })),
  on(AuthActions.loginSuccess, (state, { token }): AuthState => ({
    ...state, token, isLoading: false, error: null
  })),
  on(AuthActions.loginFailure, (state, { error }): AuthState => ({
    ...state, isLoading: false, error
  })),

  // Signup
  on(AuthActions.signup, (state): AuthState => ({
    ...state, isLoading: true, error: null
  })),
  on(AuthActions.signupSuccess, (state): AuthState => ({
    ...state, isLoading: false, error: null
  })),
  on(AuthActions.signupFailure, (state, { error }): AuthState => ({
    ...state, isLoading: false, error
  })),

  // Verify
  on(AuthActions.verify, (state): AuthState => ({
    ...state, isLoading: true, error: null
  })),
  on(AuthActions.verifySuccess, (state): AuthState => ({
    ...state, isLoading: false, error: null
  })),
  on(AuthActions.verifyFailure, (state, { error }): AuthState => ({
    ...state, isLoading: false, error
  })),

  // Profile
  on(AuthActions.loadProfile, (state): AuthState => ({
    ...state, isLoading: true
  })),
  on(AuthActions.loadProfileSuccess, (state, { user }): AuthState => ({
    ...state, user, isLoading: false
  })),
  on(AuthActions.loadProfileFailure, (state, { error }): AuthState => ({
    ...state, isLoading: false, error
  })),

  // OAuth callback
  on(AuthActions.setToken, (state, { token }): AuthState => ({
    ...state, token, error: null
  })),

  // Logout
  on(AuthActions.logout, (): AuthState => ({
    ...initialAuthState
  })),

  // Clear error
  on(AuthActions.clearError, (state): AuthState => ({
    ...state, error: null
  })),
);
