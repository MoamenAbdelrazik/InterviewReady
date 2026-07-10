import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class InterviewBootService {
  readonly isBooting = signal(false);

  begin(): void {
    this.isBooting.set(true);
  }

  complete(): void {
    this.isBooting.set(false);
  }
}