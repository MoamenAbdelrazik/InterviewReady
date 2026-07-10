import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';

/**
 * Landing page — redirects to the static front.html (enterprise landing) if logged out,
 * or redirects directly to the dashboard if already authenticated.
 */
@Component({
  selector: 'app-landing',
  template: '',
  standalone: true
})
export class LandingComponent implements OnInit {
  private router = inject(Router);

  ngOnInit(): void {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('ir_token') || sessionStorage.getItem('ir_token');
      if (token) {
        this.router.navigate(['/dashboard']);
      } else {
        window.location.href = '/front.html';
      }
    }
  }
}
