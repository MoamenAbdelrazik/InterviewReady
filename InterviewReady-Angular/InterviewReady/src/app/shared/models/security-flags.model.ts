/**
 * Security event counters tracked by the frontend during the interview.
 * Sent to backend in the report request AND returned in the response (same shape).
 */
export interface SecurityFlags {
  tabSwitches:          number;
  copyAttempts:         number;
  pasteAttempts:        number;
  multipleTabsDetected: boolean;
  totalFlags:           number;      // sum of tabSwitches + copyAttempts + pasteAttempts
  suspiciousLookingEvents?: number;
  faceLossEvents?: number;
  longEyeClosureEvents?: number;
  /** Per-event log with the question that was active at the time */
  eventLog: SecurityEvent[];
}

export interface SecurityEvent {
  type: 'tab' | 'copy' | 'paste';
  questionIndex: number;             // which question was active when this event fired
  timestamp: number;
}
