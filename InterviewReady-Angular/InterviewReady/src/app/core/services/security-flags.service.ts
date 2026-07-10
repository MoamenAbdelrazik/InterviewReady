import { Injectable, NgZone, inject, signal, OnDestroy } from '@angular/core';
import { SecurityFlags } from '../../shared/models';

/**
 * Tracks security-related events during an interview.
 * Tab switches, copy/paste attempts, multi-tab detection.
 * Each event is logged with the question index that was active at the time.
 *
 * Multi-tab detection strategy:
 *   0. Global: Every app tab registers itself in localStorage + BroadcastChannel on construction
 *   1. Instant: on startTracking(), scan for other global app tabs
 *   2. Continuous: 2-second heartbeat in localStorage during interview
 *   3. Visibility: tab switch auto-flags multipleTabsDetected
 */
@Injectable({ providedIn: 'root' })
export class SecurityFlagsService implements OnDestroy {
  private readonly ngZone = inject(NgZone);
  private _flags = signal<SecurityFlags>({
    tabSwitches: 0,
    copyAttempts: 0,
    pasteAttempts: 0,
    multipleTabsDetected: false,
    totalFlags: 0,
    eventLog: [],
  });

  private channel: BroadcastChannel | null = null;
  private boundVisibility = this.onVisibilityChange.bind(this);
  private boundCopy = this.onCopy.bind(this);
  private boundPaste = this.onPaste.bind(this);
  private boundStorage = this.onStorageEvent.bind(this);
  private active = false;
  private currentInterviewId: number | null = null;

  // Multi-tab detection state
  private tabId = '';
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private readonly HEARTBEAT_MS = 2000;
  private readonly HEARTBEAT_STALE_MS = 30000; // 30s — background tabs throttle setInterval to ~1/min
  private readonly LS_HEARTBEAT_PREFIX = 'ir_heartbeat_';
  private readonly LS_TAB_PREFIX = 'ir_tab_';
  // Global app-level tab presence (set on ANY tab, not just interview tabs)
  private readonly LS_APP_TAB_PREFIX = 'ir_app_tab_';
  private appTabId = '';
  private globalHeartbeatInterval: ReturnType<typeof setInterval> | null = null;

  /** Set this from InterviewComponent whenever the active question changes */
  currentQuestionIndex = 0;

  readonly flags = this._flags.asReadonly();

  constructor() {
    // Register this tab globally so the interview page can detect it later
    if (typeof localStorage !== 'undefined') {
      this.appTabId = 'app_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);

      // Write initial key and start continuous heartbeat so other tabs can verify we're alive
      const writeGlobal = () => {
        try { localStorage.setItem(this.LS_APP_TAB_PREFIX + this.appTabId, String(Date.now())); } catch { /* ignore */ }
      };
      writeGlobal();
      this.globalHeartbeatInterval = setInterval(writeGlobal, this.HEARTBEAT_MS);

      // Cleanup on tab close
      if (typeof window !== 'undefined') {
        window.addEventListener('beforeunload', () => {
          if (this.globalHeartbeatInterval) clearInterval(this.globalHeartbeatInterval);
          try { localStorage.removeItem(this.LS_APP_TAB_PREFIX + this.appTabId); } catch { /* ignore */ }
        });
        // Write a fresh heartbeat when tab goes to background — browsers throttle setInterval
        // in background tabs to ~1/min, but visibilitychange always fires immediately
        document.addEventListener('visibilitychange', () => {
          if (document.hidden) writeGlobal();
        });
      }
    }

    // Global BroadcastChannel — always listening
    try {
      this.channel = new BroadcastChannel('ir_interview_tab');
      this.channel.onmessage = (event) => {
        const data = event.data;
        if (!data || data.tabId === this.tabId) return;
        if (data.type === 'ping' || data.type === 'pong' || data.type === 'open') {
          if (this.active) this.flagMultipleTabs();
          // Always respond to pings so the other tab knows we exist
          if (data.type === 'ping') {
            this.channel?.postMessage({ type: 'pong', tabId: this.tabId || this.appTabId });
          }
        }
      };
    } catch { /* BroadcastChannel not supported */ }
  }

  /** Start tracking — attach all listeners */
  startTracking(interviewId: number): void {
    if (this.active || typeof document === 'undefined') return;
    this.active = true;
    this.currentInterviewId = interviewId;

    // Load from local storage if exists, otherwise reset
    let restored: SecurityFlags | null = null;
    if (typeof localStorage !== 'undefined') {
      const cached = localStorage.getItem(`ir_security_flags_${interviewId}`);
      if (cached) {
        try {
          restored = JSON.parse(cached);
        } catch (e) {
          console.error('Failed to parse cached security flags', e);
        }
      }
    }

    if (restored) {
      this._flags.set(restored);
    } else {
      this._flags.set({
        tabSwitches: 0, copyAttempts: 0, pasteAttempts: 0,
        multipleTabsDetected: false, totalFlags: 0, eventLog: [],
      });
    }

    document.addEventListener('visibilitychange', this.boundVisibility);
    document.addEventListener('copy', this.boundCopy);
    document.addEventListener('paste', this.boundPaste);

    // ── Multi-tab detection ──

    // Generate unique tab ID for this interview session
    this.tabId = 'tab_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);

    // 1) Register this interview tab and scan for other app tabs already open
    this.registerTab();
    this.scanForOtherAppTabs();

    // 2) BroadcastChannel ping to detect already-open tabs
    try {
      this.channel?.postMessage({ type: 'ping', tabId: this.tabId });
    } catch { /* ignore */ }

    // 3) Continuous 2-second heartbeat
    this.writeHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      this.writeHeartbeat();
      this.scanHeartbeats();
      this.scanForOtherAppTabs();
    }, this.HEARTBEAT_MS);

    // 4) Listen for storage events from other tabs
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', this.boundStorage);
    }
  }

  /** Stop tracking — remove all listeners */
  stopTracking(): void {
    if (!this.active || typeof document === 'undefined') return;
    this.active = false;

    document.removeEventListener('visibilitychange', this.boundVisibility);
    document.removeEventListener('copy', this.boundCopy);
    document.removeEventListener('paste', this.boundPaste);

    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', this.boundStorage);
    }

    this.channel?.close();
    this.channel = null;

    // Stop heartbeat and cleanup localStorage entries
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    this.cleanupLocalStorage();
  }

  /** Get current snapshot */
  getFlags(): SecurityFlags {
    return this._flags();
  }

  /** Programmatic copy increment (for Monaco editor Ctrl+C interception) */
  incrementCopy(): void {
    this.update(f => ({
      ...f,
      copyAttempts: f.copyAttempts + 1,
      eventLog: [...f.eventLog, { type: 'copy' as const, questionIndex: this.currentQuestionIndex, timestamp: Date.now() }],
    }));
  }

  /** Programmatic paste increment (for Monaco editor Ctrl+V interception) */
  incrementPaste(): void {
    this.update(f => ({
      ...f,
      pasteAttempts: f.pasteAttempts + 1,
      eventLog: [...f.eventLog, { type: 'paste' as const, questionIndex: this.currentQuestionIndex, timestamp: Date.now() }],
    }));
  }

  ngOnDestroy(): void {
    this.stopTracking();
  }

  // ── Private handlers ──

  private onVisibilityChange(): void {
    if (document.hidden) {
      this.update(f => ({
        ...f,
        tabSwitches: f.tabSwitches + 1,
        // Visibility binding: tab switch auto-flags multipleTabsDetected
        multipleTabsDetected: true,
        eventLog: [...f.eventLog, { type: 'tab' as const, questionIndex: this.currentQuestionIndex, timestamp: Date.now() }],
      }));
    }
  }

  private onCopy(e: Event): void {
    e.preventDefault(); // Block copying during interview
    this.update(f => ({
      ...f,
      copyAttempts: f.copyAttempts + 1,
      eventLog: [...f.eventLog, { type: 'copy' as const, questionIndex: this.currentQuestionIndex, timestamp: Date.now() }],
    }));
  }

  private onPaste(e: Event): void {
    e.preventDefault(); // Block pasting during interview
    this.update(f => ({
      ...f,
      pasteAttempts: f.pasteAttempts + 1,
      eventLog: [...f.eventLog, { type: 'paste' as const, questionIndex: this.currentQuestionIndex, timestamp: Date.now() }],
    }));
  }

  /** React to localStorage changes from other tabs */
  private onStorageEvent(e: StorageEvent): void {
    // Ignore deletions (newValue is null when a tab closes and removes its key)
    if (!e.key || !e.newValue) return;
    // If another tab wrote a heartbeat or interview tab key — flag
    if (e.key.startsWith(this.LS_HEARTBEAT_PREFIX)) {
      const foreignId = e.key.replace(this.LS_HEARTBEAT_PREFIX, '');
      if (foreignId !== this.tabId) {
        this.flagMultipleTabs();
      }
    } else if (e.key.startsWith(this.LS_APP_TAB_PREFIX)) {
      const foreignAppId = e.key.replace(this.LS_APP_TAB_PREFIX, '');
      if (foreignAppId !== this.appTabId) {
        this.flagMultipleTabs();
      }
    }
  }

  // ── Multi-tab helpers ──

  /** Register this tab in localStorage */
  private registerTab(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(this.LS_TAB_PREFIX + this.tabId, String(Date.now()));
    } catch { /* quota exceeded — ignore */ }
  }

  /** Scan for global app-level tab registrations — only flag if timestamp is FRESH (within 5s) */
  private scanForOtherAppTabs(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const now = Date.now();
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.LS_APP_TAB_PREFIX) && key !== this.LS_APP_TAB_PREFIX + this.appTabId) {
          const ts = parseInt(localStorage.getItem(key) || '0', 10);
          if (now - ts < this.HEARTBEAT_STALE_MS) {
            // This tab is alive — its timestamp was updated within the last 5 seconds
            this.flagMultipleTabs();
            return;
          } else {
            // Stale key from a tab that crashed or whose beforeunload failed — clean it up
            localStorage.removeItem(key);
          }
        }
      }
    } catch { /* access denied — ignore */ }
  }

  /** Write heartbeat timestamp to localStorage */
  private writeHeartbeat(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(this.LS_HEARTBEAT_PREFIX + this.tabId, String(Date.now()));
    } catch { /* quota exceeded — ignore */ }
  }

  /** Scan all heartbeats — if any other tab's heartbeat is fresh, flag */
  private scanHeartbeats(): void {
    if (typeof localStorage === 'undefined') return;
    const now = Date.now();
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.LS_HEARTBEAT_PREFIX) && key !== this.LS_HEARTBEAT_PREFIX + this.tabId) {
          const ts = parseInt(localStorage.getItem(key) || '0', 10);
          if (now - ts < this.HEARTBEAT_STALE_MS) {
            this.flagMultipleTabs();
            return;
          } else {
            // Stale heartbeat — clean it up
            localStorage.removeItem(key);
          }
        }
      }
    } catch { /* access denied — ignore */ }
  }

  /** Cleanup this tab's localStorage entries */
  private cleanupLocalStorage(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.removeItem(this.LS_TAB_PREFIX + this.tabId);
      localStorage.removeItem(this.LS_HEARTBEAT_PREFIX + this.tabId);
    } catch { /* ignore */ }
  }

  /** Set multipleTabsDetected flag if not already set */
  private flagMultipleTabs(): void {
    if (!this._flags().multipleTabsDetected) {
      this.update(f => ({ ...f, multipleTabsDetected: true }));
    }
  }

  private update(fn: (f: SecurityFlags) => SecurityFlags): void {
    const next = fn(this._flags());
    next.totalFlags = next.tabSwitches + next.copyAttempts + next.pasteAttempts + (next.multipleTabsDetected ? 1 : 0);
    // Force Angular change detection — setInterval/BroadcastChannel callbacks run outside NgZone
    this.ngZone.run(() => {
      this._flags.set(next);
      if (this.currentInterviewId && typeof localStorage !== 'undefined') {
        try {
          localStorage.setItem(`ir_security_flags_${this.currentInterviewId}`, JSON.stringify(next));
        } catch (e) {
          console.error('Failed to cache security flags', e);
        }
      }
    });
  }
}
