import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { interviewGuard } from './core/guards/interview.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/landing/landing.component')
      .then(m => m.LandingComponent),
    pathMatch: 'full'
  },
  {
    path: 'auth',
    loadChildren: () => import('./pages/auth/auth.routes')
      .then(m => m.AUTH_ROUTES)
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./pages/dashboard/dashboard.component')
      .then(m => m.DashboardComponent),
    canActivate: [authGuard]
  },
  {
    path: 'interview',
    loadComponent: () => import('./pages/interview/interview.component')
      .then(m => m.InterviewComponent),
    canActivate: [authGuard, interviewGuard]
  },
  {
    path: 'report/:id',
    loadComponent: () => import('./pages/report/report.component')
      .then(m => m.ReportComponent),
    canActivate: [authGuard]
  },
  {
    path: '**',
    redirectTo: ''
  }
];
