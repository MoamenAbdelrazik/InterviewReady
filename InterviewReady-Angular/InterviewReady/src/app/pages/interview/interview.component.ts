import { Component, OnInit, OnDestroy, ViewChild, ElementRef, inject, signal, computed, effect, AfterViewInit, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { Subscription, take } from 'rxjs';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { InterviewActions } from '../../store/interview/interview.actions';
import {
  selectMcqQuestions, selectCodingQuestions, selectMcqSolutions, selectCodingSolutions,
  selectCurrentQuestion, selectInterviewLoading, selectTotalQuestions, selectSolvedCount,
  selectSecurityFlags, selectInterviewId, selectIsSubmitting, selectInterviewError
} from '../../store/interview/interview.selectors';
import { MCQ, Coding, MCQSolution, CodingSolution, QStats } from '../../shared/models';
import { TimerService } from '../../core/services/timer.service';
import { SecurityFlagsService } from '../../core/services/security-flags.service';
import { ProctorService } from '../../core/services/proctor.service';
import { selectUser } from '../../store/auth/auth.selectors';
import { InterviewService as InterviewApiService } from '../../core/services/interview.service';

declare const require: any;

@Component({
  selector: 'app-interview',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './interview.component.html',
  styleUrl: './interview.component.css',
})
export class InterviewComponent implements OnInit, OnDestroy, AfterViewInit {
  private store = inject(Store);
  private router = inject(Router);
  readonly timerService = inject(TimerService);
  readonly securityService = inject(SecurityFlagsService);
  readonly proctorService = inject(ProctorService);
  private interviewApiService = inject(InterviewApiService);
  private sanitizer = inject(DomSanitizer);

  @ViewChild('monacoHost') monacoHostRef!: ElementRef;
  @ViewChild('camVideo') camVideoRef!: ElementRef<HTMLVideoElement>;

  private subs = new Subscription();
  private monacoEditor: any = null;
  private codeStore: Record<number, Record<string, string>> = {};  // codingIdx → lang → code
  private qStatsMap: Record<number, { cumulativeTimeMs: number; firstInteraction: number | null; lastInteraction: number | null; viewCount: number }> = {};  // qIndex → stats
  private questionLangStore: Record<number, 'cpp' | 'java' | 'python' | 'javascript'> = {};
  private isSettingValue = false;  // guard against onDidChangeModelContent during programmatic setValue
  private lastQuestionTime = Date.now();
  private interviewId: number | null = null;
  readonly showCancelConfirm = signal(false);

  // ── Voice Assist Fields ──
  readonly isListening = signal(false);
  readonly currentTranscript = signal('');
  private recognition: any = null;
  private recognitionStarted = false;
  private recoveringState = false;
  private candidateName = 'Candidate';
  private silenceTimer: any = null;
  private speechAccumulator = '';
  private pendingVoiceQuery: string | null = null;
  private networkErrorCount = 0;
  private socket$!: WebSocketSubject<any>;
  private chunkBuffer = '';
  private utterances: SpeechSynthesisUtterance[] = [];
  private audioCtx: any = null;
  private analyser: any = null;
  private micStream: any = null;
  private micSource: any = null;
  private vizFrame: any = null;
  private lastRecognitionError: string | null = null;
  private heartbeatInterval: any = null;
  private cachedVoice: SpeechSynthesisVoice | null = null;


  constructor() {
    effect(() => {
      const remaining = this.timerService.remainingSeconds();
      if (remaining === 0 && this.totalQuestions() > 0 && !this.isSubmitting() && !this.isLoading()) {
        this.submitExam();
      }
    });
  }

  // ── Signals from Store ──
  private mcqQuestions = signal<MCQ[]>([]);
  private codingQuestions = signal<Coding[]>([]);
  private mcqSolutions = signal<MCQSolution[]>([]);
  private codingSolutions = signal<CodingSolution[]>([]);
  readonly currentQ = signal(0);
  readonly isLoading = signal(false);
  readonly sidebarCollapsed = signal(false);
  readonly selectedLang = signal<'cpp' | 'java' | 'python' | 'javascript'>('cpp');
  readonly editorReady = signal(true);
  readonly camZoom = signal(1);
  readonly camExpanded = signal(false);
  readonly isSubmitting = signal(false);
  readonly interviewError = signal<string | null>(null);
  readonly submitStep = signal(0);
  readonly submitProgress = signal(0);

  // ── Voice AI (Beta) ──
  readonly voiceSpeaking = signal(false);
  private speechSynth: SpeechSynthesis | null = typeof window !== 'undefined' ? window.speechSynthesis : null;
  private activeUtterance: SpeechSynthesisUtterance | null = null;
  readonly voiceAssistantActive = signal(true);
  readonly userSpeaking = signal(false);
  readonly voiceLoading = signal(false);
  readonly isSocketConnected = signal(false);
  readonly voiceError = signal<string | null>(null);

  // Preload best TTS voice as soon as voices become available
  private preloadVoices(): void {
    if (!this.speechSynth) return;
    const selectBest = () => {
      const voices = this.speechSynth!.getVoices();
      if (voices.length === 0) return;
      const tests = [
        (v: SpeechSynthesisVoice) => /online.*natural/i.test(v.name) && /en/i.test(v.lang) && /guy|andrew|ryan|christopher|eric|steffan/i.test(v.name),
        (v: SpeechSynthesisVoice) => /online.*natural/i.test(v.name) && /en/i.test(v.lang),
        (v: SpeechSynthesisVoice) => /natural/i.test(v.name) && /en/i.test(v.lang),
        (v: SpeechSynthesisVoice) => /google uk english male/i.test(v.name),
        (v: SpeechSynthesisVoice) => /google us english/i.test(v.name),
        (v: SpeechSynthesisVoice) => v.localService && /en/i.test(v.lang) && /david|mark|george|daniel|alex/i.test(v.name),
        (v: SpeechSynthesisVoice) => v.localService && /en-us/i.test(v.lang),
        (v: SpeechSynthesisVoice) => v.localService && /en/i.test(v.lang),
        (v: SpeechSynthesisVoice) => /en/i.test(v.lang),
      ];
      for (const test of tests) {
        const match = voices.find(test);
        if (match) {
          this.cachedVoice = match;
          console.log('Voice AI: Preloaded voice ->', match.name, match.lang);
          return;
        }
      }
    };
    // Try immediately (voices may already be loaded)
    selectBest();
    // Also listen for async voice loading
    this.speechSynth.addEventListener('voiceschanged', () => selectBest());
  }

  // ── Loading animation ──
  readonly loadingStep = signal(0);
  readonly loadingProgress = signal(0);
  private loadingInterval: ReturnType<typeof setInterval> | null = null;

  readonly loadingSteps = [
    { label: 'Analyzing job description...' },
    { label: 'Generating MCQ questions...' },
    { label: 'Generating coding problems...' },
    { label: 'Calibrating difficulty...' },
  ];

  // ── Computed ──
  readonly totalQuestions = computed(() => this.mcqQuestions().length + this.codingQuestions().length);
  readonly solvedCount = computed(() =>
    this.mcqSolutions().filter(s => s.isSolved).length + this.codingSolutions().filter(s => s.isSolved).length
  );
  readonly isCurrentMCQ = computed(() => this.currentQ() < this.mcqQuestions().length);
  readonly currentMCQ = computed(() => {
    if (!this.isCurrentMCQ()) return null;
    const mcq = this.mcqQuestions()[this.currentQ()];
    return {
      ...mcq,
      question: mcq.question.replace(/^Question\s*\d+\s*[:-]?\s*/i, '')
    };
  });
  readonly currentCoding = computed(() => {
    if (this.isCurrentMCQ()) return null;
    return this.codingQuestions()[this.currentQ() - this.mcqQuestions().length] ?? null;
  });
  readonly currentQType = computed(() => this.isCurrentMCQ() ? 'Multiple Choice Question' : 'Coding Problem');
  readonly mcqSelection = computed(() => {
    if (!this.isCurrentMCQ()) return -1;
    const sol = this.mcqSolutions()[this.currentQ()];
    if (!sol || !sol.isSolved) return -1;
    if (sol.selectedIndex !== undefined) return sol.selectedIndex;
    return this.pickedMCQ[this.currentQ()] ?? -1;
  });
  readonly progressPct = computed(() => {
    const total = this.totalQuestions();
    return total > 0 ? Math.round(((this.currentQ() + 1) / total) * 100) : 0;
  });
  readonly roleTitle = computed(() => {
    const mcqs = this.mcqQuestions();
    const title = mcqs.length > 0 && mcqs[0].jobProfileTitle ? mcqs[0].jobProfileTitle : 'Backend Engineer Assessment';
    localStorage.setItem('lastJobTitle', title);
    return title;
  });
  readonly langExtension = computed(() => {
    const map: Record<string, string> = { cpp: 'cpp', java: 'java', python: 'py', javascript: 'js' };
    return map[this.selectedLang()] || 'txt';
  });
  readonly currentCodingDesc = computed<SafeHtml>(() => {
    const c = this.currentCoding();
    if (!c) return '';

    // Strip "Example:" and "Constraints:" blocks generated by the backend LLM,
    // so we can render our own styled blocks instead of having duplicates.
    let rawProblem = c.description || c.problem || '';
    
    // Strip redundant markdown title that matches the problem title
    if (c.problem) {
      const titleRegex = new RegExp(`^#\\s*(?:Question\\s*\\d*\\s*[:-]?\\s*)?${c.problem.replace(/[.*+?^$\{}()|[\]\\]/g, '\\$&')}\\s*\\n+`, 'i');
      rawProblem = rawProblem.replace(titleRegex, '');
    }
    rawProblem = rawProblem.replace(/^#\s*[^\n]+\n+/, ''); // strip any generic leading # title

    const exampleIndex = rawProblem.search(/Example\s*1?:?/i);
    if (exampleIndex !== -1) {
      rawProblem = rawProblem.substring(0, exampleIndex);
    } else {
      const constrIndex = rawProblem.search(/Constraints?:?/i);
      if (constrIndex !== -1) {
        rawProblem = rawProblem.substring(0, constrIndex);
      }
    }

    // Convert markdown to styled HTML:
    // `text` → <code>text</code>  (inline code, blue on dark bg)
    // **text** → <strong>text</strong>  (bold emphasis, white highlight)
    const codify = (s: string) => s
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

    // Build rich HTML matching reference interview.html format exactly
    let html = `<div class="mb-4 text-gray-300">${codify(rawProblem.trim())}</div>`;

    if (c.input?.length > 0 || c.output?.length > 0) {
      html += '<p class="desc-label mt-6">Example:</p>';
      html += '<div class="desc-code-block">';
      c.input?.forEach(inp => { html += `<p class="desc-input">Input: ${codify(inp)}</p>`; });
      c.output?.forEach(outp => { html += `<p class="desc-output">Output: ${codify(outp)}</p>`; });
      html += '</div>';
    }

    if (c.constraints?.length > 0) {
      html += '<p class="desc-label">Constraints:</p><ul class="desc-list">';
      c.constraints.forEach(con => { html += `<li>${codify(con)}</li>`; });
      html += '</ul>';
    }
    return this.sanitizer.bypassSecurityTrustHtml(html);
  });

  // ── New LeetCode-style computed for structured display ──
  readonly currentCodingTitle = computed(() => {
    const c = this.currentCoding();
    return c?.title || c?.problem || 'Coding Problem';
  });

  readonly currentCodingProblemStatement = computed<SafeHtml>(() => {
    const c = this.currentCoding();
    if (!c) return '';
    const codify = (s: string) => s
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*\*([^*]+)\*\*\*/g, '<strong>$1</strong>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    
    let rawProblem = c.description || c.problem || '';
    if (c.problem) {
      const titleRegex = new RegExp(`^#\\s*(?:Question\\s*\\d*\\s*[:-]?\\s*)?${c.problem.replace(/[.*+?^$\{}()|[\]\\]/g, '\\$&')}\\s*\\n+`, 'i');
      rawProblem = rawProblem.replace(titleRegex, '');
    }
    rawProblem = rawProblem.replace(/^#\s*[^\n]+\n+/, '');
    
    // Strip example and constraints — they'll be rendered separately
    const exampleIndex = rawProblem.search(/Example\s*1?:?/i);
    if (exampleIndex !== -1) {
      rawProblem = rawProblem.substring(0, exampleIndex);
    } else {
      const constrIndex = rawProblem.search(/Constraints?:?/i);
      if (constrIndex !== -1) {
        rawProblem = rawProblem.substring(0, constrIndex);
      }
    }
    
    return this.sanitizer.bypassSecurityTrustHtml(codify(rawProblem.trim()));
  });

  readonly currentCodingInputOutput = computed<SafeHtml>(() => {
    const c = this.currentCoding();
    if (!c) return '';
    const codify = (s: string) => s
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*\*([^*]+)\*\*\*/g, '<strong>$1</strong>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    
    if (!c.input?.length && !c.output?.length) return '';

    // Consolidated single dark block for Input + Output
    let html = '<div class="desc-code-block">';
    c.input?.forEach(inp => {
      html += `<p class="desc-input"><strong style="color:#e5e7eb;background:none;border:none;padding:0;">Input:</strong> ${codify(inp)}</p>`;
    });
    c.output?.forEach(outp => {
      html += `<p class="desc-output"><strong style="color:#e5e7eb;background:none;border:none;padding:0;">Output:</strong> ${codify(outp)}</p>`;
    });
    html += '</div>';
    
    return this.sanitizer.bypassSecurityTrustHtml(html);
  });

  readonly currentCodingConstraints = computed<SafeHtml>(() => {
    const c = this.currentCoding();
    if (!c || !c.constraints || c.constraints.length === 0) return '';
    const codify = (s: string) => s
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*\*([^*]+)\*\*\*/g, '<strong>$1</strong>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    
    let html = '<p class="desc-label">Constraints:</p><ul class="desc-list">';
    c.constraints.forEach(con => {
      html += `<li>${codify(con)}</li>`;
    });
    html += '</ul>';
    return this.sanitizer.bypassSecurityTrustHtml(html);
  });

  readonly currentStarterCode = computed(() => {
    const c = this.currentCoding();
    if (!c) return '// Start coding here...\n';
    return this.getStarterCodeForLanguage(c, this.selectedLang()) || '// Start coding here...\n';
  });

  readonly availableLanguages = computed(() => this.getAvailableLanguages(this.currentCoding()));

  readonly allQuestions = computed(() => {
    const mcqs = this.mcqQuestions().map((q, i) => ({
      index: i,
      label: `Q${i + 1}`,
      type: 'MCQ',
      pts: q.score,
      isCoding: false,
      answered: this.mcqSolutions()[i]?.isSolved ?? false,
    }));
    const codes = this.codingQuestions().map((q, i) => ({
      index: this.mcqQuestions().length + i,
      label: `Q${this.mcqQuestions().length + i + 1}`,
      type: 'Coding Task',
      pts: q.score,
      isCoding: true,
      answered: this.codingSolutions()[i]?.isSolved ?? false,
    }));
    return [...mcqs, ...codes];
  });

  private pickedMCQ: Record<number, number> = {}; // qIndex → choiceIndex

  // ── Timer config ──
  private readonly TOTAL_TIME_SECONDS = 60 * 60; // 60 minutes

  ngOnInit(): void {
    // Retrieve candidate name for greeting from store
    this.subs.add(this.store.select(selectUser).subscribe(user => {
      if (user && user.firstName) {
        this.candidateName = user.firstName;
      }
    }));

    // 1. Retrieve interviewId from store or cached localStorage
    let currentId: number | null = null;
    if (typeof localStorage !== 'undefined') {
      const cachedIdStr = localStorage.getItem('ir_interviewId');
      if (cachedIdStr) {
        currentId = parseInt(cachedIdStr, 10);
        this.interviewId = currentId;
        this.connectVoiceSocket();
      }
    }

    this.subs.add(this.store.select(selectInterviewId).subscribe(id => {
      if (id) {
        const isNewId = this.interviewId !== id;
        this.interviewId = id;
        currentId = id;

        if (isNewId) {
          this.securityService.startTracking(id);
          this.connectVoiceSocket();
          if (typeof localStorage !== 'undefined') {
            const cachedEnd = localStorage.getItem(`ir_timer_end_${id}`);
            if (!cachedEnd) {
              const endTime = Date.now() + (this.TOTAL_TIME_SECONDS * 1000);
              localStorage.setItem(`ir_timer_end_${id}`, String(endTime));
            }
          }
        }
      }
    }));

    // 2. Subscribe to store questions and solutions
    this.subs.add(this.store.select(selectMcqQuestions).subscribe(v => this.mcqQuestions.set(v)));
    this.subs.add(this.store.select(selectCodingQuestions).subscribe(v => this.codingQuestions.set(v)));
    
    // Cache solutions to localStorage on changes
    this.subs.add(this.store.select(selectMcqSolutions).subscribe(v => {
      this.mcqSolutions.set(v);
      if (this.recoveringState) return;
      if (this.interviewId && v && v.length > 0 && typeof localStorage !== 'undefined') {
        localStorage.setItem(`ir_mcqSolutions_${this.interviewId}`, JSON.stringify(v));
      }
    }));
    this.subs.add(this.store.select(selectCodingSolutions).subscribe(v => {
      this.codingSolutions.set(v);
      if (this.recoveringState) return;
      if (this.interviewId && v && v.length > 0 && typeof localStorage !== 'undefined') {
        localStorage.setItem(`ir_codingSolutions_${this.interviewId}`, JSON.stringify(v));
      }
    }));

    this.subs.add(this.store.select(selectCurrentQuestion).subscribe(v => {
      this.trackQStats(this.currentQ()); // Save time for previous question
      this.currentQ.set(v);
      this.lastQuestionTime = Date.now();
      if (this.recoveringState) return;
      if (this.interviewId && typeof localStorage !== 'undefined') {
        localStorage.setItem(`ir_currentQ_${this.interviewId}`, String(v));
      }
    }));
    this.subs.add(this.store.select(selectInterviewLoading).subscribe(v => {
      this.isLoading.set(v);
      if (v) this.startLoadingAnimation();
      else {
        this.stopLoadingAnimation();
        // Speak entrance rules once interview is loaded
        setTimeout(() => this.speakEntranceMessage(), 800);
        if (this.voiceAssistantActive()) {
          this.startVisualizer();
        }
      }
    }));

    // Add document click listener to resume speech/trigger welcome greeting on first interaction if blocked by autoplay
    const resumeSpeech = () => {
      if (!this.entranceSpoken && !this.isLoading() && this.mcqQuestions().length > 0) {
        this.speakEntranceMessage();
      }
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        this.audioCtx.resume().catch((e: any) => console.warn('Failed to resume AudioContext on interaction:', e));
      }
    };
    document.addEventListener('click', resumeSpeech, { once: true });
    document.addEventListener('keydown', resumeSpeech, { once: true });
    this.subs.add(this.store.select(selectIsSubmitting).subscribe(v => {
      this.isSubmitting.set(v);
      if (v) {
        this.submitStep.set(0);
        this.submitProgress.set(0);
        this.animateSubmitProgress();
      }
    }));
    this.subs.add(this.store.select(selectInterviewError).subscribe(v => {
      this.interviewError.set(v);
    }));

    // 3. State recovery on F5 hard refresh
    if (typeof localStorage !== 'undefined') {
      const cachedMcq = localStorage.getItem('ir_mcqQuestions');
      const cachedCoding = localStorage.getItem('ir_codingQuestions');
      if (cachedMcq && cachedCoding && currentId) {
        try {
          const mcqQs = JSON.parse(cachedMcq) as MCQ[];
          const codingQs = JSON.parse(cachedCoding) as Coding[];
          
          this.store.select(selectMcqQuestions).pipe(take(1)).subscribe(storeMcqs => {
            if (storeMcqs.length === 0) {
              this.recoveringState = true;
              this.store.dispatch(InterviewActions.startInterviewSuccess({
                interviewId: currentId!,
                mcqQuestions: mcqQs,
                codingQuestions: codingQs,
                isRecovery: true
              }));
              this.connectVoiceSocket();

              // Restore saved solutions
              const savedMcqSol = localStorage.getItem(`ir_mcqSolutions_${currentId}`);
              if (savedMcqSol) {
                const mcqSols = JSON.parse(savedMcqSol) as MCQSolution[];
                mcqSols.forEach((sol, idx) => {
                  if (sol.isSolved) {
                    this.store.dispatch(InterviewActions.answerMCQ({ index: idx, solution: sol }));
                    if (sol.selectedIndex !== undefined) {
                      this.pickedMCQ[idx] = sol.selectedIndex;
                    }
                  }
                });
              }

              const savedCodingSol = localStorage.getItem(`ir_codingSolutions_${currentId}`);
              if (savedCodingSol) {
                const codingSols = JSON.parse(savedCodingSol) as CodingSolution[];
                codingSols.forEach((sol, idx) => {
                  if (sol.isSolved) {
                    this.store.dispatch(InterviewActions.updateCodingSolution({ index: idx, solution: sol }));
                  }
                });
              }

              const savedCurrentQ = localStorage.getItem(`ir_currentQ_${currentId}`);
              if (savedCurrentQ) {
                const qIdx = parseInt(savedCurrentQ, 10);
                this.store.dispatch(InterviewActions.setCurrentQuestion({ index: qIdx }));
              }

              // Restore codeStore and questionLangStore
              const savedCodeStore = localStorage.getItem(`ir_codeStore_${currentId}`);
              if (savedCodeStore) {
                this.codeStore = JSON.parse(savedCodeStore);
              }
              const savedQuestionLang = localStorage.getItem(`ir_questionLangStore_${currentId}`);
              if (savedQuestionLang) {
                this.questionLangStore = JSON.parse(savedQuestionLang);
              }

              setTimeout(() => {
                this.recoveringState = false;
              }, 200);
            }
          });
        } catch (e) {
          console.error('Failed to restore cached interview state', e);
        }
      }
    }

    // If no questions loaded (direct navigation), check if we should redirect
    setTimeout(() => {
      if (this.mcqQuestions().length === 0 && !this.isLoading()) {
        const cached = typeof localStorage !== 'undefined' ? localStorage.getItem('ir_mcqQuestions') : null;
        if (!cached) {
          this.router.navigate(['/dashboard']);
        }
      }
    }, 500);

    // 4. Start security tracking if interviewId is resolved
    if (this.interviewId) {
      this.securityService.startTracking(this.interviewId);
    }

    // 5. Timer recovery / start
    let remainingTime = this.TOTAL_TIME_SECONDS;
    if (typeof localStorage !== 'undefined' && this.interviewId) {
      const cachedEnd = localStorage.getItem(`ir_timer_end_${this.interviewId}`);
      if (cachedEnd) {
        const endTime = parseInt(cachedEnd, 10);
        const diffSeconds = Math.round((endTime - Date.now()) / 1000);
        if (diffSeconds > 0) {
          remainingTime = diffSeconds;
        } else {
          remainingTime = 0;
        }
      } else {
        const endTime = Date.now() + (this.TOTAL_TIME_SECONDS * 1000);
        localStorage.setItem(`ir_timer_end_${this.interviewId}`, String(endTime));
      }
    }
    this.timerService.start(remainingTime);

    // Start camera
    this.initCamera();

    // Initialize speech recognition and preload TTS voices
    this.initSpeechRecognition();
    this.preloadVoices();

    // Preload Monaco Editor scripts in the background
    if (typeof window !== 'undefined') {
      const win = window as any;
      if (!win.monaco) {
        win.require = { paths: { vs: '/assets/monaco/vs' } };
        const script = document.createElement('script');
        script.src = '/assets/monaco/vs/loader.js';
        script.onload = () => {
          win.require(['vs/editor/editor.main'], () => {
            console.log('Monaco preloaded successfully in background');
          });
        };
        script.onerror = () => {
          console.error('Failed to preload Monaco editor');
        };
        document.head.appendChild(script);
      }
    }
  }

  ngAfterViewInit(): void {
    this.initCameraDrag();
    this.initPanelResizer();

    if (!this.isCurrentMCQ()) {
      const coding = this.currentCoding();
      if (coding) {
        this.selectedLang.set(this.getPreferredLanguage(coding));
      }
      const win = typeof window !== 'undefined' ? (window as any) : null;
      const monacoPreloaded = win && !!win.monaco;
      if (!monacoPreloaded && !this.monacoEditor) {
        this.editorReady.set(false);
      }
      setTimeout(() => {
        if (!this.monacoEditor) {
          this.initMonaco();
        } else {
          this.loadCodeForCurrentQuestion();
          this.monacoEditor.layout();
        }
      }, 0);
    }
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
    this.timerService.stop();
    this.securityService.stopTracking();
    this.proctorService.stopCamera();
    this.stopLoadingAnimation();
    this.stopVoice();
    this.setVoiceAssistantActive(false);
    this.monacoEditor?.dispose();
    // Clean up WebSocket
    if (this.socket$) {
      try { this.socket$.complete(); } catch (e) {}
      this.socket$ = null as any;
    }
    // Clean up speech recognition
    if (this.recognition) {
      try { this.recognition.abort(); } catch (e) {}
      this.recognitionStarted = false;
    }
    // Clean up silence timer
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
    // Clean up mic stream
    if (this.micStream) {
      this.micStream.getTracks().forEach((t: any) => t.stop());
      this.micStream = null;
    }
    // Clean up audio context
    if (this.audioCtx) {
      try { this.audioCtx.close(); } catch (e) {}
      this.audioCtx = null;
    }
    // Clean up heartbeat
    this.stopHeartbeat();
    // Clean up visualizer animation frame
    if (this.vizFrame) {
      cancelAnimationFrame(this.vizFrame);
      this.vizFrame = null;
    }
  }

  // ── Actions ──

  toggleSidebar(): void {
    this.sidebarCollapsed.update(v => !v);
  }

  goToQuestion(index: number): void {
    // Save current coding code before switching
    this.saveCurrentCodeToStore();

    this.store.dispatch(InterviewActions.setCurrentQuestion({ index }));
    // Sync active question for per-event security attribution
    this.securityService.currentQuestionIndex = index;
    
    // Initialize Monaco if switching to coding
    if (index >= this.mcqQuestions().length) {
      const codingIdx = index - this.mcqQuestions().length;
      const win = typeof window !== 'undefined' ? (window as any) : null;
      const monacoPreloaded = win && !!win.monaco;
      if (!monacoPreloaded && !this.monacoEditor) {
        this.editorReady.set(false);
      }
      this.selectedLang.set(this.questionLangStore[codingIdx] ?? this.getPreferredLanguage(this.codingQuestions()[codingIdx]));
      setTimeout(() => {
        // If editor exists but its container is detached (because of *ngIf / @if), dispose it
        if (this.monacoEditor && (!this.monacoHostRef || !document.body.contains(this.monacoHostRef.nativeElement) || this.monacoHostRef.nativeElement.children.length === 0)) {
          this.monacoEditor.dispose();
          this.monacoEditor = null;
        }

        if (!this.monacoEditor) {
          this.initMonaco();
          // If win.monaco was preloaded, the editor gets created synchronously in initMonaco()
          if (this.monacoEditor) {
            this.loadCodeForCurrentQuestion();
            this.monacoEditor.layout();
          } else {
            // Fallback for asynchronous script load if not preloaded yet
            setTimeout(() => {
              if (this.monacoEditor) {
                this.loadCodeForCurrentQuestion();
                this.monacoEditor.layout();
              }
            }, 50);
          }
        } else {
          // Editor already exists and is attached, just load the code for this question
          this.loadCodeForCurrentQuestion();
          // Trigger layout recalculation immediately
          if (this.monacoEditor) {
            this.monacoEditor.layout();
            this.editorReady.set(true);
          }
          // Extra layout tick to ensure correctness
          setTimeout(() => {
            if (this.monacoEditor) this.monacoEditor.layout();
          }, 50);
        }
      }, 0);
    }
  }

  nav(delta: number): void {
    const next = this.currentQ() + delta;
    if (next >= 0 && next < this.totalQuestions()) {
      this.goToQuestion(next);
    }
  }

  pickMCQ(choiceIndex: number): void {
    const qi = this.currentQ();
    const mcq = this.currentMCQ()!;
    const solution: MCQSolution = {
      question: mcq.question,
      isSolved: true,
      isRight: false,
      questionScore: 0,
      maxScore: mcq.score,
      timeTakenByUser: this.getQTime(qi),
      avgTimeSec: mcq.avgTimeSec || 60,
      selectedIndex: choiceIndex,
    };
    this.pickedMCQ[qi] = choiceIndex;
    this.store.dispatch(InterviewActions.answerMCQ({ index: qi, solution }));
  }

  changeLang(lang: string): void {
    const nextLang = lang as 'cpp' | 'java' | 'python' | 'javascript';
    const codingIdx = this.currentQ() - this.mcqQuestions().length;
    if (codingIdx >= 0) {
      this.saveCurrentCodeToStore();
      this.questionLangStore[codingIdx] = nextLang;
      this.saveCodeStoreToCache();
    }
    this.selectedLang.set(nextLang);
    if (this.monacoEditor) {
      const model = this.monacoEditor.getModel();
      if (model) {
        const langMap: Record<string, string> = { cpp: 'cpp', java: 'java', python: 'python', javascript: 'javascript' };
        (window as any).monaco?.editor?.setModelLanguage(model, langMap[nextLang] || 'plaintext');
      }

      this.loadCodeForCurrentQuestion();
      this.monacoEditor.layout();
    }
  }

  swapPanels(): void {
    const panels = document.getElementById('code-panels');
    if (!panels) return;
    const current = panels.style.flexDirection;
    panels.style.flexDirection = current === 'row-reverse' ? 'row' : 'row-reverse';
  }

  zoomCam(delta: number): void {
    const next = Math.max(1, Math.min(3, this.camZoom() + delta * 0.5));
    this.camZoom.set(next);
  }

  toggleCamSize(): void {
    this.camExpanded.update(v => !v);
  }

  submitExam(): void {
    if (this.isSubmitting()) return;

    // Finalize qStats for current question
    this.trackQStats(this.currentQ());

    // Update all MCQ solutions with final time stats
    const mcqs = this.mcqQuestions();
    this.mcqSolutions().forEach((sol, i) => {
      if (sol) {
        const updated = { ...sol, timeTakenByUser: this.getQTime(i) };
        this.store.dispatch(InterviewActions.answerMCQ({ index: i, solution: updated }));
      }
    });

    // Update all coding solutions with latest code and time stats
    const codings = this.codingQuestions();
    const mcqCount = mcqs.length;
    
    // FORCE-SAVE current editor content if user is actively on a coding question right now.
    // This absolutely guarantees their very last keystroke before clicking Submit is captured.
    if (!this.isCurrentMCQ() && this.monacoEditor) {
      const codingIdx = this.currentQ() - mcqCount;
      if (codingIdx >= 0 && codingIdx < codings.length) {
        const lang = this.selectedLang();
        this.codeStore[codingIdx] ??= {};
        this.codeStore[codingIdx][lang] = this.monacoEditor.getValue() || '';
        this.questionLangStore[codingIdx] = lang;
      }
    }

    codings.forEach((coding, i) => {
      const globalIdx = mcqCount + i;
      // Guarantee we capture the code for the exact language they last selected for this question
      const lang = this.questionLangStore[i] ?? this.getPreferredLanguage(coding);
      const code = this.codeStore[i]?.[lang] || '';
      const starterCode = this.getStarterCodeForLanguage(coding, lang);
      
      const solution: CodingSolution = {
        question: coding.problem,
        userCode: code,
        questionScore: coding.score,
        isSolved: code.trim().length > 10 && code.trim() !== (starterCode || '').trim(),
        timeTakenByUser: this.getQTime(globalIdx),
        avgTimeSec: coding.avgTimeSec || 180,
        earnedScore: 0,
      };
      this.store.dispatch(InterviewActions.updateCodingSolution({ index: i, solution }));
    });

    // Stop timer and security tracking immediately
    this.timerService.stop();
    this.securityService.stopTracking();

    // Generate behavioral data
    const elapsed = this.timerService.elapsed();
    const behaviorData = this.proctorService.generateBehaviorData(
      elapsed,
      this.totalQuestions(),
      this.securityService.getFlags(),
      Array.from({ length: this.totalQuestions() }, (_, i) => this.qStatsMap[i]?.viewCount ?? 1)
    );
    this.store.dispatch(InterviewActions.setBehaviorData({ data: behaviorData }));
    this.store.dispatch(InterviewActions.updateSecurityFlags({ flags: this.securityService.getFlags() }));

    // Submit
    this.store.dispatch(InterviewActions.submitReport({ timeTaken: elapsed }));
  }

  retrySubmit(): void {
    const elapsed = this.timerService.elapsed();
    this.store.dispatch(InterviewActions.submitReport({ timeTaken: elapsed }));
  }

  // ── Submit progress animation (matches reference interview.html) ──
  private animateSubmitProgress(): void {
    const totalSteps = 4;
    let currentStep = 0;

    const processStep = () => {
      if (currentStep >= totalSteps) return; // done — wait for backend redirect

      // Mark previous steps as done
      this.submitStep.set(currentStep);

      const basePct = Math.floor((currentStep / totalSteps) * 100);
      const targetPct = Math.floor(((currentStep + 1) / totalSteps) * 100);
      let currentPct = basePct;

      const iv = setInterval(() => {
        currentPct += 2;
        if (currentPct >= targetPct) {
          currentPct = targetPct;
          clearInterval(iv);
          this.submitProgress.set(currentStep === totalSteps - 1 ? 99 : currentPct);
          currentStep++;
          setTimeout(processStep, 600 + Math.random() * 800);
        } else {
          this.submitProgress.set(currentPct);
        }
      }, 50);
    };

    processStep();
  }

  // ── Private helpers ──

  private async initCamera(): Promise<void> {
    const stream = await this.proctorService.startCamera();
    if (stream) {
      // Set video source first, then start frame capture with the element
      setTimeout(async () => {
        if (this.camVideoRef?.nativeElement) {
          this.camVideoRef.nativeElement.srcObject = stream;
          // Wait for video to be ready before starting face-api detection
          this.camVideoRef.nativeElement.onloadeddata = async () => {
            await this.proctorService.startFrameCapture(this.camVideoRef.nativeElement);
          };
        }
      }, 200);
    }
  }

  // ── Camera Dragging (matches reference interview.html) ──
  private dragState = { isDragging: false, startX: 0, startY: 0 };
  private boundDragMove = this.onDragMove.bind(this);
  private boundDragEnd = this.onDragEnd.bind(this);

  private initCameraDrag(): void {
    // Deferred – runs when the widget is rendered
    const check = setInterval(() => {
      const el = document.getElementById('cam-widget');
      if (el) {
        clearInterval(check);
        el.addEventListener('mousedown', (e: MouseEvent) => this.onDragStart(e));
        el.addEventListener('touchstart', (e: TouchEvent) => this.onTouchDragStart(e), { passive: false });
      }
    }, 500);
  }

  private onDragStart(e: MouseEvent): void {
    // Ignore clicks on controls
    if ((e.target as HTMLElement).closest('.cam-controls, .cam-fullscreen')) return;
    const el = document.getElementById('cam-widget');
    if (!el) return;
    this.dragState.isDragging = true;
    const rect = el.getBoundingClientRect();
    this.dragState.startX = e.clientX - rect.left;
    this.dragState.startY = e.clientY - rect.top;
    el.style.transition = 'none';
    document.addEventListener('mousemove', this.boundDragMove);
    document.addEventListener('mouseup', this.boundDragEnd);
    e.preventDefault();
  }

  private onTouchDragStart(e: TouchEvent): void {
    if ((e.target as HTMLElement).closest('.cam-controls, .cam-fullscreen')) return;
    const el = document.getElementById('cam-widget');
    if (!el) return;
    const t = e.touches[0];
    this.dragState.isDragging = true;
    const rect = el.getBoundingClientRect();
    this.dragState.startX = t.clientX - rect.left;
    this.dragState.startY = t.clientY - rect.top;
    el.style.transition = 'none';

    document.addEventListener('touchmove', (ev) => {
      if (!this.dragState.isDragging) return;
      const touch = ev.touches[0];
      el.style.left = (touch.clientX - this.dragState.startX) + 'px';
      el.style.top = (touch.clientY - this.dragState.startY) + 'px';
      el.style.right = 'auto';
      el.style.bottom = 'auto';
    }, { passive: false });

    document.addEventListener('touchend', () => { 
      this.dragState.isDragging = false; 
      if (el) el.style.transition = '';
    }, { once: true });
    e.preventDefault();
  }

  private onDragMove(e: MouseEvent): void {
    if (!this.dragState.isDragging) return;
    const el = document.getElementById('cam-widget');
    if (!el) return;
    el.style.left = (e.clientX - this.dragState.startX) + 'px';
    el.style.top = (e.clientY - this.dragState.startY) + 'px';
    el.style.right = 'auto';
    el.style.bottom = 'auto';
  }

  private onDragEnd(): void {
    this.dragState.isDragging = false;
    const el = document.getElementById('cam-widget');
    if (el) el.style.transition = '';
    document.removeEventListener('mousemove', this.boundDragMove);
    document.removeEventListener('mouseup', this.boundDragEnd);
  }

  // ── Panel Resizer (matches reference interview.html) ──
  private initPanelResizer(): void {
    const check = setInterval(() => {
      const resizer = document.getElementById('panel-resizer');
      const problemPanel = document.getElementById('problem-panel');
      const panels = document.getElementById('code-panels');
      if (resizer && problemPanel && panels) {
        clearInterval(check);
        let isResizing = false;
        resizer.addEventListener('mousedown', (e: MouseEvent) => {
          isResizing = true;
          document.body.style.cursor = 'col-resize';
          e.preventDefault();
        });
        document.addEventListener('mousemove', (e: MouseEvent) => {
          if (!isResizing) return;
          const rect = panels.getBoundingClientRect();
          const pct = ((e.clientX - rect.left) / rect.width) * 100;
          const clamped = Math.max(20, Math.min(80, pct));
          problemPanel.style.flex = `0 0 ${clamped}%`;
        });
        document.addEventListener('mouseup', () => {
          if (isResizing) {
            isResizing = false;
            document.body.style.cursor = '';
          }
        });
      }
    }, 500);
  }

  private initMonaco(): void {
    // If editor already exists and is healthy, just load the code
    if (this.monacoEditor && !this.monacoEditor.isDisposed?.()) {
      this.loadCodeForCurrentQuestion();
      return;
    }

    if (typeof window === 'undefined') return;
    
    const hostEl = this.monacoHostRef?.nativeElement;
    if (!hostEl) return;

    // Clear any previous editor
    if (this.monacoEditor) {
      try {
        this.monacoEditor.dispose();
      } catch (e) {
        console.warn('Error disposing Monaco editor:', e);
      }
      this.monacoEditor = null;
    }

    const win = window as any;
    if (win.monaco) {
      this.createEditor(hostEl);
      return;
    }

    // Load Monaco AMD
    this.editorReady.set(false);
    win.require = { paths: { vs: '/assets/monaco/vs' } };
    const script = document.createElement('script');
    script.src = '/assets/monaco/vs/loader.js';
    script.onload = () => {
      win.require(['vs/editor/editor.main'], () => {
        this.createEditor(hostEl);
      });
    };
    script.onerror = () => {
      console.error('Failed to load Monaco editor');
    };
    document.head.appendChild(script);
  }

  private createEditor(container: HTMLElement): void {
    const win = window as any;
    const langMap: Record<string, string> = { cpp: 'cpp', java: 'java', python: 'python', javascript: 'javascript' };

    if (!win.monaco) {
      console.error('Monaco not loaded');
      return;
    }

    // Clear container
    container.innerHTML = '';

    // Define premium theme matching reference interview.html exactly
    try {
      win.monaco.editor.defineTheme('leetcodeDark', {
        base: 'vs-dark', inherit: true,
        rules: [
          { background: '000000' },
          { token: 'comment', foreground: '6a9955', fontStyle: 'italic' },
          { token: 'keyword', foreground: 'c586c0', fontStyle: 'bold' },
          { token: 'string', foreground: 'ce9178' },
          { token: 'number', foreground: 'b5cea8' },
          { token: 'type', foreground: '4ec9b0', fontStyle: 'bold' },
          { token: 'identifier', foreground: '9cdcfe' },
          { token: 'variable', foreground: '9cdcfe' },
          { token: 'variable.predefined', foreground: '4fc1ff' },
          { token: 'variable.parameter', foreground: '9cdcfe' },
          { token: 'constant', foreground: '4fc1ff' },
          { token: 'entity.name.function', foreground: 'dcdcaa' },
          { token: 'operator', foreground: 'd4d4d4' },
          { token: 'punctuation', foreground: '808080' },
        ],
        colors: {
          'editor.background': '#00000000',
          'editor.foreground': '#e2e8f0',
          'editor.lineHighlightBackground': '#ffffff0a',
          'editor.selectionBackground': '#3b82f640',
          'editorLineNumber.foreground': '#475569',
          'editorLineNumber.activeForeground': '#94a3b8',
          'editorCursor.foreground': '#3b82f6',
          'editorIndentGuide.background': '#ffffff0a',
          'editorIndentGuide.activeBackground': '#ffffff1a',
          'scrollbarSlider.background': '#ffffff10',
          'scrollbarSlider.hoverBackground': '#ffffff20',
        }
      });
    } catch (e) {
      console.warn('Error defining theme:', e);
    }

    // Get initial value: saved code > starterCode > fallback
    const initialValue = this.currentStarterCode();

    try {
      this.monacoEditor = win.monaco.editor.create(container, {
        value: initialValue,
        language: langMap[this.selectedLang()] || 'plaintext',
        theme: 'leetcodeDark',
        minimap: { enabled: false },
        fontSize: 14,
        lineHeight: 22,
        fontFamily: "'Fira Code', 'Cascadia Code', 'JetBrains Mono', 'Consolas', monospace",
        fontLigatures: true,
        lineNumbers: 'on',
        scrollBeyondLastLine: false,
        automaticLayout: true,
        tabSize: 4,
        padding: { top: 20, bottom: 20 },
        renderWhitespace: 'none',
        overviewRulerLanes: 0,
        hideCursorInOverviewRuler: true,
        cursorBlinking: 'smooth',
        cursorSmoothCaretAnimation: 'on',
        smoothScrolling: true,
        renderLineHighlight: 'line',
        scrollbar: { verticalScrollbarSize: 6, horizontalScrollbarSize: 6 },
        suggest: { showIcons: true },
        readOnly: false,
      });
    } catch (e) {
      console.error('Error creating Monaco editor:', e);
      return;
    }

    // Block Copy/Paste/Cut
    try {
      // Block Copy (Ctrl+C / Cmd+C)
      this.monacoEditor.addCommand(
        win.monaco.KeyMod.CtrlCmd | win.monaco.KeyCode.KeyC,
        () => {
          this.securityService.incrementCopy();
        }
      );
      
      // Block Paste (Ctrl+V / Cmd+V)
      this.monacoEditor.addCommand(
        win.monaco.KeyMod.CtrlCmd | win.monaco.KeyCode.KeyV,
        () => {
          this.securityService.incrementPaste();
        }
      );
      
      // Block Cut (Ctrl+X / Cmd+X)
      this.monacoEditor.addCommand(
        win.monaco.KeyMod.CtrlCmd | win.monaco.KeyCode.KeyX,
        () => {
          this.securityService.incrementCopy();
        }
      );
    } catch (e) {
      console.warn('Error setting up keyboard commands:', e);
    }

    // Save code on change (with isSettingValue guard)
    try {
      this.monacoEditor.onDidChangeModelContent(() => {
        if (this.isSettingValue) return;
        this.saveCodingCode();
      });
    } catch (e) {
      console.warn('Error setting up change listener:', e);
    }

    // Ensure layout is correct
    setTimeout(() => {
      try {
        if (this.monacoEditor && this.monacoEditor.layout) {
          this.monacoEditor.layout();
        }
        this.editorReady.set(true);
      } catch (e) {
        console.warn('Error triggering editor layout:', e);
      }
    }, 10);
  }

  private saveCodingCode(): void {
    if (!this.monacoEditor || this.isCurrentMCQ()) return;
    const codingIdx = this.currentQ() - this.mcqQuestions().length;
    const coding = this.codingQuestions()[codingIdx];
    if (!coding) return;

    const code = this.monacoEditor.getValue() || '';
    const lang = this.selectedLang();
    this.codeStore[codingIdx] ??= {};
    this.codeStore[codingIdx][lang] = code;
    this.questionLangStore[codingIdx] = lang;
    this.saveCodeStoreToCache();

    const starterCode = this.getStarterCodeForLanguage(coding, lang);
    const solution: CodingSolution = {
      question: coding.problem,
      userCode: code,
      questionScore: coding.score, // Pass-through MAX score
      isSolved: code.trim().length > 10 && code.trim() !== (starterCode || '').trim(),
      timeTakenByUser: this.getQTime(this.currentQ()),
      avgTimeSec: coding.avgTimeSec || 180,
      earnedScore: 0,
    };
    this.store.dispatch(InterviewActions.updateCodingSolution({ index: codingIdx, solution }));
  }

  /** Save current editor content to codeStore before switching questions */
  private saveCurrentCodeToStore(): void {
    if (!this.monacoEditor || this.isCurrentMCQ()) return;
    const codingIdx = this.currentQ() - this.mcqQuestions().length;
    if (codingIdx >= 0) {
      const lang = this.selectedLang();
      this.codeStore[codingIdx] ??= {};
      this.codeStore[codingIdx][lang] = this.monacoEditor.getValue() || '';
      this.questionLangStore[codingIdx] = lang;
      this.saveCodeStoreToCache();
    }
  }

  private saveCodeStoreToCache(): void {
    if (this.interviewId && typeof localStorage !== 'undefined') {
      localStorage.setItem(`ir_codeStore_${this.interviewId}`, JSON.stringify(this.codeStore));
      localStorage.setItem(`ir_questionLangStore_${this.interviewId}`, JSON.stringify(this.questionLangStore));
    }
  }

  /** Load saved code or starterCode into Monaco for the current coding question */
  private loadCodeForCurrentQuestion(): void {
    if (!this.monacoEditor || this.isCurrentMCQ()) return;
    const codingIdx = this.currentQ() - this.mcqQuestions().length;
    const coding = this.codingQuestions()[codingIdx];
    if (codingIdx < 0 || !coding) return;

    const lang = this.selectedLang();
    const savedCode = this.codeStore[codingIdx]?.[lang];
    const starterCode = this.getStarterCodeForLanguage(coding, lang);
    const value = savedCode || starterCode || '// Start coding here...\n';

    this.isSettingValue = true;
    this.monacoEditor.setValue(value);
    this.isSettingValue = false;
    this.editorReady.set(true);
  }

  private trackQStats(qIndex: number): void {
    if (!this.qStatsMap[qIndex]) {
      this.qStatsMap[qIndex] = { cumulativeTimeMs: 0, firstInteraction: null, lastInteraction: null, viewCount: 0 };
    }
    const stats = this.qStatsMap[qIndex];
    const now = Date.now();
    stats.cumulativeTimeMs += now - this.lastQuestionTime;
    stats.lastInteraction = now;
    stats.viewCount++;
    if (!stats.firstInteraction) stats.firstInteraction = now;
  }

  private getQTime(qIndex: number): number {
    const stats = this.qStatsMap[qIndex];
    return stats ? Math.round(stats.cumulativeTimeMs / 1000) : 0;
  }

  private getStarterCodeMap(c: Coding | null): Record<string, string> {
    if (!c) return {};
    const raw = (c as any).starterCode ?? (c as any)['starter code'] ?? (c as any).starter_code ?? {};
    return raw && typeof raw === 'object' ? raw : {};
  }

  private getStarterCodeForLanguage(c: Coding | null, lang: 'cpp' | 'java' | 'python' | 'javascript'): string {
    const map = this.getStarterCodeMap(c);
    const candidates: Record<'cpp' | 'java' | 'python' | 'javascript', string[]> = {
      cpp: ['cpp', 'CPP', 'C++'],
      java: ['java', 'Java'],
      python: ['python', 'Python', 'py', 'PY'],
      javascript: ['javascript', 'JavaScript', 'js', 'JS'],
    };
    for (const key of candidates[lang]) {
      const code = map[key];
      if (typeof code === 'string' && code.trim().length > 0) return code;
    }
    return '';
  }

  private getAvailableLanguages(c: Coding | null): Array<'cpp' | 'java' | 'python' | 'javascript'> {
    if (!c) return ['java', 'cpp', 'python', 'javascript'];
    const langs: Array<'cpp' | 'java' | 'python' | 'javascript'> = [];
    if (this.getStarterCodeForLanguage(c, 'java')) langs.push('java');
    if (this.getStarterCodeForLanguage(c, 'cpp')) langs.push('cpp');
    if (this.getStarterCodeForLanguage(c, 'python')) langs.push('python');
    if (this.getStarterCodeForLanguage(c, 'javascript')) langs.push('javascript');
    return langs.length > 0 ? langs : ['java', 'cpp', 'python', 'javascript'];
  }

  private getPreferredLanguage(c: Coding | null): 'cpp' | 'java' | 'python' | 'javascript' {
    return this.getAvailableLanguages(c)[0] ?? 'cpp';
  }

  // ── Loading animation ──
  private startLoadingAnimation(): void {
    this.loadingStep.set(0);
    this.loadingProgress.set(0);
    let progress = 0;
    this.loadingInterval = setInterval(() => {
      progress += 1;
      if (progress >= 100) progress = 98; // Hold at 98% until response
      this.loadingProgress.set(progress);
      this.loadingStep.set(Math.min(Math.floor(progress / 25), 3));
    }, 600);
  }

  private stopLoadingAnimation(): void {
    if (this.loadingInterval) {
      clearInterval(this.loadingInterval);
      this.loadingInterval = null;
    }
    this.loadingProgress.set(100);
  }

  /* ── Voice AI — SpeechSynthesis entrance rules & SpeechRecognition assist ── */
  private entranceSpoken = false;

  private speakEntranceMessage(): void {
    if (this.entranceSpoken || !this.speechSynth) return;
    if (this.mcqQuestions().length === 0 && this.codingQuestions().length === 0) return;
    this.entranceSpoken = true;

    const totalMcq = this.mcqQuestions().length;
    const totalCoding = this.codingQuestions().length;
    const totalQ = totalMcq + totalCoding;

    const message = 
      `Hi ${this.candidateName}, welcome! I'm your AI assistant for this interview, here to help guide you through the process. ` +
      `Today, you'll be completing ${totalQ} questions: ${totalMcq} multiple-choice and ${totalCoding} coding tasks, with a total time of 60 minutes. ` +
      `Before we get started, just a quick reminder about the guidelines: please avoid switching tabs or copying and pasting code, as those actions are tracked. ` +
      `Also, please make sure your webcam stays active so our system can check for focus. ` +
      `Just so you know, you can ask me questions or ask for a hint, but doing so will carry a two-point score penalty. ` +
      `Good luck, and let me know if you need anything!`;

    this.speakQueue(message);
  }

  private connectVoiceSocket(): void {
    if (typeof window === 'undefined') return;
    
    // Only skip if socket exists AND is actively connected
    if (this.socket$ && this.isSocketConnected()) {
      return;
    }
    // Clean up stale/dead socket before reconnecting
    if (this.socket$) {
      try { this.socket$.complete(); } catch (e) {}
      this.socket$ = null as any;
    }

    const token = typeof localStorage !== 'undefined' ? (localStorage.getItem('ir_token') || sessionStorage.getItem('ir_token') || '') : '';
    const id = this.interviewId;
    if (!id) return;

    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const host = window.location.host;
    const wsUrl = `${protocol}://${host}/user/interviews/voice-ws?token=${encodeURIComponent(token)}&interviewId=${id}`;

    this.socket$ = webSocket({
      url: wsUrl,
      deserializer: msg => msg,
      serializer: msg => JSON.stringify(msg),
      openObserver: {
        next: () => {
          this.isSocketConnected.set(true);
          this.voiceError.set(null);
          console.log('Voice WebSocket connected successfully');
          // Start heartbeat to keep connection alive through proxies
          this.startHeartbeat();
          if (this.pendingVoiceQuery) {
            const query = this.pendingVoiceQuery;
            this.pendingVoiceQuery = null;
            this.sendVoiceQueryToBackend(query);
          }
        }
      },
      closeObserver: {
        next: () => {
          this.isSocketConnected.set(false);
          this.stopHeartbeat();
          console.log('Voice WebSocket connection closed');
          this.socket$ = null as any;
        }
      }
    });

    this.socket$.subscribe({
      next: (event: any) => {
        try {
          let msg = event;
          if (event && typeof event.data === 'string') {
            msg = JSON.parse(event.data);
          }
          if (msg && msg.type === 'ASSISTANT_SPEECH_CHUNK') {
            this.handleIncomingAudioChunk(msg.text, msg.isFinal);
          }
          // Silently ignore PONG responses from heartbeat
          if (msg && msg.type === 'PONG') { return; }
        } catch (e) {
          console.warn('Failed to parse WebSocket message frame:', e);
        }
      },
      error: (err) => {
        this.isSocketConnected.set(false);
        this.voiceLoading.set(false); // Clear loading state on socket error
        this.stopHeartbeat();
        this.voiceError.set('Connection error');
        console.warn('Voice WebSocket error, retrying in 3 seconds...', err);
        this.socket$ = null as any;
        setTimeout(() => {
          if (this.voiceAssistantActive()) {
            this.connectVoiceSocket();
          }
        }, 3000);
      }
    });
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      if (this.socket$ && this.isSocketConnected()) {
        try {
          this.socket$.next({ type: 'PING' });
        } catch (e) {
          // Socket may have closed between check and send
        }
      }
    }, 25000); // Every 25 seconds
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private handleIncomingAudioChunk(textChunk: string, isFinal: boolean) {
    if (textChunk) {
      this.chunkBuffer += textChunk;
    }

    const sentences = this.chunkBuffer.split(/([.?!]+)/);
    while (sentences.length > 2) {
      const sentence = (sentences.shift() || '') + (sentences.shift() || '');
      if (sentence.trim()) {
        this.speakQueue(sentence.trim());
      }
    }

    this.chunkBuffer = sentences.join('');

    if (isFinal) {
      if (this.chunkBuffer.trim()) {
        this.speakQueue(this.chunkBuffer.trim());
      }
      this.chunkBuffer = '';
      this.voiceLoading.set(false);
    }
  }

  private startListening(): void {
    if (this.recognition && !this.recognitionStarted && !this.isListening() && !this.voiceSpeaking() && !this.voiceLoading() && this.voiceAssistantActive()) {
      try {
        this.recognitionStarted = true;
        this.recognition.start();
        this.voiceError.set(null);
      } catch (e) {
        this.recognitionStarted = false;
        console.warn('Speech recognition start failed:', e);
      }
    }
  }

  private initSpeechRecognition(): void {
    if (typeof window === 'undefined') return;

    // Proactively request microphone permission on load to trigger browser popup
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
          stream.getTracks().forEach(track => track.stop());
        })
        .catch(err => {
          console.warn('Microphone permission request failed/denied:', err);
        });
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('Speech Recognition not supported in this browser.');
      return;
    }
    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.lang = 'en-US';
    this.recognition.interimResults = true;

    this.recognition.onstart = () => {
      this.isListening.set(true);
      this.recognitionStarted = true;
      this.voiceError.set(null);
      this.lastRecognitionError = null;
    };
    
    this.recognition.onend = () => {
      this.isListening.set(false);
      this.recognitionStarted = false;
      this.userSpeaking.set(false);
      if (!this.voiceAssistantActive()) {
        this.stopVisualizer();
      }
      
      const shouldRestart = this.voiceAssistantActive() && 
                           !this.voiceSpeaking() && 
                           !this.voiceLoading() && 
                           this.networkErrorCount < 3 && 
                           this.lastRecognitionError !== 'not-allowed' && 
                           this.lastRecognitionError !== 'service-not-allowed';

      if (shouldRestart) {
        const delay = this.lastRecognitionError ? 1000 : 50;
        setTimeout(() => this.startListening(), delay);
      }
    };

    this.recognition.onerror = (event: any) => {
      this.isListening.set(false);
      this.recognitionStarted = false;
      this.userSpeaking.set(false);
      this.lastRecognitionError = event.error;
      console.warn('Speech recognition error:', event.error);
      
      if (event.error === 'network') {
        this.networkErrorCount++;
        if (this.networkErrorCount >= 3) {
          console.warn('Speech recognition: 3 consecutive network errors. Disabling voice auto-restart.');
          this.voiceError.set('Speech recognition service is unavailable. If you are using Brave browser, switch to Chrome or Edge. If you are on ngrok, access via http://localhost:4200 directly.');
        }
      } else if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        if (event.error === 'not-allowed') {
          this.voiceError.set('Microphone permission blocked. Please allow mic access in your browser settings.');
        } else {
          this.voiceError.set('Speech recognition service not allowed on this browser. Please use Google Chrome or Edge.');
        }
      } else {
        this.voiceError.set(event.error);
      }

      if (!this.voiceAssistantActive()) {
        this.stopVisualizer();
      }
    };

    this.recognition.onsoundstart = () => this.userSpeaking.set(true);
    this.recognition.onsoundend = () => this.userSpeaking.set(false);
    this.recognition.onspeechstart = () => this.userSpeaking.set(true);
    this.recognition.onspeechend = () => this.userSpeaking.set(false);

    this.recognition.onresult = (event: any) => {
      this.networkErrorCount = 0; // Reset count on successful transcription result

      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

      // Append final transcripts to the accumulator
      if (finalTranscript) {
        this.speechAccumulator += ' ' + finalTranscript;
      }

      // Display current state (accumulated + interim)
      const displayText = (this.speechAccumulator + ' ' + interimTranscript).trim();
      this.currentTranscript.set(displayText);

      if (displayText.length > 0) {
        this.userSpeaking.set(true);

        if (this.silenceTimer) {
          clearTimeout(this.silenceTimer);
        }

        this.silenceTimer = setTimeout(() => {
          // Only send accumulated final transcript, not interim guesses
          const finalText = this.speechAccumulator.trim();
          if (finalText.length > 0 && !this.voiceSpeaking() && !this.voiceLoading()) {
            this.sendVoiceQueryToBackend(finalText);
            this.speechAccumulator = '';
            this.currentTranscript.set('');
          }
        }, 500); // 500ms timeout before sending
      }
    };
  }

  toggleListening(): void {
    if (!this.recognition) {
      console.warn('Speech Recognition not initialized.');
      return;
    }
    if (this.isListening() || this.recognitionStarted) {
      try {
        this.recognition.abort();
      } catch (e) {}
      this.recognitionStarted = false;
    } else {
      this.stopVoice(); // Stop any currently speaking TTS
      try {
        this.recognitionStarted = true;
        this.recognition.start();
      } catch (e) {
        this.recognitionStarted = false;
        console.warn('Speech recognition start failed in toggleListening:', e);
      }
    }
  }

  private sendVoiceQueryToBackend(transcript: string): void {
    if (!this.interviewId) return;
    
    // Instantly interrupt any ongoing voice playback when a new query is submitted
    this.stopVoice();
    
    this.voiceLoading.set(true);

    const sendAction = () => {
      // Get active question details
      const isMcq = this.isCurrentMCQ();
      const questionType = isMcq ? 'MCQ' : 'Coding';
      let questionContent = '';

      if (isMcq) {
        const mcq = this.currentMCQ();
        questionContent = mcq ? mcq.question : '';
      } else {
        const coding = this.currentCoding();
        if (coding) {
          let content = coding.problem || coding.description || '';
          if (coding.input && coding.input.length > 0) {
            content += "\nInput Examples:\n" + coding.input.join("\n");
          }
          if (coding.output && coding.output.length > 0) {
            content += "\nOutput Examples:\n" + coding.output.join("\n");
          }
          if (coding.constraints && coding.constraints.length > 0) {
            content += "\nConstraints:\n" + coding.constraints.join("\n");
          }
          questionContent = content;
        }
      }

      const userCode = isMcq ? null : (this.monacoEditor ? this.monacoEditor.getValue() : null);
      const selectedOptionIndex = isMcq ? this.mcqSelection() : null;

      try {
        this.socket$.next({
          type: 'USER_SPEECH',
          userMessage: transcript,
          questionType: questionType,
          activeQuestionContent: questionContent,
          userCode: userCode,
          selectedOptionIndex: selectedOptionIndex
        });
      } catch (e) {
        console.error('Failed to send WebSocket message', e);
        this.voiceLoading.set(false);
      }
    };

    if (!this.socket$ || !this.isSocketConnected()) {
      console.warn('Socket not active. Reconnecting and queuing message...');
      this.pendingVoiceQuery = transcript;
      this.connectVoiceSocket();
      setTimeout(() => {
        if (this.pendingVoiceQuery === transcript) {
          this.pendingVoiceQuery = null;
          this.voiceLoading.set(false);
          this.voiceError.set('Connection lost. Please try again.');
        }
      }, 4000);
    } else {
      sendAction();
    }
  }

  handleTextInput(text: string): void {
    if (text && text.trim().length > 0) {
      this.sendVoiceQueryToBackend(text.trim());
    }
  }

  private speakText(text: string): void {
    this.speakQueue(text);
  }

  private speakQueue(text: string): void {
    if (!this.speechSynth) return;

    this.voiceSpeaking.set(true);

    // Stop listening while speaking to prevent microphone echo
    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch (e) {}
      this.recognitionStarted = false;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    this.utterances.push(utterance); // Keep a strong reference to prevent garbage collection
    this.activeUtterance = utterance;
    utterance.rate = 1.0;
    utterance.pitch = 1.05;
    utterance.volume = 1.0;

    // Use preloaded cached voice (selected during init via voiceschanged event)
    if (this.cachedVoice) {
      utterance.voice = this.cachedVoice;
    }

    utterance.onstart = () => this.voiceSpeaking.set(true);
    
    utterance.onend = () => {
      this.utterances = this.utterances.filter(u => u !== utterance); // Clean up reference
      if (this.speechSynth && !this.speechSynth.speaking) {
        this.voiceSpeaking.set(false);
        this.activeUtterance = null;
        if (this.voiceAssistantActive()) {
          this.startListening();
        }
      }
    };

    utterance.onerror = () => {
      this.utterances = this.utterances.filter(u => u !== utterance); // Clean up reference
      if (this.speechSynth && !this.speechSynth.speaking) {
        this.voiceSpeaking.set(false);
        this.activeUtterance = null;
        if (this.voiceAssistantActive()) {
          this.startListening();
        }
      }
    };

    this.speechSynth.speak(utterance);
  }

  stopVoice(): void {
    if (this.speechSynth) {
      this.speechSynth.cancel();
      this.voiceSpeaking.set(false);
    }
    this.activeUtterance = null;
    this.utterances = []; // Clear strong references
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
    this.speechAccumulator = '';
    this.chunkBuffer = '';
  }

  private setVoiceAssistantActive(active: boolean): void {
    this.voiceAssistantActive.set(active);
    if (active) {
      this.networkErrorCount = 0;
      this.startVisualizer();
      this.connectVoiceSocket();
    } else {
      this.stopVisualizer();
      this.voiceError.set(null);
      if (this.socket$) {
        try {
          this.socket$.complete();
        } catch (e) {}
        this.socket$ = null as any;
      }
      this.isSocketConnected.set(false);
    }
  }

  handleVoiceClick(): void {
    if (this.voiceSpeaking()) {
      // User clicked to interrupt the AI: stop speaking and start listening immediately
      this.stopVoice();
      this.setVoiceAssistantActive(true);
      setTimeout(() => this.startListening(), 50);
    } else if (this.voiceAssistantActive()) {
      // User clicked to mute/stop the voice assistant
      this.setVoiceAssistantActive(false);
      if (this.recognition) {
        try {
          this.recognition.stop();
        } catch (e) {}
        this.recognitionStarted = false;
      }
    } else {
      // User clicked to activate the voice assistant
      this.networkErrorCount = 0; // Reset error count on manual re-activation
      this.setVoiceAssistantActive(true);
      this.startListening();
    }
  }

  private startVisualizer(): void {
    // Visualizer oscillation is driven entirely by CSS keyframe animations (.speakPulse) triggered by the [class.speaking] binding in HTML.
  }

  private stopVisualizer(): void {
    // Handled by CSS class binding resets.
  }

  cancelInterview(): void {
    this.showCancelConfirm.set(false);
    this.submitExam();
  }
}
