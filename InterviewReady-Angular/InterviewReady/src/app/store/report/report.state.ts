import { FinalComprehensiveReport } from '../../shared/models';

export interface ReportState {
  // Complete report (includes rawBehaviorData, rawMcqSolutions, rawCodingSolutions)
  comprehensiveReport: FinalComprehensiveReport | null;
  isProcessing:        boolean;
  error:               string | null;
}

export const initialReportState: ReportState = {
  comprehensiveReport: null,
  isProcessing:        false,
  error:               null,
};
