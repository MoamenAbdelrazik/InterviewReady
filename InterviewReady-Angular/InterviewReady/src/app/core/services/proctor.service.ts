import { Injectable, signal } from '@angular/core';
import { FrameData, BehaviorData, TimeWindow, PerQuestionBehavior } from '../../shared/models';
import * as faceapi from '@vladmandic/face-api';

/**
 * Webcam proctoring service.
 * Manages camera, collects face-api.js frame data, and aggregates into BehaviorData.
 * Schema: new_feature.md (3-level + 8-signal cheating analysis).
 */
@Injectable({ providedIn: 'root' })
export class ProctorService {
  private stream: MediaStream | null = null;
  private detectionInterval: ReturnType<typeof setInterval> | null = null;
  private frameBuffer: FrameData[] = [];
  private frameCount = 0;
  private videoEl: HTMLVideoElement | null = null;
  private modelsLoaded = false;

  readonly cameraActive = signal(false);
  readonly cameraError = signal<string | null>(null);

  async startCamera(): Promise<MediaStream | null> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices) {
      this.cameraError.set('Camera not available');
      return null;
    }
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240, facingMode: 'user' },
        audio: false,
      });
      this.cameraActive.set(true);
      this.cameraError.set(null);
      return this.stream;
    } catch (err: any) {
      this.cameraError.set(err.name === 'NotAllowedError' ? 'Camera permission denied' : 'Camera unavailable');
      this.cameraActive.set(false);
      return null;
    }
  }

  stopCamera(): void {
    this.stream?.getTracks().forEach(t => t.stop());
    this.stream = null;
    this.cameraActive.set(false);
    if (this.detectionInterval) {
      clearInterval(this.detectionInterval);
      this.detectionInterval = null;
    }
  }

  async startFrameCapture(videoElement?: HTMLVideoElement): Promise<void> {
    this.frameBuffer = [];
    this.frameCount = 0;
    this.videoEl = videoElement || null;

    // Load face-api models once
    if (!this.modelsLoaded) {
      try {
        const MODEL_URL = '/assets/models';
        await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
        await faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL);
        await faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL);
        this.modelsLoaded = true;
      } catch (e) {
        console.warn('[ProctorService] face-api models failed to load, using luminance-only mode:', e);
      }
    }

    this.detectionInterval = setInterval(() => {
      this.captureFrameAsync();
    }, 200); // 5 FPS
  }

  private async captureFrameAsync(): Promise<void> {
    const frame = await this.buildFrame();
    this.frameBuffer.push(frame);
    this.frameCount++;
  }

  private async buildFrame(): Promise<FrameData> {
    const ts = Date.now();
    const vid = this.videoEl;

    // ── Camera covered check (luminance) ──
    let cameraCovered = !this.cameraActive();
    if (vid && vid.readyState >= 2) {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 64; canvas.height = 48;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(vid, 0, 0, 64, 48);
        const px = ctx.getImageData(0, 0, 64, 48).data;
        let sum = 0;
        for (let i = 0; i < px.length; i += 4) {
          sum += px[i] * 0.299 + px[i+1] * 0.587 + px[i+2] * 0.114;
        }
        cameraCovered = (sum / (64 * 48)) < 10;
      } catch { /* ignore */ }
    }

    // ── Default fallback (no face detected) ──
    const noFace: FrameData = {
      frame: this.frameCount, timestamp: ts, cameraCovered,
      faceDetected: false,
      headPose: { yaw: 0, pitch: 0, roll: 0 },
      eyesOpen: true,
      looking: { isLookingSide: false, isLookingDown: false, isLookingUp: false },
      expressions: { neutral: 0, happy: 0, sad: 0, angry: 0, fearful: 0, disgusted: 0, surprised: 0 },
      statusFlags: { faceMissing: true, suspiciousYaw: false, eyesClosed: false },
    };

    if (!vid || vid.readyState < 2 || !this.modelsLoaded || cameraCovered) return noFace;

    try {
      const det = await faceapi
        .detectSingleFace(vid, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.4 }))
        .withFaceLandmarks(true)
        .withFaceExpressions();

      if (!det) return noFace;

      // ── Extract 68 landmarks ──
      const lm = det.landmarks;
      const pts = lm.positions;
      const nose = pts[30];
      const jaw = lm.getJawOutline();
      const leftEye = lm.getLeftEye();
      const rightEye = lm.getRightEye();

      // ── Head Pose from landmarks (new_feature.md formulas) ──
      const jawMidX = (jaw[0].x + jaw[16].x) / 2;
      const jawWidth = Math.abs(jaw[16].x - jaw[0].x) || 1;
      const eyeMidY = (leftEye[0].y + rightEye[3].y) / 2;
      const faceH = Math.abs(jaw[8].y - pts[19].y) || 1;
      const yaw = ((nose.x - jawMidX) / jawWidth) * 90;
      const pitch = ((nose.y - eyeMidY) / faceH - 0.55) * 120;
      const leCenter = { x: leftEye.reduce((s,p) => s+p.x, 0)/leftEye.length, y: leftEye.reduce((s,p) => s+p.y, 0)/leftEye.length };
      const reCenter = { x: rightEye.reduce((s,p) => s+p.x, 0)/rightEye.length, y: rightEye.reduce((s,p) => s+p.y, 0)/rightEye.length };
      const roll = Math.atan2(reCenter.y - leCenter.y, reCenter.x - leCenter.x) * (180 / Math.PI);

      // ── EAR (Eye Aspect Ratio) — Soukupová & Čech 2016 ──
      const ear = (eye: faceapi.Point[]) => {
        const v1 = Math.hypot(eye[1].x - eye[5].x, eye[1].y - eye[5].y);
        const v2 = Math.hypot(eye[2].x - eye[4].x, eye[2].y - eye[4].y);
        const h  = Math.hypot(eye[0].x - eye[3].x, eye[0].y - eye[3].y) || 1;
        return (v1 + v2) / (2 * h);
      };
      const avgEAR = (ear(leftEye) + ear(rightEye)) / 2;
      const eyesOpen = avgEAR >= 0.21;

      // ── Gaze thresholds (new_feature.md) ──
      const isLookingSide = Math.abs(yaw) > 25;
      const isLookingDown = pitch > 20;
      const isLookingUp = pitch < -15;

      // ── Expressions ──
      const ex = det.expressions;

      return {
        frame: this.frameCount, timestamp: ts, cameraCovered,
        faceDetected: true,
        headPose: { yaw, pitch, roll },
        eyesOpen,
        looking: { isLookingSide, isLookingDown, isLookingUp },
        expressions: {
          neutral: ex.neutral ?? 0, happy: ex.happy ?? 0, sad: ex.sad ?? 0,
          angry: ex.angry ?? 0, fearful: ex.fearful ?? 0,
          disgusted: ex.disgusted ?? 0, surprised: ex.surprised ?? 0,
        },
        statusFlags: {
          faceMissing: false,
          suspiciousYaw: Math.abs(yaw) > 25,
          eyesClosed: !eyesOpen,
        },
      };
    } catch {
      return noFace;
    }
  }

  /**
   * Aggregate all captured frames into the 3-level BehaviorData JSON.
   * Matches new_feature.md spec exactly.
   */
  generateBehaviorData(
    totalDurationSec: number,
    questionCount: number,
    securityFlags: { tabSwitches: number; copyAttempts: number; pasteAttempts: number; eventLog?: { type: string; questionIndex: number }[] },
    questionViewCounts?: number[]
  ): BehaviorData {
    const frames = this.frameBuffer;
    const N = frames.length || 1;
    const FPS = 5;

    // ─── LEVEL A: SESSION AGGREGATION ───

    // Camera Health
    const cameraCoveredFrames = frames.filter(f => f.cameraCovered).length;
    const cameraCoveredPct = cameraCoveredFrames / N;
    const cameraEpisodes = this.countEpisodes(frames, f => f.cameraCovered);
    const maxCameraCoveredSec = this.maxEpisodeDuration(frames, f => f.cameraCovered) / FPS;

    // Face Presence
    const faceMissingFrames = frames.filter(f => !f.faceDetected).length;
    const faceMissingPct = faceMissingFrames / N;
    const faceEpisodes = this.countEpisodes(frames, f => !f.faceDetected);
    const maxFaceMissingSec = this.maxEpisodeDuration(frames, f => !f.faceDetected) / FPS;

    // Attention
    const eyesClosedFrames = frames.filter(f => !f.eyesOpen).length;
    const lookingSideFrames = frames.filter(f => f.looking.isLookingSide).length;
    const lookingDownFrames = frames.filter(f => f.looking.isLookingDown).length;
    const lookingUpFrames = frames.filter(f => f.looking.isLookingUp).length;
    const eyesClosedPct = eyesClosedFrames / N;
    const lookingAwaySidePct = lookingSideFrames / N;
    const lookingDownPct = lookingDownFrames / N;
    const lookingUpPct = lookingUpFrames / N;
    const rawAttention = 1 - (0.30 * lookingAwaySidePct + 0.20 * eyesClosedPct + 0.20 * lookingDownPct + 0.15 * faceMissingPct + 0.15 * cameraCoveredPct);
    const attentionScore = Math.max(0, Math.min(1, rawAttention));

    // Head Behavior
    const yaws = frames.filter(f => f.faceDetected).map(f => f.headPose.yaw);
    const pitches = frames.filter(f => f.faceDetected).map(f => f.headPose.pitch);
    const rolls = frames.filter(f => f.faceDetected).map(f => f.headPose.roll);
    const avgYaw = this.mean(yaws);
    const avgPitch = this.mean(pitches);
    const avgRoll = this.mean(rolls);
    const yawVariance = this.variance(yaws);
    const pitchVariance = this.variance(pitches);
    const rollVariance = this.variance(rolls);
    const movementStability = 1 / (1 + Math.sqrt(yawVariance) / 15);
    const yawDeltas = yaws.slice(1).map((y, i) => y - yaws[i]);
    const jerk = yawDeltas.slice(1).map((d, i) => Math.abs(d - yawDeltas[i]));
    const avgJerk = this.mean(jerk);
    const irregularMovementScore = Math.min(1, avgJerk / 5.0);

    // Expressions (session average)
    const exprKeys = ['neutral', 'happy', 'sad', 'angry', 'fearful', 'disgusted', 'surprised'] as const;
    const expressions = {} as Record<typeof exprKeys[number], number>;
    exprKeys.forEach(k => { expressions[k] = this.mean(frames.map(f => f.expressions[k])); });

    // Behavior Events
    const suspiciousLookingEvents = this.countEpisodes(frames, f => f.looking.isLookingSide);
    const faceLossEvents = this.countEpisodes(frames, f => !f.faceDetected);
    const longEyeClosureEvents = this.countLongEpisodes(frames, f => !f.eyesOpen, 3);
    const cameraCoveredEvents = cameraEpisodes;

    // Risk Features
    const maxContinuousLookingAwaySec = this.maxEpisodeDuration(frames, f => f.looking.isLookingSide) / FPS;
    const maxContinuousFaceMissingSec = maxFaceMissingSec;
    const maxContinuousEyeClosedSec = this.maxEpisodeDuration(frames, f => !f.eyesOpen) / FPS;
    const rapidGazeSwitchCount = this.countRapidGazeSwitches(yaws, FPS);

    // ─── LEVEL B: TIME-WINDOW AGGREGATION ───
    const TARGET_WINDOWS = 14;
    const windowSizeSec = Math.ceil(totalDurationSec / TARGET_WINDOWS) || 60;
    const windowCount = Math.max(1, Math.ceil(totalDurationSec / windowSizeSec));
    const timeWindows: TimeWindow[] = [];

    for (let i = 0; i < windowCount; i++) {
      const startSec = i * windowSizeSec;
      const endSec = Math.min((i + 1) * windowSizeSec, totalDurationSec);
      const startFrame = Math.floor((startSec / totalDurationSec) * N);
      const endFrame = Math.min(Math.floor((endSec / totalDurationSec) * N), N);
      const windowFrames = frames.slice(startFrame, endFrame);
      const wN = windowFrames.length || 1;

      // Per-window expressions
      const wExpr = {} as Record<string, number>;
      exprKeys.forEach(k => { wExpr[k] = Math.round(this.mean(windowFrames.map(f => f.expressions[k])) * 100); });

      // Attention metrics
      const gazeOnScreenPct = Math.round((1 - windowFrames.filter(f => f.looking.isLookingSide).length / wN) * 100);
      const facePresencePct = Math.round(windowFrames.filter(f => f.faceDetected).length / wN * 100);
      const eyeClosurePct = Math.round(windowFrames.filter(f => !f.eyesOpen).length / wN * 100);

      // Stress Index
      const fearPct = (wExpr['fearful'] || 0);
      const angryPct = (wExpr['angry'] || 0);
      const sadPct = (wExpr['sad'] || 0);
      const gazeAwayPct = 100 - gazeOnScreenPct;
      const neutralBonus = Math.max(0, (wExpr['neutral'] || 0) - 50);
      const stressIndex = Math.max(0, Math.min(100,
        0.30 * fearPct + 0.20 * angryPct + 0.10 * sadPct + 0.20 * gazeAwayPct + 0.10 * eyeClosurePct - 0.10 * neutralBonus
      ));

      timeWindows.push({
        windowIndex: i,
        startSec,
        endSec,
        framesInWindow: windowFrames.length,
        expressions: {
          neutral: wExpr['neutral'] || 0,
          happy: wExpr['happy'] || 0,
          fearful: wExpr['fearful'] || 0,
          surprised: wExpr['surprised'] || 0,
          sad: wExpr['sad'] || 0,
          angry: wExpr['angry'] || 0,
        },
        gazeOnScreenPct,
        facePresencePct,
        eyeClosurePct,
        stressIndex: Math.round(stressIndex * 10) / 10,
        accuracyPct: 0, // cross-source: filled by report generator
        questionsActive: [],
      });
    }

    // ─── LEVEL C: PER-QUESTION BEHAVIORAL EVENTS ───
    const perQuestionBehavior: PerQuestionBehavior[] = [];
    const framesPerQ = Math.floor(N / questionCount) || 1;

    // Count security events per question from the real event log
    const eventLog = securityFlags.eventLog || [];
    const tabPerQ: number[] = new Array(questionCount).fill(0);
    const copyPerQ: number[] = new Array(questionCount).fill(0);
    const pastePerQ: number[] = new Array(questionCount).fill(0);
    eventLog.forEach(evt => {
      const qi = Math.min(evt.questionIndex, questionCount - 1);
      if (evt.type === 'tab') tabPerQ[qi]++;
      else if (evt.type === 'copy') copyPerQ[qi]++;
      else if (evt.type === 'paste') pastePerQ[qi]++;
    });

    for (let qi = 0; qi < questionCount; qi++) {
      const qStart = qi * framesPerQ;
      const qEnd = Math.min((qi + 1) * framesPerQ, N);
      const qFrames = frames.slice(qStart, qEnd);

      const gazeBreaks = this.countEpisodes(qFrames, f => f.looking.isLookingSide);
      const eyeCloseEvents = this.countEpisodes(qFrames, f => !f.eyesOpen);
      const qCameraCovered = this.countEpisodes(qFrames, f => f.cameraCovered);

      // Dominant emotion
      const emotionCounts: Record<string, number> = {};
      qFrames.forEach(f => {
        let maxE = 'neutral'; let maxV = 0;
        exprKeys.forEach(k => { if (f.expressions[k] > maxV) { maxV = f.expressions[k]; maxE = k; } });
        emotionCounts[maxE] = (emotionCounts[maxE] || 0) + 1;
      });
      const dominantEmotion = Object.entries(emotionCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'neutral';

      // Per-Q stress
      const qFearPct = this.mean(qFrames.map(f => f.expressions.fearful)) * 100;
      const qAngryPct = this.mean(qFrames.map(f => f.expressions.angry)) * 100;
      const qSadPct = this.mean(qFrames.map(f => f.expressions.sad)) * 100;
      const qGazeAway = qFrames.filter(f => f.looking.isLookingSide).length / (qFrames.length || 1) * 100;
      const qEyeClosed = qFrames.filter(f => !f.eyesOpen).length / (qFrames.length || 1) * 100;
      const qNeutralBonus = Math.max(0, this.mean(qFrames.map(f => f.expressions.neutral)) * 100 - 50);
      const qStress = Math.max(0, Math.min(100,
        0.30 * qFearPct + 0.20 * qAngryPct + 0.10 * qSadPct + 0.20 * qGazeAway + 0.10 * qEyeClosed - 0.10 * qNeutralBonus
      ));

      perQuestionBehavior.push({
        questionId: qi,
        gazeBreaks,
        eyeCloseEvents,
        tabSwitches: tabPerQ[qi],
        copyAttempts: copyPerQ[qi],
        pasteAttempts: pastePerQ[qi],
        cameraCoveredEvents: qCameraCovered,
        stressIndex: Math.round(qStress * 10) / 10,
        dominantEmotion,
        timeOnQuestionSec: Math.round(totalDurationSec / questionCount),
        viewCount: questionViewCounts?.[qi] ?? 1,
      });
    }

    // ─── CHEATING ANALYSIS (8-signal) ───
    const tabSwitchSignal = Math.min(1, securityFlags.tabSwitches / 5);
    const gazeDeviationSignal = Math.min(1, lookingAwaySidePct / 0.15);
    const faceAbsenceSignal = Math.min(1, faceMissingPct / 0.10);
    const cameraCoverSignal = Math.min(1, cameraCoveredPct / 0.05);
    const rapidGazeSwitchSignal = Math.min(1, rapidGazeSwitchCount / 8);
    const irregularMovementSignalVal = irregularMovementScore;
    const copyPasteSignal = Math.min(1, (securityFlags.copyAttempts + securityFlags.pasteAttempts) / 3);
    const multiTabSignal = securityFlags.tabSwitches > 0 ? 1 : 0;

    const cheatingProbability = Math.max(0, Math.min(1,
      0.20 * tabSwitchSignal +
      0.18 * gazeDeviationSignal +
      0.15 * faceAbsenceSignal +
      0.12 * cameraCoverSignal +
      0.12 * rapidGazeSwitchSignal +
      0.08 * irregularMovementSignalVal +
      0.10 * copyPasteSignal +
      0.05 * multiTabSignal
    ));

    const cheatingTier = cheatingProbability >= 0.70 ? 'CRITICAL' : cheatingProbability >= 0.40 ? 'HIGH' : cheatingProbability >= 0.15 ? 'MODERATE' : 'LOW';

    return {
      sessionDurationSec: totalDurationSec,
      totalFrames: N,
      fps: FPS,
      windowSizeSec,

      cameraHealth: { cameraCoveredPct: this.round4(cameraCoveredPct), cameraCoveredEvents: cameraEpisodes, maxCameraCoveredSec: this.round4(maxCameraCoveredSec) },
      facePresence: { faceMissingPct: this.round4(faceMissingPct), faceMissingEvents: faceEpisodes, maxFaceMissingSec: this.round4(maxFaceMissingSec) },
      attention: { eyesClosedPct: this.round4(eyesClosedPct), lookingAwaySidePct: this.round4(lookingAwaySidePct), lookingDownPct: this.round4(lookingDownPct), lookingUpPct: this.round4(lookingUpPct), attentionScore: this.round4(attentionScore) },
      headBehavior: { avgYaw: this.round4(avgYaw), avgPitch: this.round4(avgPitch), avgRoll: this.round4(avgRoll), yawVariance: this.round4(yawVariance), pitchVariance: this.round4(pitchVariance), rollVariance: this.round4(rollVariance), movementStability: this.round4(movementStability), irregularMovementScore: this.round4(irregularMovementScore) },
      expressions: { neutral: this.round4(expressions.neutral), happy: this.round4(expressions.happy), sad: this.round4(expressions.sad), angry: this.round4(expressions.angry), fearful: this.round4(expressions.fearful), disgusted: this.round4(expressions.disgusted), surprised: this.round4(expressions.surprised) },
      behaviorEvents: { suspiciousLookingEvents, faceLossEvents, longEyeClosureEvents, cameraCoveredEvents },
      riskFeatures: { maxContinuousLookingAwaySec: this.round4(maxContinuousLookingAwaySec), maxContinuousFaceMissingSec: this.round4(maxContinuousFaceMissingSec), maxContinuousEyeClosedSec: this.round4(maxContinuousEyeClosedSec), irregularMovementScore: this.round4(irregularMovementScore), rapidGazeSwitchCount },
      timeWindows,
      perQuestionBehavior,
      cheatingAnalysis: {
        cheatingProbability: this.round4(cheatingProbability),
        cheatingTier,
        signals: {
          tabSwitchSignal: this.round4(tabSwitchSignal),
          gazeDeviationSignal: this.round4(gazeDeviationSignal),
          faceAbsenceSignal: this.round4(faceAbsenceSignal),
          cameraCoverSignal: this.round4(cameraCoverSignal),
          rapidGazeSwitchSignal: this.round4(rapidGazeSwitchSignal),
          irregularMovementSignal: this.round4(irregularMovementSignalVal),
          copyPasteSignal: this.round4(copyPasteSignal),
          multiTabSignal,
        },
        weights: '0.20×tab + 0.18×gaze + 0.15×face + 0.12×camera + 0.12×rapidGaze + 0.08×movement + 0.10×copyPaste + 0.05×multiTab',
        llmNote: cheatingTier === 'LOW' ? 'Normal behavior, no further investigation needed.' : cheatingTier === 'MODERATE' ? 'Flag for human review, may be nervousness.' : cheatingTier === 'HIGH' ? 'Likely external assistance, investigate answer patterns.' : 'Strong evidence of cheating, cross-reference with code similarity.',
      },
    };
  }

  // ─── Utility functions ───

  private mean(arr: number[]): number {
    return arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;
  }

  private variance(arr: number[]): number {
    if (arr.length < 2) return 0;
    const m = this.mean(arr);
    return arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length;
  }

  private round4(n: number): number {
    return Math.round(n * 10000) / 10000;
  }

  private countEpisodes(frames: FrameData[], predicate: (f: FrameData) => boolean): number {
    let episodes = 0;
    let inEpisode = false;
    for (const f of frames) {
      if (predicate(f)) { if (!inEpisode) { episodes++; inEpisode = true; } }
      else { inEpisode = false; }
    }
    return episodes;
  }

  private countLongEpisodes(frames: FrameData[], predicate: (f: FrameData) => boolean, minFrames: number): number {
    let episodes = 0;
    let streak = 0;
    for (const f of frames) {
      if (predicate(f)) { streak++; }
      else { if (streak >= minFrames) episodes++; streak = 0; }
    }
    if (streak >= minFrames) episodes++;
    return episodes;
  }

  private maxEpisodeDuration(frames: FrameData[], predicate: (f: FrameData) => boolean): number {
    let max = 0;
    let streak = 0;
    for (const f of frames) {
      if (predicate(f)) { streak++; max = Math.max(max, streak); }
      else { streak = 0; }
    }
    return max;
  }

  private countRapidGazeSwitches(yaws: number[], fps: number): number {
    const windowFrames = fps * 2; // 2-second window
    let count = 0;
    for (let i = windowFrames; i < yaws.length; i++) {
      const windowYaws = yaws.slice(i - windowFrames, i);
      let reversals = 0;
      for (let j = 2; j < windowYaws.length; j++) {
        const d1 = windowYaws[j - 1] - windowYaws[j - 2];
        const d2 = windowYaws[j] - windowYaws[j - 1];
        if (Math.sign(d1) !== Math.sign(d2) && Math.abs(d2 - d1) > 30) reversals++;
      }
      if (reversals > 0) count++;
    }
    return count;
  }
}
