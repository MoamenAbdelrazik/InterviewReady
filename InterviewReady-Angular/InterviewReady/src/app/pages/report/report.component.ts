import { Component, OnInit, OnDestroy, ViewChild, ElementRef, inject, signal, computed, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { Subscription } from 'rxjs';
import { ReportActions } from '../../store/report/report.actions';
import { selectComprehensiveReport, selectReportProcessing, selectReportError } from '../../store/report/report.selectors';
import { FinalComprehensiveReport } from '../../shared/models';

@Component({
  selector: 'app-report',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './report.component.html',
  styleUrl: './report.component.css',
})
export class ReportComponent implements OnInit, OnDestroy, AfterViewInit {
  private store = inject(Store);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private subs = new Subscription();
  private chartsReady = false;

  @ViewChild('donutChart') donutChartRef!: ElementRef;
  @ViewChild('timePerQChart') timePerQChartRef!: ElementRef;
  @ViewChild('behaviorTimelineChart') behaviorTimelineChartRef!: ElementRef;
  @ViewChild('attentionChart') attentionChartRef!: ElementRef;
  @ViewChild('correctnessChart') correctnessChartRef!: ElementRef;
  @ViewChild('radarChart') radarChartRef!: ElementRef;
  @ViewChild('categoryChart') categoryChartRef!: ElementRef;
  @ViewChild('confChart') confChartRef!: ElementRef;
  @ViewChild('suspiciousChart') suspiciousChartRef!: ElementRef;
  @ViewChild('headStabilityChart') headStabilityChartRef!: ElementRef;
  @ViewChild('topicChart') topicChartRef!: ElementRef;
  @ViewChild('diffChart2') diffChart2Ref!: ElementRef;
  @ViewChild('responseHistChart') responseHistChartRef!: ElementRef;
  @ViewChild('emotionAccuracyChart') emotionAccuracyChartRef!: ElementRef;
  @ViewChild('proctoringChart') proctoringChartRef!: ElementRef;
  @ViewChild('navigationChart') navigationChartRef!: ElementRef;

  readonly report = signal<FinalComprehensiveReport | null>(null);
  readonly isLoading = signal(true);
  readonly error = signal<string | null>(null);



  readonly Math = Math;

  // ── Computed values ──
  readonly maxScore = computed(() => {
    const r = this.report();
    if (!r) return 0;
    const mcq = r.rawMcqSolutions?.reduce((s, m) => s + (m.questionScore > 0 ? m.questionScore : 0), 0) ?? 0;
    const coding = r.rawCodingSolutions?.reduce((s, c) => s + c.questionScore, 0) ?? 0;
    return mcq + coding || 100;
  });

  readonly mcqScore = computed(() => {
    const r = this.report();
    if (!r) return 0;
    return r.finalScore - (r.codingAnalysis?.totalCodingScore ?? 0);
  });

  readonly mcqMax = computed(() => {
    const r = this.report();
    if (!r || !r.rawMcqSolutions || r.rawMcqSolutions.length === 0) return 0;
    return r.rawMcqSolutions.reduce((s, m) => s + (m.maxScore ?? 10), 0);
  });

  readonly codingMax = computed(() => {
    const r = this.report();
    if (!r) return 0;
    if (!r.rawCodingSolutions || r.rawCodingSolutions.length === 0) return 0;
    return r.rawCodingSolutions.reduce((s, c) => s + (c.questionScore ?? 10), 0);
  });

  readonly totalMax = computed(() => this.mcqMax() + this.codingMax());

  readonly scorePct = computed(() => {
    const max = this.totalMax();
    return max > 0 ? Math.round((this.report()!.finalScore / max) * 100) : 0;
  });

  readonly scoreOffset = computed(() => {
    const pct = this.scorePct();
    const circumference = 408; // 2*PI*65
    return circumference - (circumference * pct / 100);
  });

  readonly scoreLabel = computed(() => {
    const pct = this.scorePct();
    if (pct >= 80) return 'Excellent';
    if (pct >= 60) return 'Good';
    if (pct >= 40) return 'Average';
    return 'Needs Work';
  });

  readonly roleTitle = computed(() => {
    const r = this.report();
    if (!r) return 'Assessment';
    // Use direct field from backend first, then try MCQ data
    if (r.jobProfileTitle) return r.jobProfileTitle;
    const title = (r.rawMcqSolutions?.[0] as any)?.jobProfileTitle;
    return title || localStorage.getItem('lastJobTitle') || 'Technical Assessment';
  });

  readonly scoreSubtitle = computed(() => {
    const pct = this.scorePct();
    if (pct >= 80) return 'Outstanding Performance';
    if (pct >= 60) return 'Solid Performance';
    if (pct >= 40) return 'Average Performance';
    return 'Below Expectations';
  });

  readonly correctCount = computed(() => {
    const r = this.report();
    if (!r) return 0;
    const mcqCorrect = r.rawMcqSolutions?.filter(m => m.isRight).length ?? 0;
    const codingScore = r.codingAnalysis?.totalCodingScore ?? 0;
    const codingMax = r.rawCodingSolutions && r.rawCodingSolutions.length > 0 ? r.rawCodingSolutions.reduce((acc, c) => acc + (c.questionScore || 0), 0) : 0;
    const codingCount = r.rawCodingSolutions && r.rawCodingSolutions.length > 0 ? r.rawCodingSolutions.length : 0;
    const codingCorrect = codingMax > 0 ? Math.round((codingScore / codingMax) * codingCount) : 0;
    return mcqCorrect + codingCorrect;
  });

  readonly totalQuestionCount = computed(() => {
    const r = this.report();
    const mcqLen = r?.rawMcqSolutions?.length || 0;
    const codingLen = r?.rawCodingSolutions?.length || 0;
    return mcqLen + codingLen || 1; // min 1 to avoid division by zero
  });

  readonly cheatingRisk = computed(() => {
    const r = this.report();
    if (!r) return 0;
    if (r.cheatingProbability) {
      return Math.round(r.cheatingProbability.percentage);
    }
    if (!r.rawBehaviorData?.cheatingAnalysis) return 0;
    const prob = (r.rawBehaviorData.cheatingAnalysis as any).cheatingProbability || 0;
    return Math.round(prob * 100);
  });

  readonly gazeDeviation = computed(() => {
    const r = this.report();
    if (!r?.rawBehaviorData?.attention) return 0;
    // attention has lookingAwaySidePct or gazeDeviationPct
    const att = r.rawBehaviorData.attention as any;
    let pct = att.lookingAwaySidePct ?? att.gazeDeviationPct ?? att.lookAwayPct ?? 0;
    if (pct <= 1 && pct > 0) pct *= 100;
    return Math.round(pct * 10) / 10;
  });

  readonly copyEvents = computed(() => {
    const r = this.report();
    return (r?.securityFlags?.copyAttempts ?? 0) + (r?.securityFlags?.pasteAttempts ?? 0);
  });

  readonly emotionData = computed(() => {
    const r = this.report();
    if (!r?.rawBehaviorData?.expressions) {
      return []; // No webcam data — template shows placeholder
    }
    const expr = r.rawBehaviorData.expressions;
    return [
      { name: 'Neutral', pct: Math.round(expr.neutral * 100), color: '#5a6478', tag: 'Ideal' },
      { name: 'Happy', pct: Math.round(expr.happy * 100), color: '#D4AF37', tag: 'Good' },
      { name: 'Fear', pct: Math.round(expr.fearful * 100), color: '#fbbf24', tag: 'Watch' },
      { name: 'Surprise', pct: Math.round(expr.surprised * 100), color: '#db2777', tag: null },
      { name: 'Sad', pct: Math.round(expr.sad * 100), color: '#0284c7', tag: null },
      { name: 'Angry', pct: Math.round(expr.angry * 100), color: '#f87171', tag: null },
    ];
  });

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));

    this.subs.add(this.store.select(selectComprehensiveReport).subscribe(r => {
      this.report.set(r);
      if (r && !this.chartsReady) {
        setTimeout(() => this.renderCharts(r), 300);
      }
    }));
    this.subs.add(this.store.select(selectReportProcessing).subscribe(v => this.isLoading.set(v)));
    this.subs.add(this.store.select(selectReportError).subscribe(v => this.error.set(v)));

    if (id) {
      this.store.dispatch(ReportActions.loadReport({ interviewId: id }));
    }
  }

  ngAfterViewInit(): void {
    const r = this.report();
    if (r) setTimeout(() => this.renderCharts(r), 300);
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  reload(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (id) {
      this.store.dispatch(ReportActions.loadReport({ interviewId: id }));
    }
  }

  goToDashboard(): void {
    this.router.navigate(['/dashboard']);
  }

  scrollTo(id: string): void {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  exportReport(): void {
    window.print();
  }

  formatDuration(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
  }

  formatDate(): string {
    return new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  // ── Charts ──
  private async renderCharts(r: FinalComprehensiveReport): Promise<void> {
    if (this.chartsReady || typeof window === 'undefined') return;
    this.chartsReady = true;
    const ApexCharts = (await import('apexcharts')).default;
    const G = { borderColor: 'rgba(255,255,255,.06)' };
    const AX = { labels: { style: { colors: '#5a6478', fontSize: '10px' } }, axisBorder: { show: false }, axisTicks: { show: false } };
    const AY = { labels: { style: { colors: '#5a6478', fontSize: '10px' } } };
    const TT = { theme: 'dark' as const };
    const wins = r.rawBehaviorData?.timeWindows || [];
    const pqb = r.rawBehaviorData?.perQuestionBehavior || [];
    const mcqs = r.rawMcqSolutions || [];
    const codings = r.rawCodingSolutions || [];
    const allQs = [...mcqs, ...codings];
    const emoData = this.emotionData();

    // 1. Emotion Donut
    if (this.donutChartRef?.nativeElement) {
      new ApexCharts(this.donutChartRef.nativeElement, {
        chart: { type: 'donut', height: 260, background: 'transparent' },
        series: emoData.map(e => e.pct),
        labels: emoData.map(e => e.name),
        colors: emoData.map(e => e.color),
        stroke: { width: 3, colors: ['#10101a'] },
        plotOptions: { pie: { donut: { size: '72%', labels: { show: true, name: { fontSize: '12px', color: '#a1a1aa', offsetY: -2 }, value: { fontSize: '26px', fontWeight: 800, color: '#fff', offsetY: 6, formatter: (v: string) => v + '%' }, total: { show: true, label: emoData[0]?.name || 'Neutral', fontSize: '12px', color: '#a1a1aa', formatter: () => emoData[0]?.pct + '%' } } } } },
        dataLabels: { enabled: false }, legend: { show: false }, tooltip: { enabled: false },
      }).render();
    }

    // 2. Time Per Question
    if (this.timePerQChartRef?.nativeElement && allQs.length > 0) {
      // Ensure robust numeric arrays: fall back to 0 for candidate time and 60s for avg if missing
      const candidateTimes = allQs.map((m: any) => typeof m.timeTakenByUser === 'number' ? m.timeTakenByUser : 0);
      const avgTimes = allQs.map((m: any) => typeof m.avgTimeSec === 'number' ? m.avgTimeSec : (m.avgTimeSec || 60));
      const categories = allQs.map((_, i) => 'Q' + (i + 1));

      new ApexCharts(this.timePerQChartRef.nativeElement, {
        chart: { type: 'bar', height: 230, background: 'transparent', toolbar: { show: false } },
        series: [{ name: 'You', data: candidateTimes }, { name: 'Avg', data: avgTimes }],
        colors: ['#3b82f6', 'rgba(255,255,255,.06)'],
        plotOptions: { bar: { columnWidth: '38%', borderRadius: 3 } }, grid: G,
        xaxis: { ...AX, categories }, yaxis: AY,
        dataLabels: { enabled: false }, tooltip: { ...TT, y: { formatter: (v: number) => v + 's' } },
        legend: { labels: { colors: '#e8ecf4' }, fontSize: '11px', position: 'top', horizontalAlign: 'right' },
      }).render();
    }

    // 3. Behavior Timeline
    if (this.behaviorTimelineChartRef?.nativeElement && wins.length > 0) {
      const emotionSeries: Record<string, number[]> = { neutral: [], happy: [], fear: [], surprise: [], sad: [], angry: [] };
      wins.forEach(w => { emotionSeries['neutral'].push(w.expressions.neutral || 0); emotionSeries['happy'].push(w.expressions.happy || 0); emotionSeries['fear'].push(w.expressions.fearful || 0); emotionSeries['surprise'].push(w.expressions.surprised || 0); emotionSeries['sad'].push(w.expressions.sad || 0); emotionSeries['angry'].push(w.expressions.angry || 0); });
      new ApexCharts(this.behaviorTimelineChartRef.nativeElement, {
        chart: { type: 'area', height: 230, background: 'transparent', toolbar: { show: false }, zoom: { enabled: false } },
        series: [
          { name: 'Neutral', data: emotionSeries['neutral'] }, { name: 'Happy', data: emotionSeries['happy'] },
          { name: 'Fear', data: emotionSeries['fear'] }, { name: 'Surprise', data: emotionSeries['surprise'] },
          { name: 'Sad', data: emotionSeries['sad'] }, { name: 'Angry', data: emotionSeries['angry'] },
        ],
        colors: ['#5a6478', '#34d399', '#fbbf24', '#db2777', '#0284c7', '#f87171'],
        fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: .18, opacityTo: .01, stops: [0, 95] } },
        stroke: { width: 2, curve: 'smooth' }, grid: G,
        xaxis: { ...AX, categories: wins.map(w => Math.floor(w.startSec / 60) + 'm') },
        yaxis: { ...AY, min: 0 }, dataLabels: { enabled: false },
        tooltip: { ...TT, y: { formatter: (v: number) => v + '%' } },
        legend: { labels: { colors: '#e8ecf4' }, fontSize: '10px', position: 'top', horizontalAlign: 'right' },
      }).render();
    }

    // 4. Attention Profile
    if (this.attentionChartRef?.nativeElement && wins.length > 0) {
      new ApexCharts(this.attentionChartRef.nativeElement, {
        chart: { type: 'area', height: 230, background: 'transparent', toolbar: { show: false }, zoom: { enabled: false } },
        series: [
          { name: 'Gaze on Screen', data: wins.map(w => w.gazeOnScreenPct || 0) },
          { name: 'Face Presence', data: wins.map(w => w.facePresencePct || 0) },
          { name: 'Eye Closure', data: wins.map(w => w.eyeClosurePct || 0) },
        ],
        colors: ['#3b82f6', '#34d399', '#fbbf24'],
        fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.2, opacityTo: 0.05 } },
        stroke: { width: 2, curve: 'smooth' }, grid: G,
        xaxis: { ...AX, categories: wins.map(w => Math.floor(w.startSec / 60) + 'm') },
        yaxis: { ...AY, min: 0, max: 100, labels: { ...AY.labels, formatter: (v: number) => v + '%' } },
        dataLabels: { enabled: false }, tooltip: { ...TT, y: { formatter: (v: number) => v + '%' } },
        legend: { labels: { colors: '#e8ecf4' }, fontSize: '10px', position: 'top', horizontalAlign: 'right' },
      }).render();
    }

    // 5. Correctness Heatmap (Wave Style - matches frame_090.jpg)
    if (this.correctnessChartRef?.nativeElement && (mcqs.length > 0 || codings.length > 0)) {
      const codingEarnedTotal = r.codingAnalysis?.totalCodingScore ?? 0;
      const mcqLen = mcqs.length;
      const codingFullCorrect = new Set<number>();
      let remaining = codingEarnedTotal;
      for (let i = 0; i < codings.length; i++) {
        const qScore = codings[i].questionScore ?? 0;
        if (qScore > 0 && remaining >= qScore) {
          codingFullCorrect.add(mcqLen + i);
          remaining -= qScore;
        }
      }

      const seriesData = allQs.map((q: any, idx: number) => {
        let val = 2; // Skipped (default)
        if (q.isSolved === false) val = 2;
        else if (q.isRight === true || codingFullCorrect.has(idx) || (q.earnedScore > 0 && q.earnedScore === q.questionScore)) val = 3;
        else val = 1; // Wrong
        return val;
      });

      const discreteMarkers = seriesData.map((v, i) => ({
        seriesIndex: 0,
        dataPointIndex: i,
        fillColor: v === 3 ? '#34d399' : v === 2 ? '#6b7280' : '#f87171',
        strokeColor: '#000',
        size: 6
      }));

      new ApexCharts(this.correctnessChartRef.nativeElement, {
        chart: { type: 'line', height: 180, background: 'transparent', toolbar: { show: false }, animations: { enabled: true } },
        series: [{ name: 'Status', data: seriesData }],
        colors: ['rgba(255,255,255,0.05)'], // Line color
        stroke: { width: 1, curve: 'smooth' },
        markers: { size: 0, hover: { size: 8 }, discrete: discreteMarkers },
        grid: { show: true, borderColor: 'rgba(255,255,255,0.03)', xaxis: { lines: { show: true } }, yaxis: { lines: { show: false } } },
        xaxis: { ...AX, categories: allQs.map((_, i) => 'Q' + (i + 1)), tooltip: { enabled: false } },
        yaxis: {
          min: 0.5, max: 3.5, tickAmount: 3,
          labels: {
            style: { colors: '#5a6478', fontSize: '9px', fontWeight: 700 },
            formatter: (v: number) => v === 3 ? 'CORRECT' : v === 2 ? 'SKIPPED' : v === 1 ? 'WRONG' : ''
          }
        },
        tooltip: {
          ...TT,
          y: { formatter: (v: number) => v === 3 ? 'Correct' : v === 2 ? 'Skipped' : 'Wrong' }
        }
      }).render();
    }

    // 6. Code Quality Radar
    if (this.radarChartRef?.nativeElement && r.codingAnalysis?.codeQualityRadar) {
      const cq = r.codingAnalysis.codeQualityRadar;
      new ApexCharts(this.radarChartRef.nativeElement, {
        chart: { type: 'radar', height: 230, background: 'transparent', toolbar: { show: false } },
        series: [{ name: 'Score', data: [cq.correctnessPct, cq.patternPct, cq.readabilityPct, cq.timeComplexityPct, cq.spaceComplexityPct ?? 0, cq.edgeCasePct, cq.optimizationPct] }],
        colors: ['#fbbf24'], fill: { opacity: .12 }, stroke: { width: 2.5, colors: ['#fbbf24'] },
        markers: { size: 4, colors: ['#fbbf24'], strokeWidth: 0 },
        xaxis: { categories: ['Correct', 'Pattern', 'Readable', 'Time O()', 'Space O()', 'Edge Case', 'Optimize'], labels: { style: { colors: Array(7).fill('#e8ecf4'), fontSize: '10px' } } },
        yaxis: { show: false, min: 0, max: 100 },
        plotOptions: { radar: { polygons: { strokeColors: 'rgba(255,255,255,.04)', fill: { colors: ['rgba(255,255,255,.005)', 'rgba(255,255,255,.015)'] } } } },
        tooltip: { ...TT, y: { formatter: (v: number) => v + '/100' } },
      }).render();
    }

    // 7. Category Breakdown
    if (this.categoryChartRef?.nativeElement) {
      const mcqPct = mcqs.length > 0 ? Math.round(mcqs.filter(m => m.isRight).length / mcqs.length * 100) : 0;
      const codePct = (r.codingAnalysis && r.codingAnalysis.totalCodingScore > 0) ? Math.min(100, Math.round(r.codingAnalysis.totalCodingScore / this.codingMax() * 100)) : 0;
      const domainPct = (r.domainAnalysis?.topicPerformance && r.domainAnalysis.topicPerformance.length > 0)
        ? Math.round(r.domainAnalysis.topicPerformance.reduce((s, t) => s + t.candidatePct, 0) / r.domainAnalysis.topicPerformance.length)
        : Math.round(mcqPct);
      const behavioralPct = Math.max(0, 100 - (r.cheatingProbability?.percentage ?? 10) - (r.securityFlags?.tabSwitches ? r.securityFlags.tabSwitches * 5 : 0));
      new ApexCharts(this.categoryChartRef.nativeElement, {
        chart: { type: 'radialBar', height: 230, background: 'transparent' },
        series: [codePct, mcqPct, domainPct, behavioralPct], labels: ['Coding', 'MCQ', 'Domain', 'Behavioral'],
        colors: ['#34d399', '#fbbf24', '#3b82f6', '#a78bfa'],
        plotOptions: { radialBar: { hollow: { size: '30%' }, track: { background: 'rgba(255,255,255,.04)', margin: 5 }, dataLabels: { name: { fontSize: '11px', color: '#e8ecf4', offsetY: -8 }, value: { fontSize: '20px', fontWeight: 800, color: '#fafafa', offsetY: 2, formatter: (v: number) => v + '%' }, total: { show: true, label: 'Overall', fontSize: '10px', color: '#e8ecf4', formatter: () => this.scorePct() + '%' } } } },
        stroke: { lineCap: 'round' },
        legend: { show: true, labels: { colors: '#e8ecf4' }, fontSize: '10px', position: 'bottom' },
      }).render();
    }

    // 8. Confidence (polarArea)
    if (this.confChartRef?.nativeElement && r.confidenceDistribution) {
      const cd = r.confidenceDistribution;
      new ApexCharts(this.confChartRef.nativeElement, {
        chart: { type: 'polarArea', height: 230, background: 'transparent' },
        series: [cd.highConfidencePct, cd.moderatePct, cd.hesitantPct, cd.guessingPct, cd.noAnswerPct],
        labels: ['High Confidence', 'Moderate', 'Hesitant', 'Guessing', 'No Answer'],
        colors: ['#34d399', '#3b82f6', '#fbbf24', '#db2777', '#444'],
        stroke: { width: 2, colors: ['#111114'] }, fill: { opacity: .85 },
        plotOptions: { polarArea: { rings: { strokeWidth: 1, strokeColor: 'rgba(255,255,255,.04)' }, spokes: { strokeWidth: 1, connectorColors: 'rgba(255,255,255,.04)' } } },
        yaxis: { show: false },
        legend: { show: true, labels: { colors: '#e8ecf4' }, fontSize: '10px', position: 'bottom' },
        dataLabels: { enabled: false }, tooltip: { ...TT, y: { formatter: (v: number) => v + '%' } },
      }).render();
    }

    // 9. Suspicious Events
    if (this.suspiciousChartRef?.nativeElement) {
      const be = r.rawBehaviorData?.behaviorEvents as any;
      const sf = r.securityFlags;
      const lookAway = sf?.suspiciousLookingEvents ?? be?.suspiciousLookingEvents ?? 0;
      const faceLoss = sf?.faceLossEvents ?? be?.faceLossEvents ?? 0;
      const eyeClose = sf?.longEyeClosureEvents ?? be?.longEyeClosureEvents ?? 0;
      new ApexCharts(this.suspiciousChartRef.nativeElement, {
        chart: { type: 'bar', height: 230, background: 'transparent', toolbar: { show: false } },
        series: [{ name: 'Occurrences', data: [lookAway, faceLoss, eyeClose] }],
        colors: ['#f87171', '#db2777', '#fb923c'],
        plotOptions: { bar: { columnWidth: '40%', borderRadius: 3, distributed: true } },
        dataLabels: { enabled: false },
        xaxis: { categories: ['Look Away', 'Face Loss', 'Eye Close'], ...AX }, yaxis: { show: false },
        grid: { show: false }, legend: { show: false }, tooltip: { ...TT },
      }).render();
    }

    // 10. Head Stability
    if (this.headStabilityChartRef?.nativeElement) {
      const hb = r.rawBehaviorData?.headBehavior;
      if (hb && (hb.yawVariance > 0 || hb.pitchVariance > 0 || hb.rollVariance > 0)) {
        const maxVar = Math.max(hb.yawVariance, hb.pitchVariance, hb.rollVariance);
        const yAxisMax = Math.ceil(maxVar * 1.3) || 5;
        new ApexCharts(this.headStabilityChartRef.nativeElement, {
          chart: { type: 'radar', height: 230, background: 'transparent', toolbar: { show: false } },
          series: [{ name: 'Variance', data: [Math.round(hb.yawVariance * 10) / 10, Math.round(hb.pitchVariance * 10) / 10, Math.round(hb.rollVariance * 10) / 10] }],
          colors: ['#2dd4bf'], fill: { opacity: .12 }, stroke: { width: 2.5, colors: ['#2dd4bf'] },
          markers: { size: 4, colors: ['#2dd4bf'], strokeWidth: 0 },
          xaxis: { categories: ['Yaw', 'Pitch', 'Roll'], labels: { style: { colors: Array(3).fill('#e8ecf4'), fontSize: '10px' } } },
          yaxis: { show: false, min: 0, max: yAxisMax },
          plotOptions: { radar: { polygons: { strokeColors: 'rgba(255,255,255,.04)', fill: { colors: ['rgba(255,255,255,.005)', 'rgba(255,255,255,.015)'] } } } },
          tooltip: { ...TT, y: { formatter: (v: number) => v.toFixed(1) } },
        }).render();
      } else {
        this.headStabilityChartRef.nativeElement.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;min-height:200px;color:#5a6478;font-size:13px;">No webcam data available</div>';
      }
    }

    // 11. Topic Performance
    if (this.topicChartRef?.nativeElement && r.domainAnalysis.topicPerformance.length > 0) {
      const topics = r.domainAnalysis.topicPerformance;
      new ApexCharts(this.topicChartRef.nativeElement, {
        chart: { type: 'bar', height: Math.max(200, topics.length * 40), background: 'transparent', toolbar: { show: false } },
        series: [{ name: 'Candidate', data: topics.map(t => t.candidatePct) }, { name: 'Average', data: topics.map(t => t.averagePct) }],
        colors: ['#D4AF37', 'rgba(255,255,255,.10)'],
        plotOptions: { bar: { horizontal: true, barHeight: '52%', borderRadius: 3 } }, grid: G,
        xaxis: { ...AX, categories: topics.map(t => t.topic) }, yaxis: AY,
        dataLabels: { enabled: false }, tooltip: { ...TT, y: { formatter: (v: number) => v + '%' } },
        legend: { labels: { colors: '#e8ecf4' }, fontSize: '10px', position: 'top', horizontalAlign: 'right' },
      }).render();
    }

    // 12. Difficulty Analysis
    if (this.diffChart2Ref?.nativeElement) {
      new ApexCharts(this.diffChart2Ref.nativeElement, {
        chart: { type: 'bar', height: 230, background: 'transparent', toolbar: { show: false } },
        series: [
          { name: 'Accuracy %', data: [r.difficultyAnalysis.easy.accuracyPct, r.difficultyAnalysis.medium.accuracyPct, r.difficultyAnalysis.hard.accuracyPct] },
          { name: 'Avg Time (s)', data: [r.difficultyAnalysis.easy.avgTimeSec, r.difficultyAnalysis.medium.avgTimeSec, r.difficultyAnalysis.hard.avgTimeSec] },
        ],
        colors: ['#34d399', '#fbbf24'],
        plotOptions: { bar: { columnWidth: '45%', borderRadius: 4 } }, grid: G,
        xaxis: { ...AX, categories: ['Easy', 'Medium', 'Hard'] }, yaxis: AY,
        dataLabels: { enabled: false }, tooltip: { ...TT },
        legend: { labels: { colors: '#e8ecf4' }, fontSize: '10px', position: 'top', horizontalAlign: 'right' },
      }).render();
    }

    // 13. Response Time Distribution
    if (this.responseHistChartRef?.nativeElement && allQs.length > 0) {
      const buckets = [0, 0, 0, 0, 0, 0];
      allQs.forEach(m => { const t = m.timeTakenByUser || 0; if (t <= 30) buckets[0]++; else if (t <= 60) buckets[1]++; else if (t <= 90) buckets[2]++; else if (t <= 120) buckets[3]++; else if (t <= 150) buckets[4]++; else buckets[5]++; });
      new ApexCharts(this.responseHistChartRef.nativeElement, {
        chart: { type: 'bar', height: 230, background: 'transparent', toolbar: { show: false } },
        series: [{ name: 'Questions', data: buckets }],
        colors: ['#3b82f6'],
        plotOptions: { bar: { columnWidth: '55%', borderRadius: 4 } }, grid: G,
        xaxis: { ...AX, categories: ['0–30s', '30–60s', '60–90s', '90–120s', '120–150s', '150s+'] },
        yaxis: AY, dataLabels: { enabled: false },
        tooltip: { ...TT, y: { formatter: (v: number) => v + ' questions' } },
      }).render();
    }

    // 14. Emotion-Accuracy Link
    if (this.emotionAccuracyChartRef?.nativeElement && wins.length > 0) {
      const stressIdx = wins.map(w => Math.round(w.stressIndex || 0));
      const maxStress = Math.max(...stressIdx, 20);
      const windowSize = Math.ceil(mcqs.length / wins.length) || 1;
      const accSlot = wins.map((w, i) => { if (w.accuracyPct > 0) return w.accuracyPct; const slice = mcqs.slice(i * windowSize, (i + 1) * windowSize); return slice.length > 0 ? Math.round(slice.filter(m => m.isRight).length / slice.length * 100) : 0; });
      new ApexCharts(this.emotionAccuracyChartRef.nativeElement, {
        chart: { type: 'line', height: 230, background: 'transparent', toolbar: { show: false }, zoom: { enabled: false } },
        series: [{ name: 'Stress Index', data: stressIdx, type: 'area' }, { name: 'Accuracy', data: accSlot, type: 'line' }],
        colors: ['#f87171', '#34d399'],
        fill: { type: ['gradient', 'solid'], gradient: { shadeIntensity: 1, opacityFrom: 0.22, opacityTo: 0.02 } },
        stroke: { width: [2, 2.5], curve: 'smooth' }, grid: G,
        xaxis: { ...AX, categories: wins.map(w => Math.floor(w.startSec / 60) + 'm') },
        yaxis: [{ ...AY, min: 0, max: Math.ceil(maxStress * 1.2) }, { ...AY, opposite: true, min: 0, max: 100 }],
        dataLabels: { enabled: false }, tooltip: { ...TT, y: { formatter: (v: number) => v + '%' } },
        legend: { labels: { colors: '#e8ecf4' }, fontSize: '10px', position: 'top', horizontalAlign: 'right' },
      }).render();
    }

    // 15. Proctoring Timeline — eventLog for tab/copy/paste, pqb for gaze/eye only
    if (this.proctoringChartRef?.nativeElement) {
      const totalQ = allQs.length;
      const qLabels = allQs.map((_, i) => 'Q' + (i + 1));

      // Tab / Copy / Paste — from eventLog ONLY (source of truth, avoids double-count with pqb)
      const tabCounts = new Array(totalQ).fill(0);
      const copyCounts = new Array(totalQ).fill(0);
      const pasteCounts = new Array(totalQ).fill(0);
      const evLog = r.securityFlags?.eventLog || [];
      evLog.forEach((ev: any) => {
        const idx = ev.questionIndex;
        if (idx >= 0 && idx < totalQ) {
          if (ev.type === 'tab') tabCounts[idx]++;
          else if (ev.type === 'copy') copyCounts[idx]++;
          else if (ev.type === 'paste') pasteCounts[idx]++;
        }
      });

      // Gaze / Eye — from pqb ONLY (webcam data, not in eventLog)
      const gazeCounts = new Array(totalQ).fill(0);
      const eyeCounts = new Array(totalQ).fill(0);
      pqb.forEach(q => {
        const idx = q.questionId;
        if (idx >= 0 && idx < totalQ) {
          gazeCounts[idx] += q.gazeBreaks || 0;
          eyeCounts[idx] += q.eyeCloseEvents || 0;
        }
      });

      const seriesColors = ['#f87171', '#fbbf24', '#fb923c', '#2dd4bf', '#3b82f6'];

      new ApexCharts(this.proctoringChartRef.nativeElement, {
        chart: { type: 'bar', height: 280, background: 'transparent', toolbar: { show: false }, stacked: true },
        series: [
          { name: 'Tab Switch', data: tabCounts },
          { name: 'Gaze Break', data: gazeCounts },
          { name: 'Eye Close', data: eyeCounts },
          { name: 'Copy', data: copyCounts },
          { name: 'Paste', data: pasteCounts },
        ],
        colors: seriesColors,
        plotOptions: { bar: { borderRadius: 3, columnWidth: '55%' } },
        grid: G,
        xaxis: { ...AX, categories: qLabels },
        yaxis: { show: true, min: 0, labels: { style: { colors: '#5a6478', fontSize: '10px' }, formatter: (v: number) => String(Math.round(v)) } },
        dataLabels: { enabled: false },
        tooltip: { ...TT, shared: true, intersect: false },
        legend: { labels: { colors: '#e8ecf4' }, fontSize: '10px', position: 'top', horizontalAlign: 'right' },
      }).render();
    }

    // 16. Navigation Pattern — dynamic visits (Visit 1..N based on max viewCount)
    if (this.navigationChartRef?.nativeElement && allQs.length > 0) {
      // Find the max number of times any question was visited
      const maxVisits = Math.max(1, ...allQs.map((_, i) => pqb[i]?.viewCount ?? 1));

      // Build one series per visit level
      const navSeries = Array.from({ length: maxVisits }, (_, visitIdx) => {
        const visitNum = visitIdx + 1;
        return {
          name: 'Visit ' + visitNum,
          data: allQs.map((_, qi) => ({
            x: 'Q' + (qi + 1),
            // Cell is "active" if this question was visited at least visitNum times
            y: (pqb[qi]?.viewCount ?? 1) >= visitNum ? 1 : 0,
          })),
        };
      });

      // Taller chart when many visit levels exist
      const navHeight = Math.max(230, maxVisits * 36 + 60);

      new ApexCharts(this.navigationChartRef.nativeElement, {
        chart: { type: 'heatmap', height: navHeight, background: 'transparent', toolbar: { show: false } },
        series: navSeries,
        colors: ['#D4AF37'],
        plotOptions: {
          heatmap: {
            radius: 3,
            enableShades: true,
            shadeIntensity: 0.6,
            colorScale: {
              ranges: [
                { from: 0, to: 0, color: 'rgba(255,255,255,.03)', name: 'Not visited' },
                { from: 1, to: 1, color: '#D4AF37', name: 'Visited' },
              ],
            },
          },
        },
        grid: { show: false },
        xaxis: { ...AX, tickAmount: Math.min(allQs.length, 12) },
        yaxis: AY,
        dataLabels: { enabled: false },
        tooltip: { ...TT, y: { formatter: (v: number) => v === 1 ? 'Visited' : 'Not visited' } },
        legend: { show: false },
      }).render();
    }
  }

  getShortTag(tag: string | undefined): string {
    if (!tag) return 'Unknown';
    // If the LLM returned a full sentence instead of a single word, extract the known keyword.
    const t = tag.toUpperCase();
    if (t.includes('EXCEPTIONAL')) return 'Exceptional';
    if (t.includes('STRONG')) return 'Strong';
    if (t.includes('COMPETENT')) return 'Competent';
    if (t.includes('DEVELOPING')) return 'Developing';
    if (t.includes('WEAK')) return 'Weak';
    if (t.includes('EXPERT')) return 'Expert';
    if (t.includes('PROFICIENT')) return 'Proficient';
    if (t.includes('NOVICE')) return 'Novice';
    if (t.includes('FOCUSED')) return 'Focused';
    if (t.includes('COMPOSED')) return 'Composed';
    if (t.includes('DISTRACTED')) return 'Distracted';
    if (t.includes('ANXIOUS')) return 'Anxious';
    if (t.includes('SUSPICIOUS')) return 'Suspicious';
    if (t.includes('DISENGAGED')) return 'Disengaged';
    return tag.split(' ')[0].replace(/[^a-zA-Z]/g, '');
  }
}

