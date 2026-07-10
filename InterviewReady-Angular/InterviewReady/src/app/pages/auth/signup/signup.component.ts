import { Component, inject, OnInit } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import { AuthActions } from '../../../store/auth/auth.actions';
import { selectAuthLoading, selectAuthError } from '../../../store/auth/auth.selectors';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-signup',
  templateUrl: './signup.component.html',
  styleUrls: ['../auth.styles.css'],
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink]
})
export class SignupComponent implements OnInit {
  private fb = inject(FormBuilder);
  private store = inject(Store);
  private authService = inject(AuthService);

  signupForm!: FormGroup;
  isLoading = this.store.selectSignal(selectAuthLoading);
  error = this.store.selectSignal(selectAuthError);

  ngOnInit(): void {
    this.signupForm = this.fb.group({
      firstName: ['', Validators.required],
      lastName:  ['', Validators.required],
      username:  ['', [Validators.required, Validators.minLength(3)]],
      email:     ['', [Validators.required, Validators.email]],
      password:  ['', [Validators.required, Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/)]],
    });

    this.store.dispatch(AuthActions.clearError());
  }

  onSubmit(): void {
    if (this.signupForm.invalid) return;

    const { username, email, password, firstName, lastName } = this.signupForm.value;

    // Store email for verify page
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('ir_verify_email', email);
    }

    this.store.dispatch(AuthActions.signup({ username, email, password, firstName, lastName }));
  }

  googleLogin(): void {
    this.authService.googleLogin();
  }
}
