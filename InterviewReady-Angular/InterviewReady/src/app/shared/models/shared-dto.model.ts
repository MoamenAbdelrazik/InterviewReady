/**
 * Shared sub-interfaces used across behaviorAnalysis, domainAnalysis, and codingAnalysis.
 */
export interface AreaOfDevelopment {
  topic:       string;
  priority:    string;              // "HIGH" | "MEDIUM" | "LOW"
  description: string;
}

export interface ActionPlanItem {
  priority:    string;              // "HIGH" | "MEDIUM" | "LOW"
  title:       string;
  description: string;
}
