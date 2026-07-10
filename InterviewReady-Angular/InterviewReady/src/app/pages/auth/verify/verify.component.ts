import { Component, inject, OnInit, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { Store } from '@ngrx/store';
import { AuthActions } from '../../../store/auth/auth.actions';
import { selectAuthLoading, selectAuthError } from '../../../store/auth/auth.selectors';

@Component({
  selector: 'app-verify',
  templateUrl: './verify.component.html',
  styleUrls: ['../auth.styles.css'],
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink]
})
export class VerifyComponent implements OnInit {
  private fb = inject(FormBuilder);
  private store = inject(Store);
  private route = inject(ActivatedRoute);

  verifyForm!: FormGroup;
  email = '';
  isLoading = this.store.selectSignal(selectAuthLoading);
  error = this.store.selectSignal(selectAuthError);
  success = signal<string | null>(null);

  ngOnInit(): void {
    // 1. Get email from query parameters (highest priority, survives origin switching)
    this.email = this.route.snapshot.queryParams['email'] || '';

    // 2. Fallback to localStorage
    if (!this.email && typeof localStorage !== 'undefined') {
      this.email = localStorage.getItem('ir_verify_email') || 'your@email.com';
    }

    // 3. Fallback to default if both are empty
    if (!this.email) {
      this.email = 'your@email.com';
    }

    this.verifyForm = this.fb.group({
      code: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(6), Validators.pattern(/^\d{6}$/)]],
    });

    this.store.dispatch(AuthActions.clearError());
  }

  onSubmit(): void {
    if (this.verifyForm.invalid) return;

    const { code } = this.verifyForm.value;
    this.store.dispatch(AuthActions.verify({ email: this.email, code }));
  }
}
