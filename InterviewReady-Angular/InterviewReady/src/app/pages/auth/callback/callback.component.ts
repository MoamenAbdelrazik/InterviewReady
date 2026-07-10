import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { AuthActions } from '../../../store/auth/auth.actions';

/**
 * Google OAuth callback handler.
 * Flow: Google → Backend → redirect to /auth/callback?token=eyJ...
 * This component extracts the token, stores it, and navigates to /dashboard.
 */
@Component({
  selector: 'app-callback',
  template: '',
  standalone: true
})
export class CallbackComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private store = inject(Store);

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token');
    if (token) {
      this.store.dispatch(AuthActions.setToken({ token }));
      // Effect handles: store token → loadProfile → navigate to /dashboard
    } else {
      this.router.navigate(['/auth/login']);
    }
  }
}
