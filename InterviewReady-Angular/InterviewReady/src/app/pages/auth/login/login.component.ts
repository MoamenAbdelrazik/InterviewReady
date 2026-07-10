import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import { Subscription } from 'rxjs';
import { AuthActions } from '../../../store/auth/auth.actions';
import { selectAuthLoading, selectAuthError } from '../../../store/auth/auth.selectors';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['../auth.styles.css'],
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink]
})
export class LoginComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private store = inject(Store);
  private authService = inject(AuthService);
  private subs: Subscription[] = [];

  loginForm!: FormGroup;
  isLoading = this.store.selectSignal(selectAuthLoading);
  error = this.store.selectSignal(selectAuthError);

  ngOnInit(): void {
    this.loginForm = this.fb.group({
      username: ['', [Validators.required, Validators.minLength(3)]],
      password: ['', [Validators.required]],
      rememberMe: [false]
    });

    // Clear any previous auth errors
    this.store.dispatch(AuthActions.clearError());

    // Auto-login if a token already exists
    if (typeof localStorage !== 'undefined') {
      const token = localStorage.getItem('ir_token') || sessionStorage.getItem('ir_token');
      if (token) {
        this.store.dispatch(AuthActions.loadProfile());
      }
    }
  }

  getPasswordStrength(): string {
    const pw = this.loginForm.get('password')?.value || '';
    if (pw.length === 0) return '';
    if (pw.length < 8) return 'weak';
    const hasNumber = /\d/.test(pw);
    const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pw);
    const hasUpper = /[A-Z]/.test(pw);
    const hasLower = /[a-z]/.test(pw);
    if (hasNumber && hasSpecial && hasUpper && hasLower) return 'strong';
    const score = [hasNumber, hasSpecial, hasUpper, hasLower].filter(Boolean).length;
    if (score >= 2) return 'medium';
    return 'weak';
  }

  onSubmit(): void {
    if (this.loginForm.invalid) return;

    const { username, password, rememberMe } = this.loginForm.value;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('ir_remember', rememberMe ? 'true' : 'false');
    }
    this.store.dispatch(AuthActions.login({ username, password }));
  }

  googleLogin(): void {
    this.authService.googleLogin();
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
  }
}
