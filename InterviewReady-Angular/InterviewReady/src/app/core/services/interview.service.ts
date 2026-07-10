import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, timeout } from 'rxjs';
import { MCQ, Coding, FinalComprehensiveReport, BehaviorData, MCQSolution, CodingSolution, SecurityFlags, JobProfileDTO } from '../../shared/models';
import { environment } from '../../../environments/environment';

/** Response from POST /user/interviews/start */
export interface StartInterviewResponse {
  interviewId:     number;
  mcqQuestions:    MCQ[];
  codingQuestions: Coding[];
}

/** Request body for POST /user/interviews/{id}/report */
export interface SubmitReportRequest {
  behaviorData:    BehaviorData;
  mcqSolutions:    MCQSolution[];
  codingSolutions: CodingSolution[];
  timeTaken:       number;
  securityFlags:   SecurityFlags;
}

@Injectable({ providedIn: 'root' })
export class InterviewService {
  private http = inject(HttpClient);
  private api = environment.apiUrl;

  /** POST /user/interviews/start — 120s timeout for LLM generation */
  startInterview(payload: { jobDescription?: string; jobTitle?: string }): Observable<StartInterviewResponse> {
    return this.http.post<StartInterviewResponse>(`${this.api}/user/interviews/start`, payload).pipe(
      timeout(120000)
    );
  }

  /** POST /user/interviews/{id}/report — 180s timeout for 4 LLM calls */
  submitReport(interviewId: number, body: SubmitReportRequest): Observable<FinalComprehensiveReport> {
    return this.http.post<FinalComprehensiveReport>(
      `${this.api}/user/interviews/${interviewId}/report`,
      body
    ).pipe(
      timeout(180000)
    );
  }

  /** GET /user/interviews/job-profiles → JobProfileDTO[] (for Mode B dropdown) */
  getJobProfiles(): Observable<JobProfileDTO[]> {
    return this.http.get<JobProfileDTO[]>(`${this.api}/user/interviews/job-profiles`);
  }

  /** POST /user/interviews/{id}/voice-assist */
  voiceAssist(interviewId: number, body: { userMessage: string; questionType: string; activeQuestionContent: string }): Observable<any> {
    return this.http.post<any>(`${this.api}/user/interviews/${interviewId}/voice-assist`, body);
  }
}
