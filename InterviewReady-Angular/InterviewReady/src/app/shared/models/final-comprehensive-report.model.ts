import { AreaOfDevelopment, ActionPlanItem } from './shared-dto.model';
import { BehaviorData } from './behavior-data.model';
import { MCQSolution } from './mcq-solution.model';
import { CodingSolution } from './coding-solution.model';
import { SecurityFlags } from './security-flags.model';

/**
 * Complete report response from POST /user/interviews/{id}/report.
 * Also returned from GET /user/interviews/{id}/report (revisit).
 *
 * Contains ALL LLM analyses + raw session data for chart rendering.
 * totalCodingScore is LLM-evaluated. finalScore = mcqScore + totalCodingScore.
 */
export interface FinalComprehensiveReport {
  interviewSummary: string;
  jobProfileTitle?: string;          // e.g. "Backend Engineer" — from interview config

  confidenceDistribution: {
    highConfidencePct: number;
    moderatePct:       number;
    hesitantPct:       number;
    guessingPct:       number;
    noAnswerPct:       number;      // All 5 should sum to 100.0 — normalize on frontend
  };

  difficultyAnalysis: {
    easy:   { accuracyPct: number; avgTimeSec: number };
    medium: { accuracyPct: number; avgTimeSec: number };
    hard:   { accuracyPct: number; avgTimeSec: number };
  };

  behaviorAnalysis: {
    summary:            string;
    tag:                string;     // "Focused"|"Composed"|"Distracted"|"Anxious"|"Suspicious"|"Disengaged"
    areasOfDevelopment: AreaOfDevelopment[];
    actionPlan:         ActionPlanItem[];
  };

  domainAnalysis: {
    summary:            string;
    tag:                string;     // "Expert"|"Proficient"|"Competent"|"Developing"|"Novice"
    areasOfDevelopment: AreaOfDevelopment[];
    actionPlan:         ActionPlanItem[];
    topicPerformance:   { topic: string; candidatePct: number; averagePct: number }[];
  };

  codingAnalysis: {
    summary:            string;
    tag:                string;     // "Exceptional"|"Strong"|"Competent"|"Developing"|"Weak"
    areasOfDevelopment: AreaOfDevelopment[];
    actionPlan:         ActionPlanItem[];
    codeQualityRadar: {
      correctnessPct:      number;
      patternPct:          number;
      readabilityPct:      number;
      timeComplexityPct:   number;
      spaceComplexityPct:  number;
      edgeCasePct:         number;
      optimizationPct:     number;  // 7 axes
    };
    totalCodingScore:   number;     // LLM-evaluated earned score
  };

  cheatingProbability?: {
    level:      string;             // "LOW" | "MODERATE" | "HIGH"
    percentage: number;             // 0.0–100.0
  };

  timeTaken:      number;           // seconds
  securityFlags?:  SecurityFlags;
  finalScore:     number;           // mcqScore + totalCodingScore

  // Raw data for report revisit — all charts render without local state
  rawBehaviorData:    BehaviorData;
  rawMcqSolutions:    MCQSolution[];
  rawCodingSolutions: CodingSolution[];
}
