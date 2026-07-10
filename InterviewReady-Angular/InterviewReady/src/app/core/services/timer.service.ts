import { Injectable, signal, computed } from '@angular/core';

/**
 * Interview countdown timer.
 * Emits every second, provides visual state (normal/amber/red).
 */
@Injectable({ providedIn: 'root' })
export class TimerService {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private _totalSeconds = signal(0);
  private _remainingSeconds = signal(0);
  private _isRunning = signal(false);

  readonly remainingSeconds = this._remainingSeconds.asReadonly();
  readonly isRunning = this._isRunning.asReadonly();

  /** Formatted as MM:SS */
  readonly display = computed(() => {
    const s = this._remainingSeconds();
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  });

  /** Timer visual state for CSS class binding */
  readonly timerState = computed<'normal' | 'amber' | 'red'>(() => {
    const s = this._remainingSeconds();
    if (s <= 120) return 'red';     // <=2 min
    if (s <= 600) return 'amber';   // <=10 min
    return 'normal';
  });

  /** Elapsed seconds since start */
  readonly elapsed = computed(() => this._totalSeconds() - this._remainingSeconds());

  /** Start countdown from totalSeconds */
  start(totalSeconds: number): void {
    this.stop();
    this._totalSeconds.set(totalSeconds);
    this._remainingSeconds.set(totalSeconds);
    this._isRunning.set(true);

    this.intervalId = setInterval(() => {
      const next = this._remainingSeconds() - 1;
      if (next <= 0) {
        this._remainingSeconds.set(0);
        this.stop();
      } else {
        this._remainingSeconds.set(next);
      }
    }, 1000);
  }

  /** Pause timer */
  pause(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this._isRunning.set(false);
  }

  /** Resume timer */
  resume(): void {
    if (!this._isRunning() && this._remainingSeconds() > 0) {
      this.start(this._remainingSeconds());
    }
  }

  /** Stop and reset */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this._isRunning.set(false);
  }
}
