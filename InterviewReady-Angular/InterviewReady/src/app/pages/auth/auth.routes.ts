import { Routes } from '@angular/router';

export const AUTH_ROUTES: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./login/login.component')
      .then(m => m.LoginComponent)
  },
  {
    path: 'signup',
    loadComponent: () => import('./signup/signup.component')
      .then(m => m.SignupComponent)
  },
  {
    path: 'verify',
    loadComponent: () => import('./verify/verify.component')
      .then(m => m.VerifyComponent)
  },
  {
    path: 'callback',
    loadComponent: () => import('./callback/callback.component')
      .then(m => m.CallbackComponent)
  }
];
