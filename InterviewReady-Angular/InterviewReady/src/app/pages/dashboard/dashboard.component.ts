import { Component, inject, signal, OnInit, OnDestroy, effect, ViewChild, ElementRef } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { UpperCasePipe } from '@angular/common';
import { Store } from '@ngrx/store';
import { Subscription } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { ReportService } from '../../core/services/report.service';
import { ProfileService } from '../../core/services/profile.service';
import { FeedbackService, FeedbackRequest } from '../../core/services/feedback.service';
import { InterviewService } from '../../core/services/interview.service';
import { InterviewActions } from '../../store/interview/interview.actions';
import { selectInterviewLoading, selectInterviewError } from '../../store/interview/interview.selectors';
import { AuthActions } from '../../store/auth/auth.actions';
import { selectUser } from '../../store/auth/auth.selectors';
import { CandidateDTO, InterviewHistoryDTO, DashboardStatsDTO } from '../../shared/models';

/* ── Default empty-state data (shown before backend connects) ── */
const DEFAULT_USER: CandidateDTO = {
  id: 0,
  firstName: 'Guest',
  lastName: 'User',
  email: 'guest@interviewready.io',
  profileImageUrl: null,
  authProvider: 'LOCAL',
  planName: 'Free',
  remainingQuota: 0,
  totalCredits: 0,
  resetsAt: null,
};

const DEFAULT_STATS: DashboardStatsDTO = {
  totalSessions: 0,
  avgScore: 0,
  passRate: 0,
  bestScore: 0,
};

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink, UpperCasePipe],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
})
export class DashboardComponent implements OnInit, OnDestroy {
  protected readonly Math = Math;
  private router       = inject(Router);
  private authService  = inject(AuthService);
  private reportSvc    = inject(ReportService);
  private profileSvc   = inject(ProfileService);
  private feedbackSvc  = inject(FeedbackService);
  private interviewSvc = inject(InterviewService);
  private store        = inject(Store);
  private subs         = new Subscription();

  /* Close loading overlay only on failure; success navigates away */
  private loadingWatcher = effect(() => {
    const err = this.interviewError();
    if (err && this.showLoadingOverlay()) {
      this.stopLoadingAnimation();
    }
  });

  @ViewChild('fileInput') fileInputRef!: ElementRef<HTMLInputElement>;

  /* ── UI State ── */
  activeTab     = signal<'dashboard' | 'history' | 'feedback' | 'settings'>('dashboard');
  interviewMode = signal<'jd' | 'tpl'>('jd');
  selectedRole  = signal<string>('Backend Engineer');
  jobDescription = signal<string>('');

  /* ── Loading from NgRx store (drives Generate btn spinner) ── */
  isStarting    = this.store.selectSignal(selectInterviewLoading);
  interviewError = this.store.selectSignal(selectInterviewError);

  /* ── Loading Overlay State ── */
  showLoadingOverlay = signal<boolean>(false);
  loadingStep        = signal<number>(0);
  loadingProgress    = signal<number>(0);
  loadingStepText    = signal<string>('Step 1 of 6');
  readonly loadingSteps = [
    'Parsing Job Description',
    'Extracting Technical Competencies',
    'Curating Multiple-Choice Questions',
    'Structuring Technical Scenarios',
    'Synthesizing Coding Challenges',
    'Booting Proctoring Environment...'
  ];
  private loadingTimer: ReturnType<typeof setInterval> | null = null;

  /* ── Feedback Form State ── */
  feedbackRating   = signal<number>(0);
  feedbackCategory = signal<string>('General');
  feedbackMessage  = signal<string>('');
  feedbackSent     = signal<boolean>(false);
  feedbackError    = signal<string | null>(null);

  /* ── Settings Form State ── */
  editFirstName = signal<string>('');
  editLastName  = signal<string>('');
  editEmail     = signal<string>('');
  currentPassword  = signal<string>('');
  newPassword      = signal<string>('');
  confirmPassword  = signal<string>('');
  settingsSaved    = signal<boolean>(false);
  settingsError    = signal<string | null>(null);
  passwordChanged  = signal<boolean>(false);
  passwordError    = signal<string | null>(null);
  deletePassword   = signal<string>('');
  deleteError      = signal<string | null>(null);
  isUploading      = signal<boolean>(false);

  /* ── Data (defaults → real API overwrites on success) ── */
  user    = signal<CandidateDTO>(DEFAULT_USER);
  stats   = signal<DashboardStatsDTO>(DEFAULT_STATS);
  history = signal<InterviewHistoryDTO[]>([]);
  pastFeedbacks = signal<FeedbackRequest[]>([]);

  /* ── Reset countdown ── */
  resetCountdown = signal<string>('No cooldown');
  private resetInterval: ReturnType<typeof setInterval> | null = null;
  private currentTickRate = 30000;
  private hasLoadedFreshProfile = false;
  showDeleteModal = signal<boolean>(false);
  private loadingOverlayTimeout: ReturnType<typeof setTimeout> | null = null;

  /* ── Role Templates (loaded from API, fallback to hardcoded) ── */
  templates = signal<string[]>([
    'Backend Engineer', 'Frontend Engineer', 'Full Stack',
    'Machine Learning', 'Devops Engineer', 'Data Engineer',
    'Mobile Engineer', 'System Design', 'Security Engineer', 'Cloud Architect',
    'Qa Engineer', 'Database Administrator'
  ]);

  /* ── Chart path (generated from history data) ── */
  chartPath = signal<string>('M80,170 L720,170'); // flat line fallback at 0%
  chartFill = signal<string>('M80,170 L720,170 L720,170 L80,170 Z');
  chartRange = signal<30 | 90>(30);
  chartPoints = signal<{ x: number, y: number, score: number, date: string }[]>([]);
  chartLabels = signal<{ text: string, x: number }[]>([]);
  private historySeries: Array<{ score: number; timestamp: number }> = [];

  /* ── History Activity Chart (Dynamic Benchmark Bars) ── */
  historyActivityBars = signal<{ role: string; maxScore: number; barHeight: number; y: number; xCenter: number; barWidth: number; xLeft: number }[]>([]);
  historyActivityChartHeight = signal<number>(350);

  ngOnInit(): void {
    // Reset interview state (clears any previous errors/sessions) on landing
    this.store.dispatch(InterviewActions.resetInterview());

    // 1. Read user from NgRx auth store (already loaded during login)
    this.subs.add(this.store.select(selectUser).subscribe(u => {
      if (u && !this.hasLoadedFreshProfile) {
        this.user.set(u as CandidateDTO);
        this.editFirstName.set(u.firstName ?? '');
        this.editLastName.set(u.lastName ?? '');
        this.editEmail.set(u.email ?? '');
        this.startResetCountdown((u as CandidateDTO).resetsAt ?? null);
      }
    }));

    // 2. Also fetch fresh profile from API (updates NgRx + local)
    this.authService.getProfile().subscribe({
      next: (u) => {
        this.hasLoadedFreshProfile = true;
        this.user.set(u);
        this.editFirstName.set(u.firstName);
        this.editLastName.set(u.lastName);
        this.editEmail.set(u.email);
        this.startResetCountdown(u.resetsAt);
      },
      error: (err) => console.warn('Profile fetch failed:', err.status),
    });

    this.reportSvc.getDashboardStats().subscribe({
      next: (s) => this.stats.set(s),
      error: (err) => console.warn('Stats fetch failed:', err.status),
    });

    this.reportSvc.getHistory().subscribe({
      next: (h) => {
        this.history.set(h);
        this.generateChartFromHistory(h);
      },
      error: (err) => console.warn('History fetch failed:', err.status),
    });



    // Load job profiles from backend (replaces hardcoded templates)
    this.interviewSvc.getJobProfiles().subscribe({
      next: (profiles) => {
        if (profiles.length > 0) {
          this.templates.set(profiles.map(p => p.title));
          this.selectedRole.set(profiles[0].title);
          this.updateHistoryActivityChart();
        }
      },
      error: () => {} // silently fallback to hardcoded list
    });

    // Load past feedbacks
    this.feedbackSvc.list().subscribe({
      next: (f) => this.pastFeedbacks.set(f),
      error: () => {} // silently ignore
    });
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
    if (this.resetInterval) clearInterval(this.resetInterval);
    this.stopLoadingAnimation();
  }

  /* ── Reset countdown timer ── */
  private startResetCountdown(resetsAt: string | null): void {
    // Clear any previous interval to avoid leaks when called multiple times
    if (this.resetInterval) {
      clearInterval(this.resetInterval);
      this.resetInterval = null;
    }

    if (!resetsAt) {
      this.resetCountdown.set('No cooldown');
      return;
    }

    // Client-side safeguard to ensure raw local time strings are parsed as UTC
    let formattedResetsAt = resetsAt;
    if (resetsAt && !resetsAt.endsWith('Z') && !resetsAt.includes('+') && !resetsAt.includes('-')) {
      formattedResetsAt = resetsAt + 'Z';
    }

    const target = new Date(formattedResetsAt).getTime();
    this.currentTickRate = 30000;

    const update = () => {
      const now = Date.now();
      const diff = target - now;
      if (diff <= 0) {
        this.resetCountdown.set('Refreshing…');
        if (this.resetInterval) {
          clearInterval(this.resetInterval);
          this.resetInterval = null;
        }
        // Auto-refresh profile so the UI picks up the reset quota from the backend
        this.authService.getProfile().subscribe({
          next: (u) => {
            this.hasLoadedFreshProfile = true;
            this.user.set(u);
            this.store.dispatch(InterviewActions.resetInterview());
            this.startResetCountdown(u.resetsAt);
          },
          error: () => {
            // If fetch fails, show a manual-refresh hint
            this.resetCountdown.set('Ready now — refresh page');
          },
        });
        return;
      }
      const hours = Math.floor(diff / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      // Show seconds only in the last minute for a smoother UX
      if (hours === 0 && mins === 0) {
        this.resetCountdown.set(`${secs}s left`);
        // Switch to fast 1-second ticks in the last minute
        if (this.currentTickRate !== 1000) {
          if (this.resetInterval) clearInterval(this.resetInterval);
          this.currentTickRate = 1000;
          this.resetInterval = setInterval(update, 1000);
        }
      } else {
        this.resetCountdown.set(`${hours}h ${mins}m left`);
      }
    };
    update();
    // Default to ticking every 30s to keep it lightweight, but fast tick in last min is handled dynamically
    this.resetInterval = setInterval(update, this.currentTickRate);
  }

  /* ── Generate SVG chart path from real history scores ── */
  private generateChartFromHistory(h: InterviewHistoryDTO[]): void {
    this.historySeries = h
      .map(session => {
        const parsed = Date.parse(session.date);
        if (typeof session.finalScore !== 'number' || Number.isNaN(parsed)) return null;
        return { score: session.finalScore, timestamp: parsed };
      })
      .filter((point): point is { score: number; timestamp: number } => point !== null)
      .sort((left, right) => left.timestamp - right.timestamp);

    this.updateChartForRange(this.chartRange());
    this.updateHistoryActivityChart();
  }

  getSmoothPath(points: { x: number; y: number }[]): string {
    if (points.length === 0) return '';
    if (points.length === 1) return `M${points[0].x},${points[0].y}`;
    let path = `M${points[0].x},${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      const p0 = points[i - 1];
      const p1 = points[i];
      const cp1x = p0.x + (p1.x - p0.x) / 2;
      const cp1y = p0.y;
      const cp2x = p0.x + (p1.x - p0.x) / 2;
      const cp2y = p1.y;
      path += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${p1.x},${p1.y}`;
    }
    return path;
  }

  private updateHistoryActivityChart(): void {
    const sessions = this.history();
    const allTemplates = this.templates();

    // Group history by role and find max score for each
    const roleScores: { [role: string]: number } = {};
    
    // Initialize all template roles with 0%
    allTemplates.forEach(t => {
      roleScores[t] = 0;
    });

    // Overwrite with max scores from actual sessions
    sessions.forEach(s => {
      if (typeof s.finalScore === 'number') {
        roleScores[s.role] = Math.max(roleScores[s.role] || 0, s.finalScore);
      }
    });

    // Also include custom roles from user sessions that might not be in templates
    sessions.forEach(s => {
      if (s.role && roleScores[s.role] === undefined) {
        roleScores[s.role] = typeof s.finalScore === 'number' ? s.finalScore : 0;
      }
    });

    // Sort descending by max score, then alphabetically for consistency
    const rolesList = Object.keys(roleScores).sort((a, b) => {
      const scoreDiff = roleScores[b] - roleScores[a];
      if (scoreDiff !== 0) return scoreDiff;
      return a.localeCompare(b);
    });

    const N = rolesList.length || 1;
    const xStart = 60;
    const xEnd = 760;
    const plotWidth = xEnd - xStart;
    const colWidth = plotWidth / N;
    const barWidth = Math.max(12, Math.min(28, colWidth * 0.45));

    const yBottom = 220;
    const yTop = 30;
    const plotHeight = yBottom - yTop; // 190

    const bars = rolesList.map((role, index) => {
      const maxScore = roleScores[role];
      const barHeight = Math.round((maxScore / 100) * plotHeight);
      const y = yBottom - barHeight;
      const xCenter = Math.round(xStart + (index + 0.5) * colWidth);
      const xLeft = Math.round(xCenter - barWidth / 2);
      return {
        role,
        maxScore,
        barHeight,
        y,
        xCenter,
        barWidth,
        xLeft
      };
    });

    this.historyActivityBars.set(bars);
    this.historyActivityChartHeight.set(350);
  }

  private updateChartForRange(range: 30 | 90): void {
    const now = Date.now();
    const daysInMs = 24 * 60 * 60 * 1000;
    const startWindow = now - (range * daysInMs);
    const filteredPoints = this.historySeries
      .filter(point => point.timestamp >= startWindow && point.timestamp <= now);

    // Compute X-axis Date Labels dynamically
    const labelsList: { text: string; x: number }[] = [];
    const steps = 4;
    const xStart = 80, xEnd = 720;
    for (let i = 0; i < steps; i++) {
      const labelTime = startWindow + (i / (steps - 1)) * (range * daysInMs);
      const dateObj = new Date(labelTime);
      const text = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const x = xStart + (i / (steps - 1)) * (xEnd - xStart);
      labelsList.push({ text, x: Math.round(x) });
    }
    this.chartLabels.set(labelsList);

    if (filteredPoints.length === 0) {
      this.chartPath.set('M80,170 L720,170');
      this.chartFill.set('M80,170 L720,170 L720,170 L80,170 Z');
      this.chartPoints.set([]);
      return;
    }

    const yTop = 30, yBottom = 170; // starts at y = 170 (score 0)
    const maxScore = 100;

    const points = filteredPoints.map(point => {
      const elapsed = point.timestamp - startWindow;
      const totalWindow = now - startWindow;
      const frac = totalWindow > 0 ? elapsed / totalWindow : 0.5;
      const x = xStart + frac * (xEnd - xStart);
      const y = yBottom - ((point.score / maxScore) * (yBottom - yTop));
      const dateText = new Date(point.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      return { x: Math.round(x), y: Math.round(y), score: point.score, date: dateText };
    });

    this.chartPoints.set(points);

    if (points.length === 1) {
      const y = points[0].y;
      this.chartPath.set(`M${xStart},${y} L${xEnd},${y}`);
      this.chartFill.set(`M${xStart},${y} L${xEnd},${y} L${xEnd},170 L${xStart},170 Z`);
    } else {
      const pathStr = this.getSmoothPath(points);
      this.chartPath.set(pathStr);
      this.chartFill.set(`${pathStr} L${points[points.length - 1].x},170 L${points[0].x},170 Z`);
    }
  }

  setChartRange(range: 30 | 90): void {
    this.chartRange.set(range);
    this.updateChartForRange(range);
  }

  getLineNumbers(): number[] {
    const lines = this.jobDescription().split(/\r?\n/).length;
    const visible = Math.max(5, lines);
    return Array.from({ length: visible }, (_, index) => index + 1);
  }

  getBestScoreTrendPath(): string {
    const scores = this.historySeries.slice(-5).map(point => point.score);
    const xStart = 0, xEnd = 120, yTop = 4, yBottom = 16;
    if (scores.length === 0) return 'M0,11 C30,16 60,8 90,14 L120,10';

    const xStep = (xEnd - xStart) / Math.max(1, scores.length - 1);
    const points = scores.map((score, index) => {
      const x = xStart + index * xStep;
      const y = yBottom - ((score / 100) * (yBottom - yTop));
      return { x: Math.round(x), y: Math.round(y) };
    });
    return this.getSmoothPath(points);
  }

  getBestScoreTrendFillPath(): string {
    const scores = this.historySeries.slice(-5).map(point => point.score);
    const xStart = 0, xEnd = 120, yBottom = 16;
    if (scores.length === 0) return 'M0,11 C30,16 60,8 90,14 L120,10 L120,20 L0,20 Z';

    const path = this.getBestScoreTrendPath();
    const lastX = scores.length > 1 ? xEnd : 0;
    return `${path} L${lastX},20 L0,20 Z`;
  }

  getTotalSessionsTrendPath(): string {
    const count = this.historySeries.length;
    const xStart = 0, xEnd = 100, yTop = 10, yBottom = 40;
    if (count === 0) return 'M0,35 C20,25 40,45 60,30 C75,20 90,35 100,30';

    const points: { x: number; y: number }[] = [];
    const xStep = (xEnd - xStart) / Math.max(1, count - 1);
    for (let i = 0; i < count; i++) {
      const x = xStart + i * xStep;
      const pct = (i + 1) / count;
      const y = yBottom - pct * (yBottom - yTop);
      points.push({ x: Math.round(x), y: Math.round(y) });
    }
    return this.getSmoothPath(points);
  }

  getTotalSessionsTrendFillPath(): string {
    const count = this.historySeries.length;
    const xStart = 0, xEnd = 100, yBottom = 40;
    if (count === 0) return 'M0,35 C20,25 40,45 60,30 C75,20 90,35 100,30 L100,50 L0,50 Z';

    const path = this.getTotalSessionsTrendPath();
    return `${path} L${xEnd},50 L0,50 Z`;
  }

  getAvgScoreTrendPath(): string {
    const scores = this.historySeries.slice(-5).map(point => point.score);
    const xStart = 0, xEnd = 100, yTop = 10, yBottom = 40;
    if (scores.length === 0) return 'M0,30 C20,40 40,20 60,35 C80,45 90,25 100,30';

    const xStep = (xEnd - xStart) / Math.max(1, scores.length - 1);
    const points = scores.map((score, index) => {
      const x = xStart + index * xStep;
      const y = yBottom - (score / 100) * (yBottom - yTop);
      return { x: Math.round(x), y: Math.round(y) };
    });
    return this.getSmoothPath(points);
  }

  getAvgScoreTrendFillPath(): string {
    const scores = this.historySeries.slice(-5).map(point => point.score);
    const xStart = 0, xEnd = 100, yBottom = 40;
    if (scores.length === 0) return 'M0,30 C20,40 40,20 60,35 C80,45 90,25 100,30 L100,50 L0,50 Z';

    const path = this.getAvgScoreTrendPath();
    const lastX = scores.length > 1 ? xEnd : 0;
    return `${path} L${lastX},50 L0,50 Z`;
  }

  getPassRateTrendPath(): string {
    const history = this.historySeries.slice(-5);
    const xStart = 0, xEnd = 120, yTop = 4, yBottom = 16;
    if (history.length === 0) return 'M0,12 C30,7 60,15 90,9 L120,11';

    let passed = 0;
    const points = history.map((point, index) => {
      if (point.score >= 60) passed++;
      const currentRate = (passed / (index + 1)) * 100;
      const x = xStart + index * ((xEnd - xStart) / Math.max(1, history.length - 1));
      const y = yBottom - (currentRate / 100) * (yBottom - yTop);
      return { x: Math.round(x), y: Math.round(y) };
    });
    return this.getSmoothPath(points);
  }

  getPassRateTrendFillPath(): string {
    const history = this.historySeries.slice(-5);
    const xStart = 0, xEnd = 120, yBottom = 16;
    if (history.length === 0) return 'M0,12 C30,7 60,15 90,9 L120,11 L120,20 L0,20 Z';

    const path = this.getPassRateTrendPath();
    const lastX = history.length > 1 ? xEnd : 0;
    return `${path} L${lastX},20 L0,20 Z`;
  }

  /* ── Tab switching ── */
  switchTab(tab: 'dashboard' | 'history' | 'feedback' | 'settings'): void {
    this.activeTab.set(tab);
    if (tab === 'settings') {
      this.settingsSaved.set(false);
      this.passwordChanged.set(false);
      this.settingsError.set(null);
      this.passwordError.set(null);
    }
    if (tab === 'feedback') {
      this.feedbackSent.set(false);
      this.feedbackError.set(null);
    }
  }

  /* ── Interview Mode ── */
  setMode(mode: 'jd' | 'tpl'): void {
    this.interviewMode.set(mode);
  }

  pickRole(role: string): void {
    this.selectedRole.set(role);
  }

  /* ── Start Interview — dispatches through NgRx + shows loading overlay ── */
  startInterview(): void {
    const mode = this.interviewMode() === 'jd' ? 'A' as const : 'B' as const;
    if (mode === 'B') {
      localStorage.setItem('lastJobTitle', this.selectedRole());
    }
    const payload = mode === 'A'
      ? { jobDescription: this.jobDescription() }
      : { jobTitle: this.selectedRole() };

    this.store.dispatch(InterviewActions.startInterview({ mode, payload }));
    this.showLoadingOverlay.set(true);
    this.loadingStep.set(0);
    this.loadingProgress.set(0);
    this.animateLoadingSteps();
    // Safety fallback: hide loading overlay after 2 minutes to avoid persistent overlay
    if (this.loadingOverlayTimeout) clearTimeout(this.loadingOverlayTimeout);
    this.loadingOverlayTimeout = setTimeout(() => {
      if (this.showLoadingOverlay()) {
        this.stopLoadingAnimation();
      }
    }, 120000);
  }

  /** Animate through loading steps while waiting for backend */
  private animateLoadingSteps(): void {
    const totalSteps = this.loadingSteps.length;
    let currentStep = 0;
    let currentPct = 0;

    const processStep = () => {
      if (currentStep >= totalSteps) {
        // Hold at 99% until backend responds
        this.loadingProgress.set(99);
        return;
      }

      this.loadingStep.set(currentStep);
      const basePct = Math.floor((currentStep / totalSteps) * 100);
      const targetPct = Math.floor(((currentStep + 1) / totalSteps) * 100);
      currentPct = basePct;

      this.loadingTimer = setInterval(() => {
        currentPct += 2;
        if (currentPct >= targetPct) {
          currentPct = targetPct;
          if (this.loadingTimer) clearInterval(this.loadingTimer);

          const displayPct = currentStep === totalSteps - 1 ? Math.min(currentPct, 95) : currentPct;
          this.loadingProgress.set(displayPct);
          this.loadingStepText.set(`Step ${currentStep + 1} of ${totalSteps}`);

          currentStep++;
          setTimeout(processStep, 400 + Math.random() * 800);
        } else {
          this.loadingProgress.set(currentPct);
          this.loadingStepText.set(`Step ${currentStep + 1} of ${totalSteps}`);
        }
      }, 50);
    };

    processStep();
  }

  /** Stop loading animation (called when NgRx state changes) */
  private stopLoadingAnimation(): void {
    if (this.loadingTimer) {
      clearInterval(this.loadingTimer);
      this.loadingTimer = null;
    }
    if (this.loadingOverlayTimeout) { clearTimeout(this.loadingOverlayTimeout); this.loadingOverlayTimeout = null; }
    this.showLoadingOverlay.set(false);
  }

  resetJD(): void {
    this.jobDescription.set('');
  }

  /* ── Settings Actions — WIRED TO API ── */
  saveProfile(): void {
    this.settingsError.set(null);
    this.profileSvc.updateProfile({
      firstName: this.editFirstName(),
      lastName: this.editLastName(),
      username: this.editEmail(), // send the edited email/username
    }).subscribe({
      next: (updated) => {
        this.user.set(updated);
        this.store.dispatch(AuthActions.loadProfile());
        this.settingsSaved.set(true);
        setTimeout(() => this.settingsSaved.set(false), 3000);
      },
      error: (err) => {
        this.settingsError.set(err.error?.message || 'Failed to save profile');
      }
    });
  }

  changePassword(): void {
    this.passwordError.set(null);
    if (this.newPassword() !== this.confirmPassword()) {
      this.passwordError.set('Passwords do not match');
      return;
    }
    if (this.newPassword().length < 6) {
      this.passwordError.set('Password must be at least 6 characters');
      return;
    }
    this.profileSvc.changePassword(this.currentPassword(), this.newPassword()).subscribe({
      next: () => {
        this.passwordChanged.set(true);
        this.currentPassword.set('');
        this.newPassword.set('');
        this.confirmPassword.set('');
        setTimeout(() => this.passwordChanged.set(false), 3000);
      },
      error: (err) => {
        this.passwordError.set(err.error?.message || 'Failed to change password');
      }
    });
  }

  /* ── Feedback — WIRED TO API ── */
  submitFeedback(): void {
    this.feedbackError.set(null);
    if (this.feedbackRating() === 0) {
      this.feedbackError.set('Please select a rating');
      return;
    }
    if (!this.feedbackMessage().trim()) {
      this.feedbackError.set('Please enter a message');
      return;
    }
    this.feedbackSvc.submit({
      rating: this.feedbackRating(),
      category: this.feedbackCategory(),
      message: this.feedbackMessage(),
    }).subscribe({
      next: () => {
        this.feedbackSent.set(true);
        this.feedbackRating.set(0);
        this.feedbackMessage.set('');
        setTimeout(() => this.feedbackSent.set(false), 4000);
      },
      error: (err) => {
        this.feedbackError.set(err.error?.message || 'Failed to send feedback');
      }
    });
  }

  /* ── Upload Photo ── */
  triggerFileInput(): void {
    this.fileInputRef?.nativeElement?.click();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    // Validate client-side
    if (file.size > 2 * 1024 * 1024) {
      alert('File must be under 2 MB');
      return;
    }
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      alert('Only JPG and PNG files are allowed');
      return;
    }

    this.isUploading.set(true);
    this.profileSvc.uploadImage(file).subscribe({
      next: (res) => {
        // Refresh profile to get updated profileImageUrl
        this.authService.getProfile().subscribe(u => {
          this.user.set(u);
          this.isUploading.set(false);
        });
      },
      error: (err) => {
        alert(err.error?.error || 'Upload failed');
        this.isUploading.set(false);
      }
    });
  }

  /* ── Delete Account ── */
  deleteAccount(): void {
    // legacy handler kept for backward compatibility; prefer modal confirm
    this.showDeleteModal.set(true);
  }

  confirmDeleteAccount(): void {
    const isLocal = this.user().authProvider === 'LOCAL';
    if (isLocal && !this.deletePassword()) {
      this.deleteError.set('Please enter your password to confirm deletion.');
      return;
    }
    this.deleteError.set(null);
    this.profileSvc.deleteAccount(isLocal ? this.deletePassword() : undefined).subscribe({
      next: () => {
        this.showDeleteModal.set(false);
        this.authService.logout();
        this.router.navigate(['/auth/login']);
      },
      error: (err) => {
        this.deleteError.set(err.error?.error || 'Failed to delete account');
      }
    });
  }

  getRadialOffset(value: number, max: number): number {
    const circumference = 113.1;
    if (!value || max <= 0) return circumference;
    const pct = Math.min(100, (value / max) * 100);
    return circumference - (pct / 100) * circumference;
  }

  getStreakDays(): number {
    const sessions = this.history();
    if (!sessions || sessions.length === 0) return 0;

    // Extract unique dates (YYYY-MM-DD) from the session dates, sorted in descending order
    const dates = Array.from(new Set(sessions.map(s => {
      const parsed = new Date(s.date);
      if (Number.isNaN(parsed.getTime())) return '';
      const year = parsed.getFullYear();
      const month = String(parsed.getMonth() + 1).padStart(2, '0');
      const day = String(parsed.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }).filter(d => d !== ''))).sort((a, b) => b.localeCompare(a));

    if (dates.length === 0) return 0;

    const todayStr = this.getLocalDateString(new Date());
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = this.getLocalDateString(yesterday);

    const latestDate = dates[0];
    if (latestDate !== todayStr && latestDate !== yesterdayStr) {
      return 0;
    }

    let streak = 0;
    const currentDate = new Date(latestDate);

    while (true) {
      const expectedStr = this.getLocalDateString(currentDate);
      if (dates.includes(expectedStr)) {
        streak++;
        currentDate.setDate(currentDate.getDate() - 1);
      } else {
        break;
      }
    }
    return streak;
  }

  private getLocalDateString(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  getPassRateChange(): number {
    const sessions = this.history();
    if (!sessions || sessions.length < 2) return 0;
    // Compare the last two sessions' scores to compute improvement
    const sorted = [...sessions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const latest = sorted[0]?.finalScore ?? 0;
    const previous = sorted[1]?.finalScore ?? 0;
    return Math.round(latest - previous);
  }

  setRating(r: number): void {
    this.feedbackRating.set(r);
  }

  /* ── Logout ── */
  logout(): void {
    this.authService.logout();
    this.router.navigate(['/auth/login']);
  }

  /* ── Helpers ── */
  getInitials(): string {
    const u = this.user();
    return (u.firstName?.charAt(0) ?? '') + (u.lastName?.charAt(0) ?? '');
  }

  getQuotaPercent(): number {
    const u = this.user();
    if (u.totalCredits === 0) return 0;
    const pct = Math.round((u.remainingQuota / u.totalCredits) * 100);
    return Math.max(0, Math.min(100, pct)); // clamp to 0-100
  }

  /** True when the user has no quota left and is still in cooldown */
  isQuotaExhausted(): boolean {
    const u = this.user();
    if (u.id === 0) return true; // Disable generator while profile is loading (DEFAULT_USER.id is 0)
    return u.remainingQuota <= 0 && u.totalCredits > 0;
  }

  /** Always show a number — never N/A */
  getStatDisplay(val: number): string {
    return String(val);
  }

  getScoreColor(score: number | null): string {
    if (!score) return '#6b7280';
    if (score >= 85) return '#10b981';
    if (score >= 70) return '#3b82f6';
    if (score >= 50) return '#f59e0b';
    return '#ef4444';
  }

  getScoreOffset(score: number | null): number {
    const circumference = 100.53; // 2 * PI * 16
    if (score === null || score === undefined) return circumference;
    return circumference - (score / 100) * circumference;
  }

  formatDuration(seconds: number | null): string {
    if (!seconds) return '--';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s < 10 ? '0' : ''}${s}s`;
  }

  /** Navigate to start a new interview from history empty state */
  goToDashboard(): void {
    this.switchTab('dashboard');
  }

  openReport(id: number): void {
    this.router.navigate(['/report', id]);
  }
}
